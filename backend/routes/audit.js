const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const { getShopAuditLog } = require('../controllers/auditController');

// Owner or manager can view their own shop's audit log
router.get('/', authMiddleware, shopIsolation, requireRole('owner', 'manager'), getShopAuditLog);

module.exports = router;
