const express = require("express");
const pool = require("../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM rating"); // ✅ الجدول اسمه product
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get one rating by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM rating WHERE id = $1" ,[
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" rating not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//post rating
router.post("/", async (req, res) => {
  let ratings = req.body;

  if (!Array.isArray(ratings)) {
   ratings = [ratings]; // إذا دخلتِ object واحد نحوله array
  }

  try {
    const insertedRating = [];

    for (const rating of ratings) {
      const {  user_id, product_id, value } = rating;

      const result = await pool.query(
        `INSERT INTO rating
          ( user_id, product_id, value  )
         VALUES ($1,$2,$3)
         RETURNING *`,
        [ user_id, product_id, value ]
      );

    insertedRating.push(result.rows[0]);
    }

    res.status(201).json(insertedRating);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update rating by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id, product_id, value  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE rating
       SET user_id = $1, product_id = $2, value = $3
       WHERE id = $4 RETURNING *`,
      [ user_id, product_id, value , id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ rating not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating rating:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});


// Delete rating by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM rating WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ rating not found");
    }

    res.send(`✅rating with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting rating:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});


module.exports = router;
