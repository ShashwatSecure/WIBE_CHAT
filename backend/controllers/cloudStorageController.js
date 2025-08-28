const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Import Models
const User = require('../models/User');
const CloudFolder = require('../models/CloudFolder');
const CloudFile = require('../models/CloudFile');

// Multer storage configuration - Save to a general uploads directory first
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const uploadDocument = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 * 1024 } });

// Controller functions
exports.uploadDocumentFile = async (req, res, io) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }

  const { userId, folderId } = req.body;
  const { originalname, mimetype, size, filename, path: tempPath } = req.file;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      // Clean up the uploaded file if userId is invalid
      fs.unlinkSync(tempPath);
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const user = await User.findById(userId);
    if (!user) {
      // Clean up the uploaded file if user is not found
      fs.unlinkSync(tempPath);
      return res.status(404).json({ msg: 'User not found' });
    }

    // Base path for the user's cloud storage
    let finalUploadDir = path.join(__dirname, '..', 'uploads', userId, 'cloudstorage');
    let dbPath = `/uploads/${userId}/cloudstorage/${filename}`;

    // If a folder is specified, append it to the path
    if (folderId && folderId !== 'null') {
      try {
        const folder = await CloudFolder.findById(folderId);
        if (folder) {
          finalUploadDir = path.join(finalUploadDir, folder.name);
          dbPath = `/uploads/${userId}/cloudstorage/${folder.name}/${filename}`;
        }
      } catch (error) {
        console.error('Error fetching folder for file path construction:', error);
      }
    }

    // Create the final directory if it doesn't exist
    if (!fs.existsSync(finalUploadDir)) {
      fs.mkdirSync(finalUploadDir, { recursive: true });
    }

    // Move the file from the temporary path to the final path
    const finalPath = path.join(finalUploadDir, filename);
    fs.renameSync(tempPath, finalPath);

    const newFile = new CloudFile({
      name: originalname,
      owner: userId,
      folder: folderId === 'null' ? null : folderId,
      fileType: mimetype,
      size: size,
      path: dbPath, // Save the web-accessible path
    });

    await newFile.save();

    user.cloudStorageUsed += size;
    await user.save();

    io.to(userId).emit('newCloudFile', newFile);

    return res.status(200).json({ msg: 'File uploaded successfully', file: newFile });
  } catch (err) {
    // Clean up the uploaded file in case of an error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Error uploading file:', err.message);
    return res.status(500).json({ msg: 'Server Error' });
  }
};

