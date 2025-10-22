const express = require("express");
const router = express.Router();
const { uploadDirect } = require("@uploadcare/upload-client");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const fileData = req.file.buffer;

    // Upload to Uploadcare
    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
    });

    // Generate new image link
    const link = `https://60g5s8sfy4.ucarecd.net//${result.uuid}/-/preview/736x736/`;

    res.json({
      success: true,
      link,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;