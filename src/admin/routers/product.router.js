const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all products with pagination
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // default page 1
    const pageSize = parseInt(req.query.pageSize) || 10; // default 10 per page
    const offset = (page - 1) * pageSize;

    // Total count
    const totalResult = await pool.query("SELECT COUNT(*) FROM public.product");
    const total = parseInt(totalResult.rows[0].count, 10);

    // Fetch paginated rows
    const result = await pool.query(
      `SELECT *
       FROM public.product
       ORDER BY id DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    res.json({
      data: result.rows,
      total, // total rows for pagination
      page,
      pageSize,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get similar products for a given product
router.get("/:id/similar", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT sp.*,
             i.link AS primary_image,
             r.avg_rating,
             r.rating_count
      FROM public.product p
      -- join related products
      JOIN product sp 
        ON sp.id = ANY(p.related) -- assumes related is an int[] column
       AND sp.active = true

      -- Primary image
      LEFT JOIN LATERAL (
        SELECT link
        FROM public.images i
        WHERE i.product_id = sp.id
        ORDER BY i.priority ASC NULLS LAST, i.id ASC
        LIMIT 1
      ) i ON true

      -- Rating aggregation
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating,
               COUNT(*) AS rating_count
        FROM public.rating r
        WHERE r.product_id = sp.id
      ) r ON true

      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /:id/similar:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/withPrimaryImageAndRating", async (req, res) => {
  const { category_id, page = 1, pageSize = 10 } = req.query;

  try {
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    // Count total products
    let countQuery = "SELECT COUNT(*) FROM public.product p";
    const valuesCount = [];

    if (category_id) {
      countQuery += " WHERE p.category_id = $1";
      valuesCount.push(Number(category_id));
    }

    const countResult = await pool.query(countQuery, valuesCount);
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch paginated products
    let query = `
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object(
            'id', i.id,
            'link', i.link,
            'priority', i.priority
          ) ORDER BY i.priority ASC NULLS LAST, i.id ASC)
          FROM public.images i
          WHERE i.product_id = p.id
        ) AS images,
        (
          SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS avg_rating,
        (
          SELECT COUNT(*) AS rating_count
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS rating_count
      FROM public.product p
    `;

    const values = [];

    if (category_id) {
      query += " WHERE p.category_id = $1";
      values.push(Number(category_id));
      query += " ORDER BY p.id DESC LIMIT $2 OFFSET $3";
      values.push(limit, offset);
    } else {
      query += " ORDER BY p.id DESC LIMIT $1 OFFSET $2";
      values.push(limit, offset);
    }

    const result = await pool.query(query, values);

    console.log({
      data: result.rows,
      total,
      page: Number(page),
      pageSize: limit,
    });

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      pageSize: limit,
    });
  } catch (err) {
    console.error("❌ Error in /withPrimaryImageAndRating:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// router.get("/withPrimaryImageAndRating", async (req, res) => {
//   const { category_id } = req.query;

//   try {
//     let query = `
//       SELECT p.*,
//              i.link AS primary_image,
//              r.avg_rating,
//              r.rating_count
//       FROM "product" p

//       -- Primary image (by priority)
//       LEFT JOIN LATERAL (
//         SELECT link
//         FROM public.images i
//         WHERE i.product_id = p.id
//         ORDER BY i.priority ASC NULLS LAST, i.id ASC
//       ) i ON true

//       -- Rating aggregation
//       LEFT JOIN LATERAL (
//         SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating,
//                COUNT(*) AS rating_count
//         FROM public.rating r
//         WHERE r.product_id = p.id
//       ) r ON true
//     `;

//     const values = [];
//     if (category_id) {
//       query += ` WHERE p.category_id = $1 `;
//       values.push(category_id);
//     }

//     query += ` ORDER BY p.id DESC`;

//     const result = await pool.query(query, values);

//     res.json(result.rows);
//   } catch (err) {
//     console.error("❌ Error in /withPrimaryImageAndRating:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// Get one product by id

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT p.*,
             i.link AS primary_image
      FROM public.product p
      LEFT JOIN LATERAL (
        SELECT link
        FROM public.images i
        WHERE i.product_id = p.id
        ORDER BY i.priority ASC NULLS LAST, i.id ASC
        LIMIT 1
      ) i ON true
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Product not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error in /products/:id:", err.message);
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
  const {
    name,
    category_id,
    active,
    available,
    stock,
    description,
    related,
    options,
    price,
    endprice,
    end_price_date,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE product 
       SET 
         name = $1,
         category_id = $2,
         active = $3,
         available = $4,
         stock = $5,
         description = $6,
         related = $7,               -- integer[] (no cast)
         options = $8::jsonb,        -- JSON field
         price = $9,
         endprice = $10,
         end_price_date = $11
       WHERE id = $12
       RETURNING *`,
      [
        name,
        category_id,
        active,
        available ?? true, // fallback if not provided
        stock,
        description,
        related || [], // send array directly
        JSON.stringify(options ?? {}), // ensure valid json
        price,
        endprice,
        end_price_date,
        id,
      ]
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

// ✅ Delete a product and its related images
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("🧹 Deleting images for product:", id);
    await pool.query("DELETE FROM public.images WHERE product_id = $1", [id]);

    const deleted = await pool.query(
      "DELETE FROM public.product WHERE id = $1 RETURNING *",
      [id]
    );

    if (deleted.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({
      success: true,
      message: "🗑️ Product deleted successfully",
    });
  } catch (error) {
    console.error("Error while deleting product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
