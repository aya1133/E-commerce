const express = require("express");
const pool = require("../../db");

const router = express.Router();


// Get all banners 
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM banner");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// Get one banner by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM banner WHERE id = $1" ,[
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" banner not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
//post banners
router.post("/", async (req, res) => {
  const {
    name,
    priority,
    active,
    type,
    map,
    background,
    hidden,
    created_at,
  } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO banner (name , priority, active, type, map , background, hidden, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [ name, priority, active, type, map, background, hidden, created_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// Update banner by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priority, active, type, map, background, hidden } = req.body;

  try {
    const result = await pool.query(
      `UPDATE banner 
       SET name = $1, priority = $2, active = $3, type = $4, map = $5, background = $6, hidden = $7
       WHERE id = $8 RETURNING *`,
      [name, priority, active, type, map, background, hidden, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Banner not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating banner:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Delete banner by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM banner WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Banner not found");
    }

    res.send(`✅ Banner with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting banner:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});







module.exports = router;