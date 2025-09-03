const express = require('express');
const router = express.Router();

// Import all route files
router.use('/auth', require('./auth'));
router.use('/cloud', require('./cloud'));
router.use('/user', require('./user'));
router.use('/messages', require('./messages'));
router.use('/friends', require('./friends'));
router.use('/notifications', require('./notifications'));
router.use('/music', require('./music'));
router.use('/broadcast', require('./broadcast'));
router.use('/stickers', require('./stickers'));

module.exports = router;