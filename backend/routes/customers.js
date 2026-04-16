const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const ctrl          = require('../controllers/customerController');

router.use(authMiddleware, shopIsolation);

// Owner + manager can view customer insights
router.get('/top',      requireRole('owner', 'manager'), ctrl.getTopCustomers);
router.get('/insights', requireRole('owner', 'manager'), ctrl.getCustomerInsights);

module.exports = router;
