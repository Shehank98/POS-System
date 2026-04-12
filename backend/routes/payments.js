const router        = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const ctrl          = require('../controllers/paymentController');

// Public: bank transfer details
router.get('/bank-info', ctrl.getBankInfo);

// Shop routes require auth
router.use(authMiddleware, shopIsolation);

router.get('/',  ctrl.getMyPayments);
router.post('/', ctrl.submitPayment);

module.exports = router;
