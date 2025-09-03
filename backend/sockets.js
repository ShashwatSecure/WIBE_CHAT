// sockets.js
const socketIO = require("socket.io");
const Message = require("./models/Message");
const BroadcastGroup = require("./models/BroadcastGroup");

function initializeSockets(server, pubClient, subClient) {
  const io = socketIO(server, {
    cors: {
      origin: "*", // TODO: replace with frontend URL in production
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // ========================
    // USER REGISTRATION
    // ========================
    socket.on("registerUser", (userId) => {
      socket.userId = userId;
      socket.join(userId); // user joins personal room for 1-to-1 messages
      console.log(`📌 User ${userId} registered on socket ${socket.id}`);
    });

    // ========================
    // PRIVATE 1-to-1 MESSAGES
    // ========================
    socket.on("sendMessage", async ({ senderId, receiverId, content, fileUrl, isDocument }) => {
      try {
        const message = new Message({
          sender: senderId,
          receiver: receiverId,
          content,
          timestamp: new Date(),
          imageUrl: fileUrl || null,
          isDocument: isDocument || false,
        });

        await message.save();

        // Emit message to both users
        io.to(senderId.toString()).emit("receiveMessage", message);
        io.to(receiverId.toString()).emit("receiveMessage", message);

      } catch (err) {
        console.error("❌ Error saving 1-to-1 message:", err.message);
      }
    });

    // Typing indicator
    socket.on("typing", ({ senderId, receiverId }) => {
      io.to(receiverId.toString()).emit("typing", { senderId });
    });

    // ========================
    // BROADCAST MESSAGES
    // ========================
    socket.on("sendBroadcast", async ({ senderId, groupId, content }) => {
      try {
        const group = await BroadcastGroup.findById(groupId);
        if (!group) {
          return console.error("❌ Broadcast group not found:", groupId);
        }

        // For simplicity: message isn’t saved to DB yet (needs schema extension)
        const payload = {
          senderId,
          groupId,
          content,
          timestamp: new Date(),
        };

        // Emit to all group members (assuming frontend tracks group membership)
        io.to(groupId.toString()).emit("receiveBroadcast", payload);

      } catch (err) {
        console.error("❌ Error sending broadcast message:", err.message);
      }
    });

    // ========================
    // JOIN GROUPS (broadcast)
    // ========================
    socket.on("joinGroup", (groupId) => {
      socket.join(groupId.toString());
      console.log(`👥 User ${socket.id} joined broadcast group ${groupId}`);
    });

    // ========================
    // DISCONNECT
    // ========================
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });

  return io;
}

module.exports = initializeSockets;
