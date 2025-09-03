const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../config/multer');

// User routes
router.put('/profile', upload.profileUpload.single('profilePicture'), userController.updateUserProfile);
router.post('/upload-single-file', upload.profileUpload.single('image'), userController.uploadSingleFile);
router.post('/block', userController.blockUser);
router.get('/blockStatus', userController.getBlockStatus);
router.get('/search', userController.searchUsers);
router.get('/unreadCounts', userController.getUnreadCounts);
router.get('/cloud-storage-usage', userController.getCloudStorageUsage);
router.get('/:userId', userController.getUserById);
router.get('/:userId/status', userController.getUserStatus);

module.exports = router;