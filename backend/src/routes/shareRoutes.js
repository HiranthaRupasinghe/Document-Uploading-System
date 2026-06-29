const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  shareResource,
  getSharedWithMe,
  revokeShare,
  getActiveShares,
  getShareUsers
} = require('../controllers/shareController');

const router = express.Router();

// Apply auth middleware to all sharing routes
router.use(authenticateToken);

router.post('/create', shareResource);
router.get('/shared-with-me', getSharedWithMe);
router.delete('/revoke/:id', revokeShare);
router.get('/active/:resourceType/:resourceId', getActiveShares);
router.get('/users', getShareUsers);

module.exports = router;
