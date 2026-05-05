const router    = require('express').Router();
const agentAuth = require('../middleware/agentAuth');
const ctrl      = require('../controllers/agentAuthController');
const regCtrl   = require('../controllers/agentRegistrationController');

// Existing auth
router.post('/login', ctrl.login);
router.get('/me',     agentAuth, ctrl.getMe);

// Registration flow (public — no auth required)
router.get ('/validate-token/:token',  regCtrl.validateToken);
router.post('/upload-file',            regCtrl.uploadRegistrationFile);
router.post('/register',               regCtrl.register);
router.get ('/agreement/:token',       regCtrl.getAgreementPdf);

// Signed agreement upload (agent must be logged in)
router.post('/upload-signed-agreement', agentAuth, regCtrl.uploadSignedAgreement);

module.exports = router;
