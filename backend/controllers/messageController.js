  const mongoose = require('mongoose');
  const Message = require('../models/Message');
  const User = require('../models/User');
  const path = require('path');
  const fs = require('fs');

  // Upload message file
  exports.uploadMessageFile = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.status(200).json({ fileUrl, fileName: req.file.originalname });
    } catch (err) {
      console.error('Upload message file error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Upload document file
  exports.uploadDocumentFile = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.status(200).json({ fileUrl, fileName: req.file.originalname });
    } catch (err) {
      console.error('Upload document file error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Get messages between users
  exports.getMessages = async (req, res) => {
    try {
      const { senderId, receiverId } = req.query;

      if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ msg: 'Invalid user ID format' });
      }

      const messages = await Message.find({
        $or: [
          { sender: senderId, receiver: receiverId },
          { sender: receiverId, receiver: senderId }
        ]
      })
        .sort('timestamp')
        .populate('sender receiver', 'name profilePicture')
        .populate('unblurredBy', '_id')
        .select('+isDocument +imageUrl +fileType');

      res.status(200).json({ messages });
    } catch (err) {
      console.error('Fetch messages error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Delete single message
  exports.deleteMessage = async (req, res) => {
    try {
      const { messageId } = req.params;
      const { userId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ msg: 'Invalid ID format' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ msg: 'Message not found' });
      }

      // Check if user is the sender or receiver
      if (message.sender.toString() !== userId && message.receiver.toString() !== userId) {
        return res.status(403).json({ msg: 'Unauthorized to delete this message' });
      }

      // Delete associated file if exists
      if (message.imageUrl) {
        const filePath = path.join(__dirname, '..', message.imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await Message.findByIdAndDelete(messageId);

      // Emit socket event for real-time deletion
      const io = req.app.get('io');
      if (io) {
        io.to(message.sender.toString()).emit('messageDeleted', messageId);
        io.to(message.receiver.toString()).emit('messageDeleted', messageId);
      }

      res.status(200).json({ msg: 'Message deleted successfully' });
    } catch (err) {
      console.error('Delete message error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Delete multiple messages
  exports.deleteMultipleMessages = async (req, res) => {
    try {
      const { messageIds, userId } = req.body;

      if (!Array.isArray(messageIds) || messageIds.length === 0 || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ msg: 'Invalid request data' });
      }

      // Validate all message IDs
      for (const messageId of messageIds) {
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return res.status(400).json({ msg: 'Invalid message ID format' });
        }
      }

      // Get messages to check ownership and delete files
      const messages = await Message.find({ _id: { $in: messageIds } });

      for (const message of messages) {
        // Check if user is the sender or receiver
        if (message.sender.toString() !== userId && message.receiver.toString() !== userId) {
          return res.status(403).json({ msg: 'Unauthorized to delete one or more messages' });
        }

        // Delete associated file if exists
        if (message.imageUrl) {
          const filePath = path.join(__dirname, '..', message.imageUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      // Delete all messages
      await Message.deleteMany({ _id: { $in: messageIds } });

      // Emit socket events for real-time deletion
      const io = req.app.get('io');
      if (io) {
        for (const message of messages) {
          io.to(message.sender.toString()).emit('messageDeleted', message._id.toString());
          io.to(message.receiver.toString()).emit('messageDeleted', message._id.toString());
        }
      }

      res.status(200).json({ msg: 'Messages deleted successfully' });
    } catch (err) {
      console.error('Delete multiple messages error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Unblur message
  exports.unblurMessage = async (req, res) => {
    try {
      const { messageId, userId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ msg: 'Invalid ID format' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ msg: 'Message not found' });
      }

      if (!message.unblurredBy.includes(userId)) {
        message.unblurredBy.push(userId);
        await message.save();
      }

      res.status(200).json({ msg: 'Message unblurred successfully' });
    } catch (err) {
      console.error('Unblur message error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };

  // Mark messages as seen
  exports.markAsSeen = async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ msg: 'Invalid user ID format' });
      }

      const result = await Message.updateMany(
        { sender: senderId, receiver: receiverId, status: { $ne: 'seen' } },
        { $set: { status: 'seen' } }
      );

      if (result.nModified > 0) {
        const io = req.app.get('io');
        if (io) {
          io.to(senderId).emit('messagesSeen', { chatPartnerId: receiverId, senderId, receiverId });
          io.to(receiverId).emit('messagesSeen', { chatPartnerId: senderId, senderId, receiverId });
        }
      }

      // Update unreadCounts for the receiver
      await User.findByIdAndUpdate(
        receiverId,
        { $set: { [`unreadCounts.${senderId}`]: 0 } },
        { new: true }
      );

      const io = req.app.get('io');
      if (io) {
        io.to(receiverId.toString()).emit('unreadCountUpdate', { senderId, newCount: 0 });
      }

      res.status(200).json({ msg: 'Messages marked as seen' });
    } catch (err) {
      console.error('Mark as seen error:', err.message);
      res.status(500).json({ msg: 'Server Error' });
    }
  };