import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export function loadWorkflowConfig() {
    const schemaPath = path.resolve(process.cwd(), '../../packages/workflows/workflow-pack.schema.json');
    const configPath = path.resolve(process.cwd(), '../../packages/workflows/workflow-pack.v1.json');

    if (!fs.existsSync(schemaPath) || !fs.existsSync(configPath)) {
        console.error(`Missing workflow configuration files.\nSchema: ${schemaPath}\nConfig: ${configPath}`);
        process.exit(1);
    }

    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const configJson = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    const validate = ajv.compile(schemaJson);
    const isValid = validate(configJson);

    if (!isValid) {
        console.error('Workflow configuration validation failed:');
        validate.errors?.forEach(err => {
            console.error(`- ${err.instancePath} ${err.message}`, err.params);
        });
        process.exit(1);
    }

    console.log('Workflow configuration validated successfully.');
    return configJson;
}
