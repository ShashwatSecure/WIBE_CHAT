const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Notification routes
router.get('/', notificationController.getNotifications);
router.delete('/clear-all', notificationController.clearAllNotifications);

module.exports = router;