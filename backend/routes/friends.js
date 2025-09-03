const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');

// Friend routes
router.post('/request', friendController.sendFriendRequest);
router.get('/pending', friendController.getPendingRequests);
router.get('/sent-requests', friendController.getSentRequests);
router.post('/respond', friendController.respondToFriendRequest);
router.post('/unfriend', friendController.unfriend);
router.get('/', friendController.getFriends);

module.exports = router;