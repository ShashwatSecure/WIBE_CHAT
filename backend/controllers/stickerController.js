// controllers/stickerController.js
const path = require("path");
const fs = require("fs");

// Example in-memory data for packs (replace with MongoDB model later if needed)
const stickerPacks = [
  {
    identifier: "funny_animals",
    name: "Funny Animals",
    stickers: [
      { filename: "cat1.png", url: "/stickers/download/image/cat1.png" },
      { filename: "dog1.png", url: "/stickers/download/image/dog1.png" },
    ],
  },
  {
    identifier: "memes",
    name: "Meme Stickers",
    stickers: [
      { filename: "meme1.png", url: "/stickers/download/image/meme1.png" },
      { filename: "meme2.png", url: "/stickers/download/image/meme2.png" },
    ],
  },
];

// Get all sticker packs
const getStickerPacks = async (req, res) => {
  try {
    // Only return meta info (no heavy sticker list)
    const packsMeta = stickerPacks.map((p) => ({
      identifier: p.identifier,
      name: p.name,
      count: p.stickers.length,
    }));

    res.status(200).json(packsMeta);
  } catch (error) {
    console.error("Error fetching sticker packs:", error);
    res.status(500).json({ message: "Server error fetching sticker packs" });
  }
};

// Get details of a single sticker pack by identifier
const getStickerPack = async (req, res) => {
  try {
    const { identifier } = req.params;

    const pack = stickerPacks.find((p) => p.identifier === identifier);

    if (!pack) {
      return res.status(404).json({ message: "Sticker pack not found" });
    }

    res.status(200).json(pack);
  } catch (error) {
    console.error("Error fetching sticker pack:", error);
    res.status(500).json({ message: "Server error fetching sticker pack" });
  }
};

module.exports = {
  getStickerPacks,
  getStickerPack,
};
