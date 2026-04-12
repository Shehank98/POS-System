const router        = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const readOnlyGuard = require('../middleware/readOnly');
const ctrl          = require('../controllers/transactionController');
const { getReceipt } = require('../controllers/receiptController');

router.use(authMiddleware, shopIsolation);

router.get('/summary',       ctrl.getSummary);
router.get('/',              ctrl.listTransactions);
router.get('/:id/receipt',   getReceipt);
router.get('/:id',           ctrl.getTransaction);
router.post('/sync',         readOnlyGuard, ctrl.syncTransactions);   // offline sync
router.post('/',             readOnlyGuard, ctrl.createTransaction);
router.post('/:id/void',     readOnlyGuard, requireRole('owner', 'manager'), ctrl.voidTransaction);

module.exports = router;
