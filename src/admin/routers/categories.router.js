const express = require("express");
const pool = require("../../../db");


const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const totalRes = await pool.query("SELECT COUNT(*) FROM public.categories");
    const total = parseInt(totalRes.rows[0].count);

    const result = await pool.query(
      "SELECT * FROM public.categories ORDER BY id ASC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    );

    res.json({
      data: result.rows,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// Get one category by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM public.categories WHERE id = $1" ,[
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" category not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/", async (req, res) => {
  let categories = req.body;

  if (!Array.isArray(categories)) {
    categories = [categories]; // إذا دخلتِ object واحد نحوله array
  }

  try {
    const insertedCategories = [];

    for (const category of categories) {
      const {  name, created_at, active, priority, image } = category;

      const result = await pool.query(
        `INSERT INTO categories
          ( name,created_at,active,priority,image )
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [ name, created_at, active, priority, image]
      );

      insertedCategories.push(result.rows[0]);
    }

    res.status(201).json(insertedCategories);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update banner by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priority, image } = req.body;

  try {
    const result = await pool.query(
      `UPDATE categories
       SET name = $1, priority = $2, image = $3  WHERE id = $4 RETURNING *`,
      [name, priority, image , id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ category not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating category:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Delete category by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM public.categories WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ categories not found");
    }

    res.send(`✅categories with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting categories:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});






module.exports = router;
