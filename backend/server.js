require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

// Import configurations
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import models (for cron job)
const ScheduledBroadcast = require('./models/ScheduledBroadcast');
const Message = require('./models/Message');

const app = express();
const server = http.createServer({ maxHeaderSize: 1024 * 256 }, app);

// Initialize database and Redis
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('MongoDB connected successfully');

    // Connect to Redis
    await connectRedis();
    console.log('Redis connected successfully');

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '100mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    app.use((req, res, next) => {
      console.log(`Incoming request: ${req.method} ${req.url}`);
      next();
    });

    // Static files
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    app.use('/uploads/profile_pictures', express.static(path.join(__dirname, 'uploads', 'profile_pictures')));
    app.use('/Wibe_Chat-stickerd', express.static(path.join(__dirname, '../frontend/Wibe_Chat stickerd')));

    // Routes
    app.use('/api', require('./routes'));

    // Serve React app in production
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.join(__dirname, '../frontend/build')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
      });
    }

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Socket.io setup
    const io = require('./sockets')(server);
    
    // Store io instance for use in cron job
    app.set('io', io);

    // Cron job for scheduled broadcasts
    cron.schedule('* * * * *', async () => {
      try {
        console.log('Running cron job to send scheduled broadcasts');
        const now = new Date();
        const broadcasts = await ScheduledBroadcast.find({ 
          scheduledAt: { $lte: now }, 
          isSent: false 
        }).populate('sender');

        for (const broadcast of broadcasts) {
          console.log(`Processing broadcast: ${broadcast._id}`);
          
          const messages = broadcast.recipients.map(recipientId => ({
            sender: broadcast.sender._id,
            receiver: recipientId,
            content: broadcast.message,
            files: broadcast.files,
            timestamp: new Date(),
            isBroadcast: true,
          }));

          if (messages.length > 0) {
            await Message.insertMany(messages);
          }
          
          broadcast.isSent = true;
          await broadcast.save();
          
          // Emit event using the stored io instance
          const ioInstance = app.get('io');
          if (ioInstance) {
            ioInstance.emit('broadcastSent', broadcast);
          }
          
          console.log(`Sent scheduled broadcast ${broadcast._id} to ${broadcast.recipients.length} recipients`);
        }
      } catch (error) {
        console.error('Error in broadcast cron job:', error);
      }
    });

    // Start server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      
      // Close server
      server.close(async (err) => {
        if (err) {
          console.error('Error during server close:', err);
          process.exit(1);
        }

        try {
          // Close database connection
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          console.log('MongoDB connection closed');
          
          // Close Redis connection
          const { disconnectRedis } = require('./config/redis');
          await disconnectRedis();
          console.log('Redis connections closed');
          
          console.log('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle different shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Start the application
initializeApp();

module.exports = app;