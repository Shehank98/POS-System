const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const ctrl          = require('../controllers/reportController');

router.use(authMiddleware, shopIsolation);

// Sales report: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&format=excel|pdf
router.get('/sales',     requireRole('owner', 'manager'), ctrl.exportSales);

// Inventory report: ?format=excel
router.get('/inventory', requireRole('owner', 'manager'), ctrl.exportInventory);

// Tax report: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
router.get('/tax',       requireRole('owner', 'manager'), ctrl.getTaxReport);

module.exports = router;
