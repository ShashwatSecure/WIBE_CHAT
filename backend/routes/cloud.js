const express = require('express');
const router = express.Router();
const cloudController = require('../controllers/cloudStorageController');
const upload = require('../config/multer');

// Cloud storage routes
router.post('/upload', upload.document.single('file'), cloudController.uploadDocumentFile);
router.post('/folders', cloudController.createCloudFolder);
router.get('/folders', cloudController.getCloudFolders);
router.get('/files', cloudController.getCloudFiles);
router.delete('/folders/:folderId', cloudController.deleteCloudFolder);
router.delete('/files/:fileId', cloudController.deleteCloudFile);
router.put('/folders/:folderId/rename', cloudController.renameCloudFolder);
router.get('/storage-usage', cloudController.getCloudStorageUsage);

module.exports = router;