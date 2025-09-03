// controllers/notificationController.js
const Notification = require("../models/Notification");

// Fetch all notifications for a user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // assuming auth middleware sets req.user
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

// Clear all notifications for a user
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ user: userId });

    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ message: "Server error clearing notifications" });
  }
};

module.exports = {
  getNotifications,
  clearAllNotifications,
};
