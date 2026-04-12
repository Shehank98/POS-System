const router        = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const ctrl          = require('../controllers/dashboardController');

router.use(authMiddleware, shopIsolation);

router.get('/today',     ctrl.getToday);
router.get('/week',      ctrl.getWeek);
router.get('/month',     ctrl.getMonth);
router.get('/low-stock', ctrl.getLowStock);

module.exports = router;
