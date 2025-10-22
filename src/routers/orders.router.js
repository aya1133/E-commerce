const express = require("express");
const pool = require("../../db");
const authMiddleware = require("../middleware/authMiddleware"); // ✅ Import middleware

const router = express.Router();

// ✅ Get all orders (optional: only admin should use this, you can later protect it too)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM public.orders");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ✅ Get one order by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM public.orders WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).send("❌ Order not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// ✅ Get the latest order for the logged-in user
router.get("/user/latest", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.userId;

    const result = await pool.query(
      `SELECT * FROM public.orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching latest order:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Create order (protected: only logged-in users can do this)
router.post("/", authMiddleware, async (req, res) => {
  let orders = req.body;
  if (!Array.isArray(orders)) {
    orders = [orders]; // 🔸 نحولها لمصفوفة إذا كانت طلب واحد فقط
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN"); // 🔹 نبدأ ترانزاكشن
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

      // 🚨 تحقق من أن الطلب يحتوي على عناصر
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Order must include at least one item",
        });
      }

      const user_id = req.user.userId;

      // 1️⃣ إدخال الطلب في جدول orders
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

      const insertedOrder = result.rows[0];
      insertedOrders.push(insertedOrder);

      // 2️⃣ تحديث الـ stock لكل منتج ضمن الطلب
      for (const item of items) {
  const { id: product_id, quantity } = item;

  if (!product_id || !quantity) {
    throw new Error("Item must have id and quantity");
  }

  const updateResult = await client.query(
    `UPDATE product
     SET stock = stock - $1
     WHERE id = $2 AND stock >= $1
     RETURNING stock`,
    [quantity, product_id]
  );

  if (updateResult.rowCount === 0) {
    throw new Error(`Not enough stock for product ID ${product_id}`);
  }

  const new_stock = updateResult.rows[0].stock;

  if (new_stock === 0) {
    await client.query(
      `UPDATE product SET active = false WHERE id = $1`,
      [product_id]
    );
  }
}

    }

    await client.query("COMMIT"); // 🔹 تثبيت التغييرات
    res.status(201).json({ success: true, insertedOrders });
  } catch (err) {
    await client.query("ROLLBACK"); // 🔻 إلغاء كل شيء لو صار خطأ
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release(); // 🔚 نرجع الاتصال إلى الـ pool
  }
});

// ✅ Update order by ID (protected, so only logged-in users can update)
router.put("/:id", authMiddleware, async (req, res) => {
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating order:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// ✅ Delete order by ID (protected, so only logged-in users can delete)
router.delete("/:id", authMiddleware, async (req, res) => {
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
