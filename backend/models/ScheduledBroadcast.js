const mongoose = require('mongoose');

const ScheduledBroadcastSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  message: {
    type: String,
    required: true,
  },
  scheduledAt: {
    type: Date,
    required: true,
  },
  isSent: {
    type: Boolean,
    default: false,
  },
  files: [{
    filename: String,
    path: String,
  }],
});

module.exports = mongoose.model('ScheduledBroadcast', ScheduledBroadcastSchema);