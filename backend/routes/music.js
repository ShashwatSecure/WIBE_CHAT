const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');

// Music routes
router.get('/search', musicController.searchYouTube);
router.get('/trending-songs', musicController.getTrendingSongs);
router.post('/record-played', musicController.recordPlayedSong);
router.get('/recently-played', musicController.getRecentlyPlayedSongs);
router.delete('/clear-recently-played', musicController.clearRecentlyPlayedSongs);

// JioSaavn API proxy
router.get("/search-saavn", async (req, res) => {
  const query = req.query.q;
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;

  console.log(`Backend received search request: query=${query}, limit=${limit}, offset=${offset}`);
  try {
    const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
    const data = response.data;
    console.log(`Received ${data.data.results.length} results from saavn.dev for query: ${query}`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching songs from JioSaavn (saavn.dev):", err.message);
    res.status(500).json({ error: "Error fetching songs from JioSaavn (saavn.dev)", details: err.message });
  }
});

module.exports = router;