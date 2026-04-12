const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnlyGuard = require('../middleware/readOnly');
const ctrl          = require('../controllers/transactionController');

router.use(authMiddleware, shopIsolation);

router.get('/summary',    ctrl.getSummary);
router.get('/',           ctrl.listTransactions);
router.get('/:id',        ctrl.getTransaction);
router.post('/',          readOnlyGuard, ctrl.createTransaction);
router.post('/:id/void',  readOnlyGuard, requireRole('owner', 'manager'), ctrl.voidTransaction);

module.exports = router;
