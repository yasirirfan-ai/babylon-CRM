import { Router } from 'express';

export const metaRouter = Router();

const orderStates = [
    { state: 'rfq', docs: ['Quotation'], notes: 'Pre-order negotiation' },
    { state: 'confirmed', docs: ['Order Confirmation'], notes: 'Pricing snapshot locked' },
    { state: 'allocated', docs: ['Allocation Summary', 'Lot-level allocation report'], notes: 'Lots reserved' },
    { state: 'scheduled', docs: ['Schedule Confirmation', 'Batch number assignment'], notes: 'Production window set' },
    { state: 'in_production', docs: ['Production status updates'], notes: 'Live production' },
    { state: 'produced', docs: ['QC Test Report (basic)', 'QC Report (detailed)'], notes: 'Awaiting pack/ship' },
    { state: 'packed', docs: ['Packing List'], notes: 'Ready to ship' },
    { state: 'shipped', docs: ['Shipping Confirmation', 'Tracking number'], notes: 'In transit' },
    { state: 'on_hold', docs: [], notes: 'Blocked pending action' },
    { state: 'cancelled', docs: [], notes: 'Terminated' },
    { state: 'archived', docs: [], notes: 'Historical record' },
];

const requestStates = [
    'draft',
    'submitted',
    'in_review',
    'awaiting_customer',
    'in_progress',
    'approved',
    'resolved',
    'on_hold',
    'closed',
    'cancelled',
];

metaRouter.get('/order-states', (_req, res) => {
    res.json({ orderStates });
});

metaRouter.get('/request-states', (_req, res) => {
    res.json({ requestStates });
});

