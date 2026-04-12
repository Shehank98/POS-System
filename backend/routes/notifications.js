const router        = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const ctrl          = require('../controllers/notificationController');

router.use(authMiddleware, shopIsolation);

router.get('/',             ctrl.getNotifications);
router.put('/read-all',     ctrl.markAllRead);
router.put('/:id/read',     ctrl.markRead);

module.exports = router;
