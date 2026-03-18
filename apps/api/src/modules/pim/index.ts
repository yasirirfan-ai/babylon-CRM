import { Router } from 'express';
import { db } from '../../db/index.js';
import { brands, products, productRevisions } from '../../db/schema.js';
import { withTenant, withTenantUpdate } from '../../db/tenant.js';
import { eq, and } from 'drizzle-orm';

export const pimRouter = Router();

// GET /brands
pimRouter.get('/brands', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const data = await withTenant(db.select().from(brands), brands, customerId);
        res.json({ brands: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

// POST /brands
pimRouter.post('/brands', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const { name, logo_url, theme_config } = req.body;
        const [brand] = await db.insert(brands).values({
            customer_id: customerId,
            name,
            logo_url,
            theme_config,
        }).returning();
        res.status(201).json(brand);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create brand' });
    }
});

// GET /products
pimRouter.get('/products', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select({
            product: products,
            brand: brands,
        })
        .from(products)
        .leftJoin(brands, eq(products.brand_id, brands.id));

        const data = await withTenant(query, products, customerId);
        res.json({ products: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// POST /products
pimRouter.post('/products', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const { brand_id, sku, name, description } = req.body;
        
        // Verify brand belongs to tenant
        const [brand] = await withTenant(db.select().from(brands), brands, customerId, eq(brands.id, brand_id));
        if (!brand) return res.status(400).json({ error: 'Invalid brand' });

        const [product] = await db.insert(products).values({
            customer_id: customerId,
            brand_id,
            sku,
            name,
            description,
        }).returning();
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// GET /products/:id/revisions
pimRouter.get('/products/:id/revisions', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        
        // Verify product belongs to tenant
        const [product] = await withTenant(db.select().from(products), products, customerId, eq(products.id, req.params.id));
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const revisions = await db.select()
            .from(productRevisions)
            .where(eq(productRevisions.product_id, product.id));
        
        res.json({ revisions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch revisions' });
    }
});
