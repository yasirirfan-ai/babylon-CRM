import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../../db/index.js';
import { documents, requests } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq, and } from 'drizzle-orm';

export const documentsRouter = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// POST /documents/request/:id
documentsRouter.post('/request/:id', upload.single('file'), async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const membershipId = req.auth?.membershipId;
        const userId = req.auth?.userId;
        const requestId = req.params.id;

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Verify request exists to enforce tenant
        const reqQuery = db.select().from(requests);
        const [request] = await withTenant(reqQuery, requests, customerId, eq(requests.id, requestId));
        if (!request) {
            // Cleanup file if request not found
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Request not found' });
        }

        const [doc] = await db.insert(documents).values({
            customer_id: customerId,
            filename: req.file.originalname,
            storage_path: `/uploads/${req.file.filename}`, // Relative path for serving
            uploaded_by: userId,
            entity_type: 'request',
            entity_id: requestId,
        }).returning();

        res.status(201).json({ document: doc });
    } catch (error: any) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// GET /documents/request/:id
documentsRouter.get('/request/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const requestId = req.params.id;

        const query = db.select().from(documents);
        const docs = await withTenant(query, documents, customerId, and(eq(documents.entity_id, requestId), eq(documents.entity_type, 'request')));

        res.json({ documents: docs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});
