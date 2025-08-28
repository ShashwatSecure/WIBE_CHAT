const mongoose = require('mongoose');

const RecentlyPlayedSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  songId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  playedAt: {
    type: Date,
    default: Date.now,
  },
});

// Optional: Add an index for faster lookups by user and playedAt
RecentlyPlayedSchema.index({ userId: 1, playedAt: -1 });

const RecentlyPlayed = mongoose.model('RecentlyPlayed', RecentlyPlayedSchema);

module.exports = RecentlyPlayed;