exports.createCloudFolder = async (req, res, io) => { // Pass io instance
  const { name, ownerId, parentFolderId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ msg: 'Invalid owner ID format' });
    }

    const owner = await User.findById(ownerId);
    if (!owner) {
      return res.status(404).json({ msg: 'Owner not found' });
    }

    let parentFolder = null;
    if (parentFolderId) {
      if (!mongoose.Types.ObjectId.isValid(parentFolderId)) {
        return res.status(400).json({ msg: 'Invalid parent folder ID format' });
      }
      parentFolder = await CloudFolder.findById(parentFolderId);
      if (!parentFolder) {
        return res.status(404).json({ msg: 'Parent folder not found' });
      }
    }

    const newFolder = new CloudFolder({
      name,
      owner: ownerId,
      parentFolder: parentFolderId || null,
    });

    await newFolder.save();

    // Emit real-time update for new folder
    io.to(ownerId).emit('newCloudFolder', newFolder);

    res.status(201).json({ msg: 'Folder created successfully', folder: newFolder });
  } catch (err) {
    console.error('Error creating folder:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getCloudFolders = async (req, res) => {
  const { ownerId, parentFolderId } = req.query;

  try {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ msg: 'Invalid owner ID format' });
    }

    let query = { owner: ownerId };
    if (parentFolderId) {
      if (!mongoose.Types.ObjectId.isValid(parentFolderId)) {
        return res.status(400).json({ msg: 'Invalid parent folder ID format' });
      }
      query.parentFolder = parentFolderId;
    } else {
      query.parentFolder = null; // Root folders
    }

    const folders = await CloudFolder.find(query).sort({ createdAt: -1 });
    res.status(200).json({ folders });
  } catch (err) {
    console.error('Error fetching folders:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getCloudFiles = async (req, res) => {
  const { ownerId, folderId } = req.query;

  try {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ msg: 'Invalid owner ID format' });
    }

    let query = { owner: ownerId };
    // If folderId is not provided or is 'null', fetch root files (folder: null)
    if (!folderId || folderId === 'null') {
      query.folder = null;
    } else if (mongoose.Types.ObjectId.isValid(folderId)) {
      query.folder = folderId;
    } else { // If folderId is provided but invalid (and not 'null')
      return res.status(400).json({ msg: 'Invalid folder ID format' });
    }

    const files = await CloudFile.find(query).sort({ createdAt: -1 });
    res.status(200).json({ files });
  } catch (err) {
    console.error('Error fetching files:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.deleteCloudFolder = async (req, res, io) => { // Pass io instance
  const { folderId } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  try {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ msg: 'Invalid folder ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const folder = await CloudFolder.findById(folderId);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check if the user is the owner of the folder
    if (folder.owner.toString() !== userId) {
      return res.status(403).json({ msg: 'Unauthorized: You do not own this folder' });
    }

    // TODO: Implement logic to delete all contents (files/subfolders) within this folder
    // For now, we'll just delete the folder itself.
    // This is a critical step for a complete cloud storage solution.

    await CloudFolder.deleteOne({ _id: folderId });

    // Emit real-time update for deleted folder
    io.to(userId).emit('cloudFolderDeleted', folderId);

    res.status(200).json({ msg: 'Folder deleted successfully' });
  } catch (err) {
    console.error('Error deleting folder:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.deleteCloudFile = async (req, res, io) => { // Pass io instance
  const { fileId } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  try {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ msg: 'Invalid file ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const file = await CloudFile.findById(fileId);

    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    if (file.owner.toString() !== userId) {
      return res.status(403).json({ msg: 'Unauthorized: You do not own this file' });
    }

    const filePath = path.join(__dirname, '..', file.path);

    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('Error deleting file from file system:', err);
      }

      await CloudFile.deleteOne({ _id: fileId });

      const user = await User.findById(userId);
      if (user) {
        user.cloudStorageUsed -= file.size;
        if (user.cloudStorageUsed < 0) user.cloudStorageUsed = 0;
        await user.save();
      }

      io.to(userId).emit('cloudFileDeleted', fileId);

      res.status(200).json({ msg: 'File deleted successfully' });
    });
  } catch (err) {
    console.error('Error deleting file:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.renameCloudFolder = async (req, res, io) => { // Pass io instance
  const { folderId } = req.params;
  const { newName, userId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ msg: 'Invalid folder ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    const folder = await CloudFolder.findById(folderId);

    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    // Check if the user is the owner of the folder
    if (folder.owner.toString() !== userId) {
      return res.status(403).json({ msg: 'Unauthorized: You do not own this folder' });
    }

    // Update the folder name
    folder.name = newName;
    await folder.save();

    // Emit real-time update for renamed folder
    io.to(userId).emit('cloudFolderRenamed', { folderId, newName });

    res.status(200).json({ msg: 'Folder renamed successfully', folder });
  } catch (err) {
    console.error('Error renaming folder:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getCloudStorageUsage = async (req, res) => {
  const { userId } = req.query;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ msg: 'Invalid User ID format' });
  }
  try {
    const user = await User.findById(userId).select('cloudStorageUsed');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(200).json({ cloudStorageUsed: user.cloudStorageUsed });
  } catch (err) {
    console.error('Fetch cloud storage usage error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.uploadDocument = uploadDocument;
""