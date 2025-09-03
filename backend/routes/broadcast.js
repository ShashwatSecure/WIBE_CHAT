const express = require('express');
const router = express.Router();
const broadcastController = require('../controllers/broadcastController');

// Broadcast routes
router.post('/send', broadcastController.sendBroadcastMessage);
router.get('/scheduled/:userId', broadcastController.getScheduledBroadcasts);
router.delete('/scheduled/:broadcastId', broadcastController.cancelScheduledBroadcast);
router.get('/history/:userId', broadcastController.getBroadcastHistory);

// Broadcast group routes
router.post('/groups', broadcastController.createBroadcastGroup);
router.get('/groups/:userId', broadcastController.getBroadcastGroups);
router.delete('/groups/:groupId', broadcastController.deleteBroadcastGroup);

module.exports = router;