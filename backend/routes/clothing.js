const express      = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnly      = require('../middleware/readOnly');

const products  = require('../controllers/clothing/productsController');
const variants  = require('../controllers/clothing/variantsController');
const stock     = require('../controllers/clothing/stockController');
const exchanges = require('../controllers/clothing/exchangeController');
const reports   = require('../controllers/clothing/reportsController');
const branches  = require('../controllers/clothing/branchController');
const customers = require('../controllers/clothing/customerController');

const router = express.Router();
router.use(authMiddleware, shopIsolation);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', reports.dashboard);

// ── Products ──────────────────────────────────────────────────
router.get   ('/products',     products.listClothingProducts);
router.post  ('/products',     readOnly, requireRole('owner','manager'), products.createClothingProduct);
router.get   ('/products/:id', products.getClothingProduct);
router.put   ('/products/:id', readOnly, requireRole('owner','manager'), products.updateClothingProduct);
router.delete('/products/:id', readOnly, requireRole('owner','manager'), products.deleteClothingProduct);

// ── Variants — static routes BEFORE /:id ─────────────────────
router.get('/variants/by-barcode/:barcode', variants.getVariantByBarcode);
router.get('/variants/low-stock',           stock.getLowStockVariants);
router.get('/variants/labels',              stock.generateBarcodeLabels);

router.get   ('/products/:pid/variants', variants.listVariants);
router.post  ('/products/:pid/variants', readOnly, requireRole('owner','manager'), variants.createVariant);
router.put   ('/variants/:id',           readOnly, requireRole('owner','manager'), variants.updateVariant);
router.delete('/variants/:id',           readOnly, requireRole('owner','manager'), variants.deleteVariant);
router.get   ('/variants/:id/stock-history', stock.getStockHistory);
router.post  ('/variants/:id/adjust',    readOnly, requireRole('owner','manager'), stock.adjustStock);

// ── Transactions lookup (for exchange wizard) ─────────────────
router.get('/transactions/lookup', exchanges.lookupTransaction);

// ── Vouchers ──────────────────────────────────────────────────
router.get('/vouchers/:code', exchanges.checkVoucher);

// ── Exchanges ─────────────────────────────────────────────────
router.get ('/exchanges',              exchanges.listExchanges);
router.post('/exchanges',              readOnly, exchanges.processExchange);
// Receipt BEFORE /:id so it isn't captured as an id param
router.get ('/exchanges/:id/receipt',  exchanges.getExchangeReceipt);
router.get ('/exchanges/:id',          exchanges.getExchange);

// ── Reports (read-only — all authenticated shop members can view) ──
router.get('/reports/best-sizes',  reports.bestSizes);
router.get('/reports/best-colors', reports.bestColors);
router.get('/reports/daily-sales', reports.dailySales);

// ── Branches ──────────────────────────────────────────────────
router.get ('/branches',             branches.listBranches);
router.post('/branches',             readOnly, requireRole('owner','manager'), branches.createBranch);
router.post('/branches/transfer',    readOnly, requireRole('owner','manager'), branches.transferStock);
router.put ('/branches/:id',         readOnly, requireRole('owner','manager'), branches.updateBranch);
router.get ('/branches/:id/inventory', branches.getBranchInventory);

// ── Customers / Loyalty ───────────────────────────────────────
router.get ('/customers/lookup',    customers.lookupCustomer);
router.post('/customers',           customers.upsertCustomer);
router.post('/customers/:id/points', readOnly, requireRole('owner','manager'), customers.adjustLoyaltyPoints);

module.exports = router;
