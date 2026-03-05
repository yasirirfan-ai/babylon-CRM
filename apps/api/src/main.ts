import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { authJwt } from './middleware/authJwt.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { authzMiddleware } from './middleware/authz.js';
import { authRouter } from './modules/auth/index.js';
import { workflowRouter } from './modules/workflow/index.js';
import { requestsRouter } from './modules/requests/index.js';
import { rfqRouter } from './modules/rfqs/index.js';
import { ordersRouter } from './modules/orders/index.js';
import { notificationsRouter } from './modules/notifications/index.js';
import { approvalsRouter } from './modules/approvals/index.js';
import { loadWorkflowConfig } from './modules/workflow/config/workflowConfigLoader.js';
import { registry } from './modules/workflow/workflowRegistry.js';

// 1. Enforce rigorous JSON workflow boundaries at startup
const workflowConfig = loadWorkflowConfig();
registry.loadConfig(workflowConfig as any);

const app = express();
export default app;

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Namespace all API routes under /api so Vercel rewrite + client base path line up.
const api = express.Router();

api.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public auth endpoints stay reachable without an existing membership header.
api.use('/auth', authRouter);

// Enforce tenant isolation on all protected API routes.
api.use(authJwt);
api.use(tenantMiddleware);
api.use(authzMiddleware);

api.use('/workflows', workflowRouter);
api.use('/requests', requestsRouter);
api.use('/rfqs', rfqRouter);
api.use('/orders', ordersRouter);
api.use('/notifications', notificationsRouter);
api.use('/approvals', approvalsRouter);

app.use('/api', api);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(config.port, () => {
        console.log(`API server listening on port ${config.port}`);
    });
}
