import net from 'node:net';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';

const npmCommand = 'npm';
const children = [];
let shuttingDown = false;

function resolveCommand(command, args) {
    if (process.platform === 'win32' && /^npm(\.cmd)?$/i.test(command)) {
        return {
            command: 'cmd.exe',
            args: ['/d', '/s', '/c', [command, ...args].join(' ')],
        };
    }

    return { command, args };
}

function commandExists(command, args) {
    try {
        const result = spawnSync(command, args, { stdio: 'ignore', timeout: 5000 });
        if (result.error) return false;
        return result.status === 0;
    } catch {
        return false;
    }
}

function getComposeCommand() {
    if (commandExists('docker', ['compose', 'version'])) {
        return { command: 'docker', prefix: ['compose'] };
    }

    if (commandExists('docker-compose', ['--version'])) {
        return { command: 'docker-compose', prefix: [] };
    }

    return null;
}

function runCommand(command, args, options = {}) {
    const resolved = resolveCommand(command, args);

    return new Promise((resolve, reject) => {
        const child = spawn(resolved.command, resolved.args, {
            cwd: options.cwd || process.cwd(),
            stdio: options.stdio || 'inherit',
            env: { ...process.env, ...(options.env || {}) },
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
        });
    });
}

function waitForPort({ host, port, timeoutMs }) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        const attemptConnection = () => {
            const socket = net.createConnection({ host, port });

            socket.once('connect', () => {
                socket.end();
                resolve();
            });

            socket.once('error', () => {
                socket.destroy();

                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error(`Timed out waiting for ${host}:${port}`));
                    return;
                }

                setTimeout(attemptConnection, 1000);
            });
        };

        attemptConnection();
    });
}

function stopChild(child) {
    if (!child?.pid) return;

    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        return;
    }

    child.kill('SIGINT');
}

function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
        stopChild(child);
    }

    setTimeout(() => {
        process.exit(exitCode);
    }, 250);
}

function spawnLongRunning(command, args, label) {
    const resolved = resolveCommand(command, args);
    const child = spawn(resolved.command, resolved.args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
    });

    children.push(child);

    child.on('error', (error) => {
        console.error(`${label} failed to start:`, error);
        shutdown(1);
    });

    child.on('exit', (code) => {
        if (shuttingDown) return;

        console.error(`${label} exited with code ${code ?? 'unknown'}. Stopping the dev stack.`);
        shutdown(code ?? 1);
    });

    return child;
}

async function ensureWindowsRollupBinary() {
    if (process.platform !== 'win32') return;

    const check = spawnSync('node', ['-e', "require.resolve('@rollup/rollup-win32-x64-msvc')"], {
        cwd: process.cwd(),
        stdio: 'ignore',
    });

    if (check.status === 0) return;

    console.log('Installing missing Windows Rollup binary...');
    await runCommand(npmCommand, ['install', '--no-save', '@rollup/rollup-win32-x64-msvc']);
}

async function main() {
    const compose = getComposeCommand();

    if (compose) {
        console.log('Starting postgres...');
        try {
            await runCommand(compose.command, [...compose.prefix, 'up', '-d', 'postgres']);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`Could not start postgres container via Docker Compose (${reason}).`);
            console.warn('Continuing and checking for a local postgres instance on localhost:5432...');
        }
    } else {
        console.log('Docker Compose not found. Skipping container startup and checking local postgres...');
    }

    console.log('Waiting for postgres on localhost:5432...');
    await waitForPort({ host: '127.0.0.1', port: 5432, timeoutMs: 60_000 });

    console.log('Running migrations and preparing demo data...');
    await runCommand(npmCommand, ['--workspace', '@babylon/api', 'run', 'db:migrate']);
    await runCommand(npmCommand, ['--workspace', '@babylon/api', 'run', 'db:seed']);
    await ensureWindowsRollupBinary();

    console.log('Starting API and web dev servers...');
    spawnLongRunning(npmCommand, ['--workspace', '@babylon/api', 'exec', '--', 'tsx', 'watch', 'src/main.ts'], 'API');
    spawnLongRunning(npmCommand, ['--workspace', 'web', 'run', 'dev'], 'Web');

    console.log('Dev stack is up. Press Ctrl+C to stop everything.');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
    console.error(error.message || error);
    shutdown(1);
});
