require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cron = require('node-cron');

const axios = require('axios');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const mime = require('mime-types');

const authRouter = require('./controllers/authController');

const { createCloudFolder, getCloudFolders, getCloudFiles, deleteCloudFolder, deleteCloudFile, renameCloudFolder, getCloudStorageUsage, uploadDocument, uploadDocumentFile } = require('./controllers/cloudStorageController');
const { uploadProfilePicture, uploadSingleProfilePicture, updateUserProfile } = require('./controllers/profileController');
const { uploadMessageFile, deleteMessage, deleteMultipleMessages, sendBroadcastMessage, getScheduledBroadcasts, cancelScheduledBroadcast, getBroadcastHistory } = require('./controllers/messageController');
const uploadChatFileMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 * 1024 } });
const { searchYouTube, getTrendingSongs, recordPlayedSong, getRecentlyPlayedSongs, clearRecentlyPlayedSongs } = require('./controllers/musicController');

// Import models
const User = require('./models/User');
const OTP = require('./models/OTP');
const FriendRequest = require('./models/FriendRequest');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const CloudFile = require('./models/CloudFile');
const CloudFolder = require('./models/CloudFolder');
const BroadcastGroup = require('./models/BroadcastGroup');
const ScheduledBroadcast = require('./models/ScheduledBroadcast');

const path = require('path');
const fs = require('fs');

const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const app = express();

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

const server = http.createServer({ maxHeaderSize: 1024 * 256 }, app); // Increased header size limit to 256KB
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
  },
});

// --- Redis Adapter Setup (fixed) ---
const pubClient = createClient();
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter connected');
}).catch((err) => {
    console.error('Redis connection error:', err);
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const profileUploadsDir = path.join(__dirname, 'uploads', 'profile_pictures');
if (!fs.existsSync(profileUploadsDir)) {
  fs.mkdirSync(profileUploadsDir, { recursive: true });
}

// Use cors middleware
app.use(cors());

app.use(express.json({ limit: '100mb' }));

// Middleware to parse JSON bodies


// Multer Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ msg: err.message });
  } else if (err) {
    console.error('Generic error:', err);
    return res.status(500).json({ msg: 'An unexpected error occurred.' });
  }
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chat_app')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema and Model


// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.YOUR_EMAIL_USER,
    pass: process.env.YOUR_EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Only for development, remove in production
  }
});

// Route to download images
app.get('/api/download/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

app.use('/Wibe_Chat-stickerd', express.static(path.join(__dirname, '../frontend/Wibe_Chat stickerd')));

app.get('/api/stickers/packs', async (req, res) => {
  try {
    const contentsPath = path.resolve(__dirname, '../frontend/Wibe_Chat stickerd/contents.json');
    console.log(`Attempting to read file: ${contentsPath}`);
    const data = await fs.promises.readFile(contentsPath, 'utf8');
    console.log('Successfully read contents.json');
    const stickerData = JSON.parse(data);
    console.log('Successfully parsed contents.json');

    const stickerPacksMetadata = stickerData.sticker_packs.map(pack => ({
      name: pack.name,
      description: pack.description,
      identifier: pack.identifier,
      publisher: pack.publisher,
      publisher_email: pack.publisher_email,
      publisher_website: pack.publisher_website,
      privacy_policy_website: pack.privacy_policy_website,
      license_agreement_website: pack.license_agreement_website,
      tray_image_file: `/Wibe_Chat-stickerd/${pack.identifier}/${pack.tray_image_file}`,
    }));
    res.status(200).json(stickerPacksMetadata);
  } catch (error) {
    console.error('Error fetching sticker packs:', error);
    res.status(500).json({ msg: 'Failed to fetch sticker packs' });
  }
});

app.post('/api/messages/upload-chat-file', uploadChatFileMiddleware.single('file'), uploadMessageFile);

app.use('/api/auth', authRouter);

// JioSaavn API endpoint (saavn.dev)
app.get("/search", async (req, res) => {
  const query = req.query.q;
  const limit = req.query.limit || 50; // Default limit if not provided by frontend
  const offset = req.query.offset || 0; // Default offset if not provided by frontend

  console.log(`Backend received search request: query=${query}, limit=${limit}, offset=${offset}`);
  try {
    const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
    const data = response.data;
    console.log(`Received ${data.data.results.length} results from saavn.dev for query: ${query}`);
    res.json(data);
  } catch (err) {
    console.error("Error fetching songs from JioSaavn (saavn.dev):", err.message); // Log error message
    console.error("Full error object:", err); // Log full error object
    res.status(500).json({ error: "Error fetching songs from JioSaavn (saavn.dev)", details: err.message }); // Send error message to frontend
  }
});

app.get("/api/trending-songs", getTrendingSongs);





app.post('/api/messages/upload-file', (req, res) => {
  uploadDocument.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        console.error('Multer error in /api/messages/upload-file route:', err);
        return res.status(400).json({ msg: err.message });
      } else {
        console.error('Generic error in /api/messages/upload-file route:', err);
        return res.status(500).json({ msg: 'An unexpected error occurred during upload.' });
      }
    }
    // If no error from multer, proceed to controller
    uploadDocumentFile(req, res, io);
  });
});

