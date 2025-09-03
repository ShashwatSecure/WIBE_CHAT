const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const upload = require('../config/multer');

// Message routes
router.post('/upload-chat-file', upload.chatFile.single('file'), messageController.uploadMessageFile);
router.post('/upload-file', upload.document.single('file'), messageController.uploadDocumentFile);
router.get('/', messageController.getMessages);
router.delete('/:messageId', messageController.deleteMessage);
router.delete('/', messageController.deleteMultipleMessages);
router.post('/unblur', messageController.unblurMessage);
router.post('/mark-as-seen', messageController.markAsSeen);

module.exports = router;