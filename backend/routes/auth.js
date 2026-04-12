const router           = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const shopIsolation    = require('../middleware/shopIsolation');
const ctrl             = require('../controllers/authController');

// Public
router.post('/login', ctrl.login);

// Protected – any authenticated shop user
router.get('/me', authMiddleware, shopIsolation, ctrl.getMe);

// Protected – owner or manager only
router.post(
  '/register-user',
  authMiddleware,
  shopIsolation,
  requireRole('owner', 'manager'),
  ctrl.registerUser
);

router.get(
  '/users',
  authMiddleware,
  shopIsolation,
  requireRole('owner', 'manager'),
  ctrl.listUsers
);

router.delete(
  '/users/:id',
  authMiddleware,
  shopIsolation,
  requireRole('owner'),
  ctrl.deleteUser
);

module.exports = router;
