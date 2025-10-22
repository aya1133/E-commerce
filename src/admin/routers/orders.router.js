const express = require("express");
const pool = require("../../../db");

const authMiddleware = require("../middleware/authMiddleware"); // ✅ Import middleware

const router = express.Router();

router.get("/", async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;

  try {
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    // Count total orders
    const countResult = await pool.query("SELECT COUNT(*) FROM public.orders");
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch paginated orders
    const result = await pool.query(
      "SELECT * FROM public.orders ORDER BY id DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("❌ Error in GET /orders:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET order by ID with user name
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT o.*, u.name AS user_name
       FROM public.orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).send("Order not found");

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ✅ Get real product data for an order (to compare stock, etc.)
router.get("/:orderId/products", async (req, res) => {
  const { orderId } = req.params;

  try {
    const orderResult = await pool.query(
      `SELECT o.*, u.name AS user_name
       FROM public.orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    let items = orderResult.rows[0].items;
    if (typeof items === "string") items = JSON.parse(items);

    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, orderId, products: [] });
    }

    const productIds = [
      ...new Set(
        items.map((i) => Number(i.product_id || i.id)).filter(Boolean)
      ),
    ];

    if (productIds.length === 0) {
      return res.json({ success: true, orderId, products: [] });
    }

    const productsResult = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.stock,
        p.price,
        (
          SELECT i.link
          FROM public.images i
          WHERE i.product_id = p.id
          ORDER BY i.priority ASC NULLS LAST, i.id ASC
          LIMIT 1
        ) AS primary_image
      FROM public.product p
      WHERE p.id = ANY($1::int[])
      `,
      [productIds]
    );

    const merged = items.map((item) => {
      const product = productsResult.rows.find(
        (p) => p.id === Number(item.product_id || item.id)
      );

      return {
        ...item,
        id: Number(item.product_id || item.id),
        name: product?.name ?? item.name,
        price: product?.price ?? item.price,
        stock: product?.stock ?? item.stock,
        primary_image: product?.primary_image ?? item.primary_image,
      };
    });

    // Deduplicate by product + option
    const unique = [];
    const seen = new Set();
    for (const m of merged) {
      const key = `${m.id}_${m.selectedOption || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }

    res.json({
      success: true,
      product: merged,
      order: orderResult.rows[0],
    });
  } catch (err) {
    console.error("❌ Error fetching order products:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ✅ Update items in an order and adjust stock accordingly
router.put("/:orderId/items", async (req, res) => {
  const { orderId } = req.params;
  const { updatedItems } = req.body; // [{ id, quantity }, ...]

  try {
    // 1️⃣ Get current order
    const orderResult = await pool.query("SELECT items FROM public.orders WHERE id = $1", [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    let oldItems = orderResult.rows[0].items;
    if (typeof oldItems === "string") oldItems = JSON.parse(oldItems);

    // 2️⃣ Iterate over all updated items
    for (const newItem of updatedItems) {
      const id = Number(newItem.id);
      const newQty = Number(newItem.quantity);

      // 🚨 Skip if data is invalid
      if (isNaN(id) || isNaN(newQty)) {
        console.warn("⚠️ Skipping invalid item:", newItem);
        continue;
      }

      // Find existing item in order
      const oldItem = oldItems.find(
        (item) => Number(item.id) === id || Number(item.product_id) === id
      );

      const oldQty = oldItem ? Number(oldItem.quantity) || 0 : 0;
      const diff = newQty - oldQty;

      if (diff !== 0) {
        // 3️⃣ Update stock in the products table
        await pool.query("UPDATE product SET stock = stock - $1 WHERE id = $2", [diff, id]);

        // 4️⃣ Update or insert inside order items
        if (oldItem) {
          oldItem.quantity = newQty;
        } else {
          oldItems.push({ ...newItem, id });
        }
      }
    }

    // 5️⃣ Save updated items array back to DB
    await pool.query("UPDATE orders SET items = $1 WHERE id = $2", [
      JSON.stringify(oldItems),
      orderId,
    ]);

    res.json({ success: true, message: "Order items updated successfully" });
  } catch (err) {
    console.error("❌ Error updating order items:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create order (protected: only logged-in users can do this)
router.post("/", authMiddleware, async (req, res) => {
  let orders = req.body;
  if (!Array.isArray(orders)) {
    orders = [orders]; // Normalize to array
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertedOrders = [];

    for (const order of orders) {
      const {
        items = [],
        phone,
        address,
        status = "pending",
        active = true,
        created_at,
        voucher_info,
        delivery_cost,
        voucher_id,
      } = order;

      // 🚨 Validate items
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Order must include at least one item",
        });
      }

      const user_id = req.user.userId;

      const result = await client.query(
        `INSERT INTO orders 
        (user_id, items, phone, address, status, active, created_at, voucher_info, delivery_cost, voucher_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
        [
          user_id,
          JSON.stringify(items),
          phone,
          address,
          status,
          active,
          created_at || new Date(),
          voucher_info ? JSON.stringify(voucher_info) : null,
          delivery_cost,
          voucher_id,
        ]
      );

      insertedOrders.push(result.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, insertedOrders });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ✅ Update order by ID (protected, so only logged-in users can update)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    items,
    phone,
    address,
    status,
    active,
    created_at,
    voucher_info,
    delivery_cost,
    voucher_id,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders
       SET items = $1, phone = $2, address = $3, status = $4, active = $5,
           created_at = $6, voucher_info = $7, delivery_cost = $8, voucher_id = $9
       WHERE id = $10 RETURNING *`,
      [
        items,
        phone,
        address,
        status,
        active,
        created_at,
        voucher_info,
        delivery_cost,
        voucher_id,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Order not found");
    }

    res.json({
      ...result.rows[0],
      items: JSON.stringify(result.rows[0].items),
    });
  } catch (err) {
    console.error("❌ Error while updating order:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// ✅ Delete order by ID (protected, so only logged-in users can delete)
// router.delete("/:id", authMiddleware, async (req, res) => {
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM public.orders WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Order not found");
    }

    res.send(`✅ Order with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting order:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

module.exports = router;
