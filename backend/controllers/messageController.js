const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message'); // Import Message model
const ScheduledBroadcast = require('../models/ScheduledBroadcast');
const User = require('../models/User'); // Import User model
const chatStorage = multer.memoryStorage();

const uploadChatFileMiddleware = multer({ storage: chatStorage, limits: { fileSize: 15 * 1024 * 1024 * 1024 } });

const uploadMessageFile = (req, res) => {
  console.log('--- uploadMessageFile started ---');
  try {
    if (!req.file) {
      console.log('uploadMessageFile: No file received.');
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    console.log('uploadMessageFile: File received:', req.file.originalname);

    const { userId } = req.body;
    if (!userId) {
      console.log('uploadMessageFile: User ID is missing.');
      return res.status(400).json({ msg: 'User ID is required' });
    }
    console.log('uploadMessageFile: User ID:', userId);

    const filename = req.file.originalname;
    console.log('uploadMessageFile: Generated filename:', filename);

    const finalUploadDir = path.join(__dirname, '..', 'uploads', userId, 'chat');
    console.log('uploadMessageFile: Final upload directory:', finalUploadDir);

    if (!fs.existsSync(finalUploadDir)) {
      console.log('uploadMessageFile: Creating directory:', finalUploadDir);
      fs.mkdirSync(finalUploadDir, { recursive: true });
    }

    const finalPath = path.join(finalUploadDir, filename);
    console.log('uploadMessageFile: Final file path:', finalPath);

    fs.writeFile(finalPath, req.file.buffer, (err) => {
      if (err) {
        console.error('uploadMessageFile: Error writing file to disk:', err);
        return res.status(500).json({ msg: 'Error writing file to disk.', error: err.message });
      }

      console.log('uploadMessageFile: File written to disk successfully.');
      const fileSavePath = `/uploads/${userId}/chat/${filename}`;
      console.log('uploadMessageFile: File save path for DB:', fileSavePath);

      res.status(200).json({
        msg: 'File uploaded for chat successfully',
        file: {
          path: fileSavePath,
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size
        }
      });
      console.log('--- uploadMessageFile finished successfully ---');
    });

  } catch (error) {
    console.error('uploadMessageFile: CATCH BLOCK - An unexpected error occurred:', error);
    res.status(500).json({ msg: 'Server error during file upload.', error: error.message });
    console.log('--- uploadMessageFile finished with error ---');
  }
};

// Delete a single message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body; // Assuming userId is sent in the body for verification

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    // Optional: Add logic to check if the user has permission to delete this message
    // For example, only the sender can delete their message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ msg: 'You are not authorized to delete this message' });
    }

    await Message.deleteOne({ _id: messageId });
    res.status(200).json({ msg: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete multiple messages
const deleteMultipleMessages = async (req, res) => {
  try {
    const { messageIds, userId } = req.body; // messageIds is an array of message IDs

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ msg: 'No message IDs provided' });
    }

    // Optional: Add logic to ensure only senders can delete their messages
    // This is more complex for multiple messages, might need to fetch each message
    // For simplicity, we'll assume the frontend sends only deletable message IDs for the current user
    await Message.deleteMany({ _id: { $in: messageIds }, sender: userId });

    res.status(200).json({ msg: 'Messages deleted successfully' });
  } catch (error) {
    console.error('Error deleting multiple messages:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const sendBroadcastMessage = async (req, res, io) => {
  console.log('sendBroadcastMessage function entered.');
  try {
    console.log('req.body:', req.body);
    const { message, scheduledAt, senderId } = req.body;
    let recipientsData = req.body.recipients; // Can be string or already parsed by some middleware

    let parsedRecipients = [];
    if (typeof recipientsData === 'string') {
      try {
        parsedRecipients = JSON.parse(recipientsData);
        console.log('Parsed recipients from string:', parsedRecipients);
      } catch (parseError) {
        console.error('Error parsing recipients JSON string:', parseError);
        return res.status(400).json({ msg: 'Invalid recipients data format (JSON parse error)' });
      }
    } else if (Array.isArray(recipientsData)) {
      parsedRecipients = recipientsData;
      console.log('Recipients already an array:', parsedRecipients);
    } else {
      console.error('Unexpected recipients data type:', typeof recipientsData, recipientsData);
      return res.status(400).json({ msg: 'Invalid recipients data format (unexpected type)' });
    }

    // Ensure parsedRecipients is an array
    if (!Array.isArray(parsedRecipients)) {
        console.error('Recipients is not an array after processing:', parsedRecipients);
        return res.status(400).json({ msg: 'Recipients data is not an array after processing' });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ msg: 'Message content is required' });
    }

    if (parsedRecipients.length === 0 || !senderId) {
      return res.status(400).json({ msg: 'Missing required fields or no recipients selected' });
    }

    const scheduleTime = new Date(scheduledAt);
    console.log('sendBroadcastMessage: scheduleTime:', scheduleTime);
    console.log('sendBroadcastMessage: new Date():', new Date());
    console.log('sendBroadcastMessage: scheduleTime <= new Date():', scheduleTime <= new Date());

    if (isNaN(scheduleTime.getTime()) || scheduleTime <= new Date()) {
      console.log('sendBroadcastMessage: Entering immediate send block.');
      // Send immediately
      const messagesToInsert = parsedRecipients.map(recipientId => ({
        sender: senderId,
        receiver: recipientId,
        content: message,
        timestamp: new Date(),
        isBroadcast: true,
        files: [], // No files for now
      }));

      console.log('sendBroadcastMessage: messagesToInsert before saving:', messagesToInsert);
      await Message.insertMany(messagesToInsert);
      return res.status(200).json({ msg: 'Broadcast message(s) sent successfully' });
    } else {
      // Schedule for later
      console.log('sendBroadcastMessage: Entering scheduled send block.');
      const scheduledBroadcast = new ScheduledBroadcast({
        sender: senderId,
        recipients: parsedRecipients,
        message,
        scheduledAt: scheduleTime,
        files: [], // No files for now
      });

      console.log('sendBroadcastMessage: scheduledBroadcast before saving:', scheduledBroadcast);
      await scheduledBroadcast.save();

      io.emit('broadcastScheduled', scheduledBroadcast);

      return res.status(200).json({ msg: 'Broadcast message(s) scheduled successfully' });
    }
  } catch (error) {
    console.error('Error in sendBroadcastMessage:', error);
    res.status(500).json({ msg: 'Server error occurred during broadcast' });
  }
};

