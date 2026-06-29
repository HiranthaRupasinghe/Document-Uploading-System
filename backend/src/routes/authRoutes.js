const express = require('express');
const { signup, login, forgotPassword, getSecurityQuestion, verifySecurityAnswer, updateProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/security-question/:username', getSecurityQuestion);
router.post('/verify-security-answer', verifySecurityAnswer);
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;
