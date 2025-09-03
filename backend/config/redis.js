const { createClient } = require('redis');

let pubClient = null;
let subClient = null;

const connectRedis = async () => {
  try {
    // Create Redis clients with configuration
    pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 60000,
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.log('Too many retries on Redis. Connection terminated');
            return new Error('Too many retries');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    subClient = pubClient.duplicate();

    // Error handling
    pubClient.on('error', (err) => {
      console.error('Redis Pub Client Error:', err);
    });

    subClient.on('error', (err) => {
      console.error('Redis Sub Client Error:', err);
    });

    pubClient.on('connect', () => {
      console.log('Redis Pub Client Connected');
    });

    subClient.on('connect', () => {
      console.log('Redis Sub Client Connected');
    });

    pubClient.on('ready', () => {
      console.log('Redis Pub Client Ready');
    });

    subClient.on('ready', () => {
      console.log('Redis Sub Client Ready');
    });

    // Connect to Redis
    await pubClient.connect();
    await subClient.connect();

    console.log('Redis clients connected successfully');

    return { pubClient, subClient };

  } catch (error) {
    console.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClients = () => {
  if (!pubClient || !subClient) {
    throw new Error('Redis clients not initialized. Call connectRedis() first.');
  }
  return { pubClient, subClient };
};

const disconnectRedis = async () => {
  try {
    if (pubClient) {
      await pubClient.quit();
      console.log('Redis Pub Client disconnected');
    }
    if (subClient) {
      await subClient.quit();
      console.log('Redis Sub Client disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting Redis:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});

module.exports = {
  connectRedis,
  getRedisClients,
  disconnectRedis
};