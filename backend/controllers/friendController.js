const mongoose = require('mongoose');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

// Send friend request
exports.sendFriendRequest = async (req, res) => {
  try {
    const { senderId, receiverEmail } = req.body;

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ msg: 'Invalid sender ID format' });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findOne({ email: receiverEmail });

    if (!sender || !receiver) {
      return res.status(404).json({ msg: 'Sender or Receiver not found' });
    }

    if (sender._id.equals(receiver._id)) {
      return res.status(400).json({ msg: 'Cannot send friend request to yourself' });
    }

    // Check if request already exists or is accepted
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: sender._id, receiver: receiver._id },
        { sender: receiver._id, receiver: sender._id, status: 'pending' }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ msg: 'Friend request already sent' });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({ msg: 'Already friends' });
      }
    }

    const newRequest = new FriendRequest({ 
      sender: sender._id, 
      receiver: receiver._id 
    });
    await newRequest.save();

    // Populate the request for the socket event
    const populatedRequest = await FriendRequest.findById(newRequest._id)
      .populate('sender', 'name email profilePicture')
      .populate('receiver', 'name email profilePicture');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(receiver._id.toString()).emit('newFriendRequest', populatedRequest);
    }

    res.status(200).json({ msg: 'Friend request sent successfully' });

  } catch (err) {
    console.error('Friend request error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get pending friend requests
exports.getPendingRequests = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const pendingRequests = await FriendRequest.find({ 
      receiver: userId, 
      status: 'pending' 
    }).populate('sender', 'name email profilePicture');

    res.status(200).json({ pendingRequests });
  } catch (err) {
    console.error('Fetch pending requests error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get sent friend requests
exports.getSentRequests = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const sentRequests = await FriendRequest.find({ 
      sender: userId, 
      status: 'pending' 
    }).select('receiver');

    const sentRequestIds = sentRequests.map(request => request.receiver);
    res.status(200).json({ sentRequestIds });
  } catch (err) {
    console.error('Fetch sent requests error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Respond to friend request
exports.respondToFriendRequest = async (req, res) => {
  try {
    const { requestId, status: rawStatus } = req.body;
    const status = rawStatus.trim().toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ msg: 'Invalid request ID format' });
    }

    const friendRequest = await FriendRequest.findById(requestId)
      .populate('sender receiver', 'name email profilePicture');

    if (!friendRequest) {
      return res.status(404).json({ msg: 'Friend request not found' });
    }

    friendRequest.status = status;
    await friendRequest.save();

    const io = req.app.get('io');

    if (status === 'accepted') {
      // Create notification for the sender
      const notification = new Notification({
        user: friendRequest.sender._id,
        type: 'friend_request_accepted',
        message: `${friendRequest.receiver.name} has accepted your friend request.`
      });
      await notification.save();

      // Create reciprocal friendship
      const reciprocalRequest = new FriendRequest({
        sender: friendRequest.receiver._id,
        receiver: friendRequest.sender._id,
        status: 'accepted'
      });
      await reciprocalRequest.save();

      // Emit socket event
      if (io) {
        io.to(friendRequest.sender._id.toString()).emit('friendRequestAccepted', { 
          senderName: friendRequest.receiver.name 
        });
      }

    } 
    else if (status === 'declined') {
      // Create notification for the sender
      const notification = new Notification({
        user: friendRequest.sender._id,
        type: 'friend_request_declined',
        message: `${friendRequest.receiver.name} has declined your friend request.`
      });
      await notification.save();

      // Emit socket event
      if (io) {
        io.to(friendRequest.sender._id.toString()).emit('friendRequestDeclined', { 
          receiverName: friendRequest.receiver.name 
        });
      }
    }

    res.status(200).json({ msg: `Friend request ${status}` });

  } catch (err) {
    console.error('Respond to friend request error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Unfriend user
exports.unfriend = async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    // Remove friendship from both sides
    await FriendRequest.deleteMany({
      $or: [
        { sender: userId, receiver: friendId, status: 'accepted' },
        { sender: friendId, receiver: userId, status: 'accepted' }
      ]
    });

    res.status(200).json({ msg: 'User unfriended successfully' });
  } catch (err) {
    console.error('Unfriend error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get friends list
exports.getFriends = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const friendships = await FriendRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted',
    }).populate('sender receiver', 'name email username profilePicture online lastSeen');

    const uniqueFriendsMap = new Map();

    friendships.forEach(friendship => {
      let friendUser = null;

      // Check if sender exists and is the current user
      if (friendship.sender && friendship.sender._id && friendship.sender._id.toString() === userId) {
        friendUser = friendship.receiver;
      }
      // Check if receiver exists and is the current user
      else if (friendship.receiver && friendship.receiver._id && friendship.receiver._id.toString() === userId) {
        friendUser = friendship.sender;
      }

      // Ensure friendUser is not null and is not the current user
      if (friendUser && friendUser._id && friendUser._id.toString() !== userId) {
        uniqueFriendsMap.set(friendUser._id.toString(), friendUser);
      }
    });

    const uniqueFriendsArray = Array.from(uniqueFriendsMap.values());

    const friendList = await Promise.all(uniqueFriendsArray.map(async friendUser => {
      return {
        ...friendUser.toObject(),
        lastMessage: null,
        lastMessageTimestamp: null,
      };
    }));

    // Fetch last messages for all friends in a single query
    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { receiver: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
              then: "$receiver",
              else: "$sender"
            }
          },
          lastMessage: { $first: "$content" },
          lastMessageTimestamp: { $first: "$timestamp" },
          lastMessageId: { $first: "$_id" }
        }
      }
    ]);

    const lastMessagesMap = new Map(lastMessages.map(msg => [msg._id.toString(), msg]));

    const finalFriendList = await Promise.all(friendList.map(async friend => {
      const messageInfo = lastMessagesMap.get(friend._id.toString());
      let lastMessageStatus = null;
      
      if (messageInfo && messageInfo.lastMessageId) {
        const lastMessageDoc = await Message.findById(messageInfo.lastMessageId);
        if (lastMessageDoc) {
          lastMessageStatus = lastMessageDoc.status;
        }
      }
      
      return {
        ...friend,
        lastMessage: messageInfo ? messageInfo.lastMessage : null,
        lastMessageTimestamp: messageInfo ? messageInfo.lastMessageTimestamp : null,
        lastMessageId: messageInfo ? messageInfo.lastMessageId : null,
        lastMessageStatus: lastMessageStatus,
      };
    }));

    res.status(200).json({ friends: finalFriendList });
  } catch (err) {
    console.error('Fetch friends error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Check friendship status
exports.checkFriendshipStatus = async (req, res) => {
  try {
    const { userId, friendId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const friendship = await FriendRequest.findOne({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId }
      ],
      status: 'accepted'
    });

    res.status(200).json({ 
      isFriend: !!friendship,
      friendship: friendship || null
    });
  } catch (err) {
    console.error('Check friendship status error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Cancel friend request
exports.cancelFriendRequest = async (req, res) => {
  try {
    const { requestId, userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }

    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ msg: 'Friend request not found' });
    }

    if (friendRequest.sender.toString() !== userId) {
      return res.status(403).json({ msg: 'Unauthorized to cancel this request' });
    }

    await FriendRequest.findByIdAndDelete(requestId);

    res.status(200).json({ msg: 'Friend request cancelled successfully' });
  } catch (err) {
    console.error('Cancel friend request error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};