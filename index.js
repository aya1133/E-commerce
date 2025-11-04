require("dotenv").config();
const cors = require("cors");
const express = require("express");
const routes = require("./src/routes");
const adminRoutes = require("./src/admin/routes");
const { uploadDirect } = require("@uploadcare/upload-client");
const pool = require("./db");

const multer = require("multer");

// fileData must be `Blob` or `File` or `Buffer`

const app = express();
const port =process.env.PORT || 3002;

app.use(express.json());
app.use(cors());
app.use("/api", routes);
app.use("/api/admin", adminRoutes);

const upload = multer({ storage: multer.memoryStorage() });

app.post(
  "/upload/product/:id/:priority",
  upload.single("file"),
  async (req, res) => {
    const { id, priority } = req.params;

    try {
      const fileData = req.file.buffer; // Buffer from multer

      const result = await uploadDirect(fileData, {
        publicKey: process.env.UPLOADCARE_PUBLIC_KEY, // from your .env file
        store: "auto",
      });

      const link = `https://60g5s8sfy4.ucarecd.net/${result.uuid}/-/preview/736x736/`;

      const AddProductImage = await pool.query(
        "INSERT INTO images (product_id , link, priority) VALUES ($1, $2, $3) RETURNING *",
        [id, link, priority]
      );

      res.json({
        success: true,
        link,
        image: AddProductImage.rows[0], // ✅ now VS Code will highlight it
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

app.use("/uploads", express.static("src/uploads"));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.put("/upload/product", upload.single("file"), async (req, res) => {
  const { imageId, productId } = req.query; // ✅ Get both from query: ?imageId=5&productId=12
  console.log("Received query:", req.query);

  if (!imageId || !productId) {
    return res
      .status(400)
      .json({ success: false, message: "imageId and productId are required" });
  }

  try {
    const fileData = req.file.buffer;

    // Upload image to Uploadcare
    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
    });

    // Generate link
    const link = `https://60g5s8sfy4.ucarecd.net/${result.uuid}/-/preview/736x736/`;

    // ✅ Update both link and product_id
    const updated = await pool.query(
      "UPDATE images SET link = $1 WHERE product_id = $2 AND link = $3 AND priority = 0 RETURNING *",
      [link, productId, imageId]
    );

    if (updated.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    res.json({
      success: true,
      message: "✅ Image updated successfully",
      link,
      image: updated.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.put("/upload/image", upload.single("file"), async (req, res) => {
  const { imageId } = req.query; // ?imageId=12

  console.log("Received query:", req.query);

  if (!imageId) {
    return res
      .status(400)
      .json({ success: false, message: "imageId is required" });
  }

  try {
    const fileData = req.file.buffer;

    // Upload to Uploadcare
    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
    });

    // Generate new image link
    const link = `https://60g5s8sfy4.ucarecd.net//${result.uuid}/-/preview/736x736/`;

    // ✅ Update just this image (by its id)
    const updated = await pool.query(
      "UPDATE images SET link = $1 WHERE id = $2 RETURNING *",
      [link, imageId]
    );

    if (updated.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    res.json({
      success: true,
      message: "✅ Image updated successfully",
      link,
      image: updated.rows[0],
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Delete an image by ID
app.delete("/upload/image", async (req, res) => {
  const { imageId } = req.query;

  if (!imageId) {
    return res.status(400).json({ success: false, message: "imageId is required" });
  }

  try {
    const deleted = await pool.query(
      "DELETE FROM public.images WHERE id = $1 RETURNING *",
      [imageId]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    res.json({
      success: true,
      message: "🗑️ Image deleted successfully",
      deleted: deleted.rows[0],
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.post("/upload/category/:id", upload.single("file"), async (req, res) => {
  const { id } = req.params;

  try {
    const fileData = req.file.buffer;

    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
    });

    const link = `https://60g5s8sfy4.ucarecdn.com/${result.uuid}/-/preview/736x736/`;

    // Assuming your "categories" table has a column named "image"
    const updated = await pool.query(
      "UPDATE categories SET image = $1 WHERE id = $2 RETURNING *",
      [link, id]
    );

    res.json({ success: true, link, category: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/upload/banner/:id", upload.single("file"), async (req, res) => {
  const { id } = req.params;

  try {
    const fileData = req.file.buffer;

    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
    });

    const link = `https://60g5s8sfy4.ucarecdn.com/${result.uuid}/-/preview/736x736/`;

    const updated = await pool.query(
      "UPDATE banner SET background = $1 WHERE id = $2 RETURNING *",
      [link, id]
    );

    res.json({ success: true, link, banner: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});