const getScheduledBroadcasts = async (req, res) => {
  try {
    const { userId } = req.params;
    const scheduledBroadcasts = await ScheduledBroadcast.find({ sender: userId, isSent: false }).populate('recipients', 'name username');
    res.status(200).json({ scheduledBroadcasts });
  } catch (error) {
    console.error('Error fetching scheduled broadcasts:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const cancelScheduledBroadcast = async (req, res, io) => {
  try {
    const { broadcastId } = req.params;
    const deletedBroadcast = await ScheduledBroadcast.findByIdAndDelete(broadcastId);

    if (!deletedBroadcast) {
      return res.status(404).json({ msg: 'Scheduled broadcast not found' });
    }

    io.emit('broadcastCancelled', broadcastId);

    res.status(200).json({ msg: 'Scheduled broadcast cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling scheduled broadcast:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const getBroadcastHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Fetching broadcast history for user: ${userId}`);
    const broadcastHistory = await ScheduledBroadcast.find({ sender: userId }).populate('recipients', 'name username');
    console.log('Broadcast History fetched:', broadcastHistory);
    res.status(200).json({ broadcastHistory });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  uploadMessageFile,
  deleteMessage, // Export the new function
  deleteMultipleMessages, // Export the new function
  sendBroadcastMessage,
  getScheduledBroadcasts,
  cancelScheduledBroadcast,
  getBroadcastHistory,
};