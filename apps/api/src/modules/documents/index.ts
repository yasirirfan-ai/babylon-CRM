import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../../db/index.js';
import { documents, requests, orders } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq, and } from 'drizzle-orm';

export const documentsRouter = Router();

const isVercel = process.env.VERCEL === '1';
const UPLOADS_DIR = isVercel ? '/tmp/uploads' : path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    try {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    } catch (err) {
        console.warn('Failed to create uploads directory:', err);
    }
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

// DELETE /documents/request/:docId
documentsRouter.delete('/request/:docId', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const docId = req.params.docId;

        const [doc] = await db.select().from(documents)
            .where(and(eq(documents.id, docId), eq(documents.customer_id, customerId), eq(documents.entity_type, 'request')));
        
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        await db.delete(documents).where(eq(documents.id, docId));
        
        try {
            const filePath = isVercel ? '/tmp' + doc.storage_path : path.join(process.cwd(), doc.storage_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
            console.error('Failed to unlink file:', e);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// POST /documents/order/:id
documentsRouter.post('/order/:id', upload.single('file'), async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const userId = req.auth?.userId;
        const orderId = req.params.id;

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const reqQuery = db.select().from(orders);
        const [orderItem] = await withTenant(reqQuery, orders, customerId, eq(orders.id, orderId));
        if (!orderItem) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Order not found' });
        }

        const [doc] = await db.insert(documents).values({
            customer_id: customerId,
            filename: req.file.originalname,
            storage_path: `/uploads/${req.file.filename}`,
            uploaded_by: userId,
            entity_type: 'order',
            entity_id: orderId,
        }).returning();

        res.status(201).json({ document: doc });
    } catch (error: any) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// GET /documents/order/:id
documentsRouter.get('/order/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const orderId = req.params.id;

        const query = db.select().from(documents);
        const docs = await withTenant(query, documents, customerId, and(eq(documents.entity_id, orderId), eq(documents.entity_type, 'order')));

        res.json({ documents: docs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// DELETE /documents/order/:docId
documentsRouter.delete('/order/:docId', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const docId = req.params.docId;

        const [doc] = await db.select().from(documents)
            .where(and(eq(documents.id, docId), eq(documents.customer_id, customerId), eq(documents.entity_type, 'order')));
        
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        await db.delete(documents).where(eq(documents.id, docId));
        
        try {
            const filePath = isVercel ? '/tmp' + doc.storage_path : path.join(process.cwd(), doc.storage_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
            console.error('Failed to unlink file:', e);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete document' });
    }
});
