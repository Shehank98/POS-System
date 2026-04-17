const express      = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnly      = require('../middleware/readOnly');

const products = require('../controllers/clothing/productsController');
const variants = require('../controllers/clothing/variantsController');

const router = express.Router();
router.use(authMiddleware, shopIsolation);

// ── Products ──────────────────────────────────────────────────
router.get   ('/products',     products.listClothingProducts);
router.post  ('/products',     readOnly, requireRole('owner','manager'), products.createClothingProduct);
router.get   ('/products/:id', products.getClothingProduct);
router.put   ('/products/:id', readOnly, requireRole('owner','manager'), products.updateClothingProduct);
router.delete('/products/:id', readOnly, requireRole('owner','manager'), products.deleteClothingProduct);

// ── Variants ──────────────────────────────────────────────────
// NOTE: by-barcode must come BEFORE /:id to avoid route collision
router.get('/variants/by-barcode/:barcode', variants.getVariantByBarcode);

router.get   ('/products/:pid/variants', variants.listVariants);
router.post  ('/products/:pid/variants', readOnly, requireRole('owner','manager'), variants.createVariant);
router.put   ('/variants/:id',           readOnly, requireRole('owner','manager'), variants.updateVariant);
router.delete('/variants/:id',           readOnly, requireRole('owner','manager'), variants.deleteVariant);

module.exports = router;
