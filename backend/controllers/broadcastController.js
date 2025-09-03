// controllers/broadcastController.js
const BroadcastGroup = require("../models/BroadcastGroup");

// =====================
// Broadcast Group Logic
// =====================

// Create a broadcast group
const createBroadcastGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user?.id || req.params.userId; // fallback if you’re not using JWT middleware

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const group = new BroadcastGroup({
      name,
      owner: userId,
    });

    await group.save();
    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating broadcast group:", error);
    res.status(500).json({ message: "Server error creating group" });
  }
};

// Get all broadcast groups for a user
const getBroadcastGroups = async (req, res) => {
  try {
    const { userId } = req.params;

    const groups = await BroadcastGroup.find({ owner: userId }).sort({ createdAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    console.error("Error fetching broadcast groups:", error);
    res.status(500).json({ message: "Server error fetching groups" });
  }
};

// Delete a broadcast group
const deleteBroadcastGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await BroadcastGroup.findByIdAndDelete(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({ message: "Broadcast group deleted successfully" });
  } catch (error) {
    console.error("Error deleting broadcast group:", error);
    res.status(500).json({ message: "Server error deleting group" });
  }
};

// =====================
// Placeholder functions for Broadcast Messages
// (You need another schema for messages if you want to keep these working)
// =====================
const sendBroadcastMessage = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

const getScheduledBroadcasts = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

const cancelScheduledBroadcast = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

const getBroadcastHistory = async (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
};

module.exports = {
  // Broadcast message placeholders
  sendBroadcastMessage,
  getScheduledBroadcasts,
  cancelScheduledBroadcast,
  getBroadcastHistory,

  // Broadcast groups
  createBroadcastGroup,
  getBroadcastGroups,
  deleteBroadcastGroup,
};
