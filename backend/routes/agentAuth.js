const router    = require('express').Router();
const agentAuth = require('../middleware/agentAuth');
const ctrl      = require('../controllers/agentAuthController');

router.post('/login', ctrl.login);
router.get('/me',     agentAuth, ctrl.getMe);

module.exports = router;
