const express = require("express");
const pool = require("../../db");

const router = express.Router();

// Get all products
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM product");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get one product by id

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT *  FROM product WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send("product not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/", async (req, res) => {
  let products = req.body;

  if (!Array.isArray(products)) {
    products = [products];
  }

  try {
    const insertedProducts = [];

    for (const product of products) {
      const {
        name,
        created_at,
        active,
        available,
        stock,
        description,
        related,
        options,
        price,
        endprice,
        end_price_date,
      } = product;

      const result = await pool.query(
        `INSERT INTO product
          (name, created_at, active, available, stock, description, related, options, price, endprice, end_price_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          name,
          created_at,
          active,
          available,
          stock,
          description,
          related,
          options,
          price,
          endprice,
          end_price_date,
        ]
      );

      insertedProducts.push(result.rows[0]);
    }

    res.status(201).json(insertedProducts);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update product by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock } = req.body;

  try {
    const result = await pool.query(
      "UPDATE product SET name = $1, description = $2, price = $3, stock = $4 WHERE id = $5 RETURNING *",
      [name, description, price, stock, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Product not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating product:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Delete product by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
     await pool.query("DELETE FROM rating WHERE product_id = $1", [id]);
    const result = await pool.query(
      "DELETE FROM product WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Product not found");
    }

    res.send(`✅ Product with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting product:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

module.exports = router;
