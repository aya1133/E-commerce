const express = require("express");
const pool = require("../../../db");
// تأكدي المسار صحيح حسب مشروعك

const router = express.Router();

// إضافة صورة
router.post("/", async (req, res) => {
  const { product_id, priority, fileUrl } = req.body;

  if (!fileUrl) return res.status(400).json({ error: "Image URL is required" });

  try {
    const result = await pool.query(
      "INSERT INTO images (product_id, link, priority) VALUES ($1, $2, $3) RETURNING *",
      [product_id, fileUrl, priority || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save image" });
  }
});

// جلب كل الصور
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM public.images");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// Get one banner by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM public.images WHERE id = $1" ,[
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" image not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// Update image by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { product_id, link, priority } = req.body;

  try {
    const result = await pool.query(
      "UPDATE images SET product_id = $1, link = $2, priority = $3 WHERE id = $4 RETURNING *",
      [product_id, link, priority, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Image not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating image:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});


// Delete image by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM public.images WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Image not found");
    }

    res.send(`✅ Image with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting image:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});


module.exports = router;
