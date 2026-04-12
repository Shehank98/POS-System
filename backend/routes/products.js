const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnlyGuard = require('../middleware/readOnly');
const ctrl          = require('../controllers/productController');

// All product routes require authentication + shop isolation
router.use(authMiddleware, shopIsolation);

router.get('/categories',          ctrl.listCategories);
router.get('/by-barcode/:barcode', ctrl.getByBarcode);
router.get('/',                    ctrl.listProducts);
router.get('/:id',                 ctrl.getProduct);

// Mutation routes: owner/manager only AND subscription must be active
router.post('/',      readOnlyGuard, requireRole('owner', 'manager'), ctrl.createProduct);
router.put('/:id',    readOnlyGuard, requireRole('owner', 'manager'), ctrl.updateProduct);
router.delete('/:id', readOnlyGuard, requireRole('owner', 'manager'), ctrl.deleteProduct);

module.exports = router;
