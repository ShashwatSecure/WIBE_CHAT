const express = require('express');
const router = express.Router();
const stickerController = require('../controllers/stickerController');

// Sticker routes
router.get('/packs', stickerController.getStickerPacks);
router.get('/pack/:identifier', stickerController.getStickerPack);

// Static sticker file serving
router.get('/download/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);
  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

module.exports = router;