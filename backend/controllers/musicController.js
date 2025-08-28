const { exec } = require('child_process');
const sharp = require('sharp');
const axios = require('axios'); // Ensure axios is available for thumbnail fetching
const RecentlyPlayed = require('../models/RecentlyPlayed'); // Import the new model

const searchYouTube = async (req, res) => {
  console.log('searchYouTube function called.');
  const { query, offset = 0 } = req.query; // Add offset

  if (!query) {
    return res.status(400).json({ message: 'Search query is required.' });
  }

  try {
    const command = `"C:/Users/krold/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe" --flat-playlist --print-json "ytsearch:${query}"`;

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        console.error(`yt-dlp stdout: ${stdout}`);
        console.error(`yt-dlp stderr: ${stderr}`);
        return res.status(500).json({ message: 'Error searching YouTube', error: error.message });
      }
      console.log(`yt-dlp stdout: ${stdout}`);
      if (stderr) {
        console.warn(`yt-dlp stderr: ${stderr}`);
      }

      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      const allItems = lines.map(line => JSON.parse(line));

      const itemsToProcess = allItems; // Process all items

      const itemsWithColors = await Promise.all(itemsToProcess.map(async (item) => {
        let dominantColor = '#ffffff'; // Default to white
        const thumbnailUrl = item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0].url : null;

        if (thumbnailUrl) {
          console.log('Thumbnail URL:', thumbnailUrl);
          try {
            const imageResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
            console.log('Image fetched successfully. Size:', imageResponse.data.length);
            console.log('Image response status:', imageResponse.status);
            const sharpImage = sharp(imageResponse.data);
            console.log('Sharp image instance created.');
            const buffer = await sharpImage.resize(1, 1).raw().toBuffer();
            const r = buffer[0];
            const g = buffer[1];
            const b = buffer[2];

            // Function to adjust color for background (darken and add transparency)
            const adjustColorForBackground = (r, g, b, darkenFactor = 0.3, alpha = 0.7) => {
              const newR = Math.round(r * (1 - darkenFactor));
              const newG = Math.round(g * (1 - darkenFactor));
              const newB = Math.round(b * (1 - darkenFactor));
              return `rgba(${newR}, ${newG}, ${newB}, ${alpha})`;
            };

            dominantColor = adjustColorForBackground(r, g, b, 0.3, 0.7); // Darken by 30% and 70% opacity
            console.log(`Dominant color (adjusted): ${dominantColor}`);
          } catch (colorError) {
            console.warn('Could not extract dominant color for thumbnail:', colorError.message);
          }
        }

        return {
          id: { videoId: item.id },
          snippet: {
            title: item.title,
            channelTitle: item.channel,
            thumbnails: { default: { url: thumbnailUrl } },
          },
          dominantColor,
        };
      }));

      console.log(`Backend sending ${itemsWithColors.length} items, total results from yt-dlp: ${allItems.length}`);
      res.json({ items: itemsWithColors, totalResults: allItems.length }); // Also return total results for frontend to know if there are more
    });
  } catch (error) {
    console.error('Error searching YouTube:', error.message);
    res.status(500).json({ message: 'Error searching YouTube', error: error.message });
  }
};



const getTrendingSongs = async (req, res) => {
  try {
    const saavnApiUrl = 'https://saavn.dev/modules?language=hindi&category=charts';
    const response = await axios.get(saavnApiUrl);
    // Assuming the trending songs are in response.data.data.charts[0].songs
    const trendingSongs = response.data.data.charts[0]?.songs || [];
    res.json({ data: { results: trendingSongs, total: trendingSongs.length, start: 0 } });
  } catch (error) {
    console.error('Error fetching trending songs from Saavn API:', error.message);
    if (error.response) {
      console.error('Saavn API Response Status:', error.response.status);
      console.error('Saavn API Response Data:', error.response.data);
    }
    res.status(500).json({ message: 'Error fetching trending songs', error: error.message });
  }
};

const mongoose = require('mongoose'); // Add this line

const recordPlayedSong = async (req, res) => {
  const { userId, songId, name, artist, imageUrl } = req.body;

  try {
    const userObjectId = new mongoose.Types.ObjectId(userId); // Convert userId to ObjectId

    // Remove existing entry for this song by this user to ensure it's always at the top
    await RecentlyPlayed.deleteOne({ userId: userObjectId, songId }); // Use userObjectId

    const newPlayed = new RecentlyPlayed({
      userId: userObjectId, // Use userObjectId
      songId,
      name,
      artist,
      imageUrl,
    });
    await newPlayed.save();

    // Keep only the latest 50 songs for the user
    const userPlayedSongs = await RecentlyPlayed.find({ userId }).sort({ playedAt: -1 });
    if (userPlayedSongs.length > 50) {
      const songsToRemove = userPlayedSongs.slice(50);
      const idsToRemove = songsToRemove.map(song => song._id);
      await RecentlyPlayed.deleteMany({ _id: { $in: idsToRemove } });
    }

    res.status(200).json({ message: 'Song recorded as played' });
  } catch (error) {
    console.error('Error recording played song:', error);
    res.status(500).json({ message: 'Error recording played song', error: error.message });
  }
};

const getRecentlyPlayedSongs = async (req, res) => {
  const { userId } = req.query;

  try {
    const recentlyPlayed = await RecentlyPlayed.find({ userId }).sort({ playedAt: -1 }).limit(50);
    res.status(200).json({ recentlyPlayed });
  } catch (error) {
    console.error('Error fetching recently played songs:', error);
    res.status(500).json({ message: 'Error fetching recently played songs', error: error.message });
  }
};

const clearRecentlyPlayedSongs = async (req, res) => {
  try {
    await RecentlyPlayed.deleteMany({}); // Delete all documents
    res.status(200).json({ message: 'Recently played songs cleared successfully' });
  } catch (error) {
    console.error('Error clearing recently played songs:', error);
    res.status(500).json({ message: 'Error clearing recently played songs', error: error.message });
  }
};

module.exports = { searchYouTube, getTrendingSongs, recordPlayedSong, getRecentlyPlayedSongs, clearRecentlyPlayedSongs };