// Cloud Storage Routes
app.post('/api/cloud/upload', uploadDocument.single('file'), (req, res) => uploadDocumentFile(req, res, io));

app.post('/api/cloud/folders', (req, res) => createCloudFolder(req, res, io));

app.get('/api/cloud/folders', getCloudFolders);

// Get Files Route
app.get('/api/cloud/files', getCloudFiles);

// Delete Folder Route
app.delete('/api/cloud/folders/:folderId', (req, res) => deleteCloudFolder(req, res, io));

// Delete File Route
app.delete('/api/cloud/files/:fileId', (req, res) => deleteCloudFile(req, res, io));

// Rename Folder Route
app.put('/api/cloud/folders/:folderId/rename', (req, res) => renameCloudFolder(req, res, io));

app.get('/api/user/cloud-storage-usage', getCloudStorageUsage);

// Broadcast Group Routes
app.post('/api/broadcast-groups', async (req, res) => {
  const { name, ownerId } = req.body;

  try {
    const newGroup = new BroadcastGroup({
      name,
      owner: ownerId,
    });
    await newGroup.save();

    // Add group to user's broadcastGroups array
    await User.findByIdAndUpdate(ownerId, { $push: { broadcastGroups: newGroup._id } });

    io.emit('broadcastGroupCreated', newGroup);

    res.status(201).json({ msg: 'Broadcast group created successfully', group: newGroup });
  } catch (err) {
    console.error('Create broadcast group error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/api/broadcast-groups/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const groups = await BroadcastGroup.find({ owner: userId });
    res.status(200).json({ groups });
  } catch (err) {
    console.error('Fetch broadcast groups error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.delete('/api/broadcast-groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.query; // Assuming userId is passed as a query parameter for verification

  try {
    const group = await BroadcastGroup.findOneAndDelete({ _id: groupId, owner: userId });

    if (!group) {
      return res.status(404).json({ msg: 'Broadcast group not found or you do not have permission to delete it' });
    }

    // Remove group from user's broadcastGroups array
    await User.findByIdAndUpdate(userId, { $pull: { broadcastGroups: groupId } });

    io.emit('broadcastGroupDeleted', groupId);

    res.status(200).json({ msg: 'Broadcast group deleted successfully' });
  } catch (err) {
    console.error('Delete broadcast group error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Multer Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ msg: err.message });
  } else if (err) {
    console.error('Generic error:', err);
    return res.status(500).json({ msg: 'An unexpected error occurred.' });
  }
  next();
});

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/profile_pictures', express.static(path.join(__dirname, 'uploads', 'profile_pictures')));

app.get('/api/notifications', async (req, res) => {
  const { userId } = req.query;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ msg: 'Invalid User ID format' });
  }

  try {
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    console.log('Backend: Notifications fetched for user:', userId, notifications);
    res.status(200).json({ notifications });
  } catch (err) {
    console.error('Fetch notifications error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- Clear All Notifications Route ---
app.delete('/api/notifications/clear-all', async (req, res) => {
  const { userId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ msg: 'Invalid User ID format' });
  }

  try {
    const result = await Notification.deleteMany({ user: userId });
    if (result.deletedCount > 0) {
      res.status(200).json({ msg: `${result.deletedCount} notifications cleared successfully.` });
    } else {
      res.status(404).json({ msg: 'No notifications found to clear for this user.' });
    }
  } catch (err) {
    console.error('Clear all notifications error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});











app.get('/api/stickers/pack/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const contentsPath = path.resolve(__dirname, '../frontend/Wibe_Chat stickerd/contents.json');
    const data = await fs.promises.readFile(contentsPath, 'utf8');
    const stickerData = JSON.parse(data);

    const foundPack = stickerData.sticker_packs.find(pack => pack.identifier === identifier);

    if (!foundPack) {
      return res.status(404).json({ msg: 'Sticker pack not found' });
    }

    const baseUrl = `/Wibe_Chat-stickerd/${foundPack.identifier}/`;
    const fullPack = {
      ...foundPack,
      tray_image_file: `${baseUrl}${foundPack.tray_image_file}`,
      stickers: foundPack.stickers.map(sticker => ({
        ...sticker,
        image_file: `${baseUrl}${sticker.image_file}`,
      })),
    };

    res.status(200).json(fullPack);
  } catch (error) {
    console.error('Error fetching single sticker pack:', error);
    res.status(500).json({ msg: 'Failed to fetch sticker pack' });
  }
});

// --- User Profile Route ---
app.put('/api/user/profile', uploadProfilePicture.single('profilePicture'), updateUserProfile);
app.post('/api/upload-single-file', uploadSingleProfilePicture.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded.' });
    }
    res.json({ filePath: `/uploads/profile_pictures/${req.file.filename}` });
});

// --- Block/Unblock User Route ---
app.post('/api/user/block', async (req, res) => {
  const { blockerId, blockedId } = req.body;

  try {
    const blocker = await User.findById(blockerId);
    const blocked = await User.findById(blockedId);

    if (!blocker || !blocked) {
      return res.status(404).json({ msg: 'Blocker or Blocked user not found' });
    }

    // Initialize blockedUsers and connectivityStatus if they don't exist
    if (!blocker.blockedUsers) {
      blocker.blockedUsers = [];
    }
    if (!blocker.connectivityStatus) {
      blocker.connectivityStatus = [];
    }

    const blockedIndex = blocker.blockedUsers.indexOf(blockedId);

    let action = '';
    if (blockedIndex === -1) {
      // User is not blocked, so block them
      blocker.blockedUsers.push(blockedId);
      action = 'blocked';
    } else {
      // User is already blocked, so unblock them
      blocker.blockedUsers.splice(blockedIndex, 1);
      action = 'unblocked';
    }
    await blocker.save();

    // Fetch updated block status for both users
    const user1 = await User.findById(blockerId);
    const user2 = await User.findById(blockedId);

    const user1BlockedUser2 = user1.blockedUsers.includes(blockedId);
    const user2BlockedUser1 = user2.blockedUsers.includes(blockerId);

    // Emit socket event to both users
    io.to(blockerId).emit('blockStatusUpdate', { user1Id: blockerId, user2Id: blockedId, user1BlockedUser2, user2BlockedUser1 });
    io.to(blockedId).emit('blockStatusUpdate', { user1Id: blockerId, user2Id: blockedId, user1BlockedUser2, user2BlockedUser1 });

    res.status(200).json({ msg: `User ${action} successfully` });

  } catch (err) {
    console.error('Block/Unblock user error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- Get Block Status Route ---
app.get('/api/user/blockStatus', async (req, res) => {
  const { user1Id, user2Id } = req.query;

  try {
    const user1 = await User.findById(user1Id);
    const user2 = await User.findById(user2Id);

    if (!user1 || !user2) {
      return res.status(404).json({ msg: 'One or both users not found' });
    }

    // Initialize blockedUsers if they don't exist
    if (!user1.blockedUsers) {
      user1.blockedUsers = [];
    }
    if (!user2.blockedUsers) {
      user2.blockedUsers = [];
    }

    const user1BlockedUser2 = user1.blockedUsers.includes(user2Id);
    const user2BlockedUser1 = user2.blockedUsers.includes(user1Id);

    res.status(200).json({ user1BlockedUser2, user2BlockedUser1 });

  } catch (err) {
    console.error('Get block status error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- User Search Route ---
app.get('/api/user/search', async (req, res) => {
  const { email, username, name } = req.query;

  if (!email && !username && !name) {
    return res.status(400).json({ msg: 'Email, username, or name query parameter is required' });
  }

  try {
    const query = { $or: [] };

    if (email) {
      query.$or.push({ email: { $regex: email, $options: 'i' } });
    }
    if (username) {
      query.$or.push({ username: { $regex: username, $options: 'i' } });
    }
    if (name) {
      query.$or.push({ name: { $regex: name, $options: 'i' } });
    }

    // Agar koi query parameter nahi hai, to error return karein
    if (query.$or.length === 0) {
      return res.status(400).json({ msg: 'Email, username, or name query parameter is required' });
    }

    const users = await User.find(query).select('-password');

    if (users.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({ users });
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- Friend Request Routes ---
app.post('/api/friends/request', async (req, res) => {
  console.log('Received friend request to /api/friends/request'); // Added for debugging
  const { senderId, receiverEmail } = req.body;

  try {
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

    const newRequest = new FriendRequest({ sender: sender._id, receiver: receiver._id });
    await newRequest.save();
    console.log(`Emitting newFriendRequest to room: ${receiver._id.toString()} with request:`, newRequest);
    io.to(receiver._id.toString()).emit('newFriendRequest', newRequest);

    res.status(200).json({ msg: 'Friend request sent successfully' });

  } catch (err) {
    console.error('Friend request error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/api/friends/pending', async (req, res) => {
  const { userId } = req.query;

  try {
    const pendingRequests = await FriendRequest.find({ receiver: userId, status: 'pending' }).populate('sender', 'name email profilePicture');
    console.log('Pending requests being sent to frontend:', pendingRequests); // New log
    res.status(200).json({ pendingRequests });
  } catch (err) {
    console.error('Fetch pending requests error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/api/friends/sent-requests', async (req, res) => {
  const { userId } = req.query;

  try {
    const sentRequests = await FriendRequest.find({ sender: userId, status: 'pending' }).select('receiver');
    const sentRequestIds = sentRequests.map(request => request.receiver);
    res.status(200).json({ sentRequestIds });
  } catch (err) {
    console.error('Fetch sent requests error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/api/friends/respond', async (req, res) => {
  const { requestId, status: rawStatus } = req.body;
  const status = rawStatus.trim().toLowerCase();

  try {
    const friendRequest = await FriendRequest.findById(requestId).populate('sender receiver');
    console.log('Friend request object after populate:', friendRequest);

    if (!friendRequest) {
      console.log('Friend request not found for ID:', requestId);
      return res.status(404).json({ msg: 'Friend request not found' });
    }

    friendRequest.status = status;
    await friendRequest.save();
    console.log('Friend request after save:', friendRequest);
    console.log(`Friend request ${requestId} updated to status: ${status}`);
    console.log('Backend: Status value before if/else if:', status);

    if (status === 'accepted') {
      const notification = new Notification({
        user: friendRequest.sender._id, // The person whose request was accepted
        type: 'friend_request_accepted',
        message: `${friendRequest.receiver.name} has accepted your friend request.`
      });
      try {
        await notification.save();
        console.log('Backend: Notification saved successfully for user:', friendRequest.sender._id);
      } catch (saveError) {
        console.error('Backend: Error saving friendRequestAccepted notification:', saveError);
      }
      console.log(`Backend: Attempting to emit 'friendRequestAccepted' to sender (ID: ${friendRequest.sender._id.toString()}) with receiverName: ${friendRequest.receiver.name}`);
      io.to(friendRequest.sender._id.toString()).emit('friendRequestAccepted', { senderName: friendRequest.receiver.name });
      // Ensure reciprocal friendship is established
      // Check if a reciprocal accepted friendship already exists
      const existingReciprocalFriendship = await FriendRequest.findOne({
        $or: [
          { sender: friendRequest.receiver, receiver: friendRequest.sender, status: 'accepted' },
          { sender: friendRequest.sender, receiver: friendRequest.receiver, status: 'accepted' }
        ]
      });

      if (!existingReciprocalFriendship) {
        // If no reciprocal accepted friendship exists, create one
        const reciprocalRequest = new FriendRequest({
          sender: friendRequest.receiver, // The receiver of the original request is the sender of the reciprocal
          receiver: friendRequest.sender, // The sender of the original request is the receiver of the reciprocal
          status: 'accepted'
        });
        await reciprocalRequest.save();
        console.log('Reciprocal friend request created:', reciprocalRequest);
      } else {
        console.log('Reciprocal friend request already exists or is accepted:', existingReciprocalFriendship);
      }
    } else if (status === 'declined') {
      console.log('Backend: Inside declined status block.');
      console.log(`Attempting to emit friendRequestDeclined to sender: ${friendRequest.sender._id.toString()} with receiverName: ${friendRequest.receiver.name}`);
      console.log(`friendRequestDeclined event emitted to sender (ID: ${friendRequest.sender._id.toString()}) from receiver (ID: ${friendRequest.receiver._id.toString()})`);
      io.to(friendRequest.sender._id.toString()).emit('friendRequestDeclined', { receiverName: friendRequest.receiver.name });

      // Create a notification for the sender of the friend request
      const notification = new Notification({
        user: friendRequest.sender._id, // The person whose request was declined
        type: 'friend_request_declined',
        message: `${friendRequest.receiver.name} has declined your friend request.`,
      });
      try {
        await notification.save();
        console.log('Backend: Saved friendRequestDeclined notification:', notification);
      } catch (saveError) {
        console.error('Backend: Error saving friendRequestDeclined notification:', saveError);
      }
    }

    res.status(200).json({ msg: `Friend request ${status}` });

  } catch (err) {
    console.error('Respond to friend request error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.post('/api/friends/unfriend', async (req, res) => {
  const { userId, friendId } = req.body;

  try {
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
});

app.get('/api/friends', async (req, res) => {
  const { userId } = req.query;
  console.log('Fetching friends for userId:', userId);

  try {
    const friendships = await FriendRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted',
    }).populate('sender receiver', 'name email username profilePicture online lastSeen');
    console.log('Fetched friendships in /api/friends:', friendships); // New log

    const uniqueFriendsMap = new Map(); // Use a Map to store unique friends by their _id

    friendships.forEach(friendship => {
      let friendUser = null; // Initialize to null

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
        lastMessage: null, // Will be populated later
        lastMessageTimestamp: null, // Will be populated later
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
          lastMessageId: { $first: "$_id" } // Add lastMessageId
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
    console.error('Fetch friends error for userId:', userId, err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

app.get('/api/user/unreadCounts', async (req, res) => {
  try {
    const { userId } = req.query;
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          status: { $ne: 'seen' } // Assuming 'seen' status means read
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          senderId: '$_id',
          count: 1
        }
      }
    ]);

    const formattedUnreadCounts = unreadCounts.reduce((acc, item) => {
      acc[item.senderId.toString()] = item.count;
      return acc;
    }, {});

    res.json(formattedUnreadCounts);
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/messages', async (req, res) => {
  const { senderId, receiverId } = req.query;

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    }).sort('timestamp').populate('sender receiver', 'name profilePicture').populate('unblurredBy', '_id').select('+isDocument +imageUrl +fileType');
    console.log('Fetched messages with unblurredBy:', messages); // New log

    res.status(200).json({ messages });
  } catch (err) {
    console.error('Fetch messages error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});


// --- Delete Multiple Messages Route ---
// --- Delete Multiple Messages Route ---
app.delete('/api/messages/delete-multiple', deleteMultipleMessages);

// --- Delete Message Route ---
app.delete('/api/messages/:messageId', deleteMessage);

app.get('/api/music/search', searchYouTube);

app.post('/api/music/record-played', recordPlayedSong);
app.get('/api/music/recently-played', getRecentlyPlayedSongs);
app.delete('/api/music/clear-recently-played', clearRecentlyPlayedSongs); // New route to clear recently played songs

app.post('/api/broadcast/send', multer().none(), (req, res) => sendBroadcastMessage(req, res, io));

app.get('/api/broadcast/scheduled/:userId', getScheduledBroadcasts);
app.delete('/api/broadcast/scheduled/:broadcastId', (req, res) => cancelScheduledBroadcast(req, res, io));
app.get('/api/broadcast/history/:userId', getBroadcastHistory);

// --- Unblur Message Route ---
app.post('/api/messages/unblur', async (req, res) => {
  const { messageId, userId } = req.body;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    if (!message.unblurredBy.includes(userId)) {
      console.log('Before unblur save, unblurredBy:', message.unblurredBy); // New log
      message.unblurredBy.push(userId);
      await message.save();
      console.log('After unblur save, unblurredBy:', message.unblurredBy); // New log
    }
    res.status(200).json({ msg: 'Message unblurred successfully' });
  } catch (err) {
    console.error('Unblur message error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- Mark Messages as Seen Route ---
app.post('/api/messages/mark-as-seen', async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    const result = await Message.updateMany(
      { sender: senderId, receiver: receiverId, status: { $ne: 'seen' } },
      { $set: { status: 'seen' } }
    );

    if (result.nModified > 0) {
        // Notify both users that messages have been seen
        io.to(senderId).emit('messagesSeen', { chatPartnerId: receiverId, senderId: senderId, receiverId: receiverId });
        io.to(receiverId).emit('messagesSeen', { chatPartnerId: senderId, senderId: senderId, receiverId: receiverId });
    }

    // Update unreadCounts for the receiver
    await User.findByIdAndUpdate(
      receiverId,
      { $set: { [`unreadCounts.${senderId}`]: 0 } },
      { new: true }
    );
    io.to(receiverId.toString()).emit('unreadCountUpdate', { senderId, newCount: 0 });

    res.status(200).json({ msg: 'Messages marked as seen' });
  } catch (err) {
    console.error('Mark as seen error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Socket.IO Server
let activeUsers = [];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('auth', async (userId) => {
    socket.join(userId);
    socket.userId = userId; // Store userId directly on the socket object
    console.log(`AUTH: Socket ${socket.id} - Setting socket.userId to: ${socket.userId}`); // Detailed log
    await User.findByIdAndUpdate(userId, { online: true });
    io.emit('userOnline', userId);
    console.log(`Client ${socket.id} authenticated and joined room ${userId}`);
  });

  socket.on('sendMessage', async (data) => {
    const { senderId, receiverId, content, imageUrl, tempId, isDocument, fileType } = data;

    const receiverUser = await User.findById(receiverId);
    if (receiverUser && receiverUser.blockedUsers.includes(senderId)) {
      return; // Do not send message if sender is blocked
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      imageUrl,
      isDocument, // Add isDocument field
      fileType: fileType, // Save the file type
      status: 'sent',
    });
    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'name profilePicture').populate('receiver', 'name profilePicture');
    populatedMessage.isDocument = isDocument; // Ensure isDocument is included in populated message
    populatedMessage.fileType = newMessage.fileType; // Get fileType directly from the saved message

    console.log('Populated Message before emitting:', populatedMessage);
    // Send the message to the receiver
    io.to(receiverId).emit('newMessage', populatedMessage);
    // Confirm the message to the sender to replace the temporary one
    io.to(senderId).emit('messageConfirmed', { tempId, message: populatedMessage });

    // Handle 'delivered' status
    const receiverSockets = await io.in(receiverId).allSockets();
    if (receiverSockets.size > 0) {
        await Message.findByIdAndUpdate(newMessage._id, { status: 'delivered' });
        // Notify both users to update the status
        io.to(senderId).emit('messageStatusUpdate', { messageId: newMessage._id, status: 'delivered', senderId: senderId, receiverId: receiverId });
        io.to(receiverId).emit('messageStatusUpdate', { messageId: newMessage._id, status: 'delivered', senderId: senderId, receiverId: receiverId });
    }

    await User.findByIdAndUpdate(
      receiverId,
      { $inc: { [`unreadCounts.${senderId}`]: 1 } },
      { new: true }
    );
    io.to(receiverId.toString()).emit('unreadCountUpdate', { senderId, newCount: (receiverUser.unreadCounts.get(senderId.toString()) || 0) + 1 });
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    io.to(receiverId).emit('typing', { senderId });
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    io.to(receiverId).emit('stopTyping', { senderId });
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      await User.findByIdAndUpdate(socket.userId, { online: false, lastSeen: new Date() });
      io.emit('userOffline', socket.userId);
      console.log(`User ${socket.userId} disconnected and set to offline.`);
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

cron.schedule('* * * * *', async () => {
  console.log('Running cron job to send scheduled broadcasts');
  const now = new Date();
  const broadcasts = await ScheduledBroadcast.find({ scheduledAt: { $lte: now }, isSent: false });

  for (const broadcast of broadcasts) {
    const messages = broadcast.recipients.map(recipientId => ({
      sender: broadcast.sender,
      receiver: recipientId,
      content: broadcast.message,
      files: broadcast.files, // Add this line
      timestamp: new Date(),
      isBroadcast: true,
    }));

    await Message.insertMany(messages);
    broadcast.isSent = true;
    await broadcast.save();
    io.emit('broadcastSent', broadcast);
    console.log(`Sent scheduled broadcast ${broadcast._id}`);
  }
});

app.get('/api/broadcast/history/:userId', getBroadcastHistory);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
});

