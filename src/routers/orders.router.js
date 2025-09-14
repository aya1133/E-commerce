const express = require("express");
const pool = require("../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders"); // ✅ الجدول اسمه product
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get one order by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM orders WHERE id = $1" ,[
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" order not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/", async (req, res) => {
  let orders = req.body;

  if (!Array.isArray(orders)) {
    orders = [orders]; // إذا دخلتِ object واحد نحوله array
  }

  try {
    const insertedOrders = [];

    for (const order of orders) {
      const {
      
        user_id,
        items,
        phone,
        address,
        status,
        active,
        created_at,
        voucher_info,
        delivery_cost,
        voucher_id,
      } = order;

      const result = await pool.query(
        `INSERT INTO  orders 
          (user_id, items ,phone, address,status,active,created_at, voucher_info, delivery_cost, voucher_id  )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
       
          user_id,
          items,
          phone,
          address,
          status,
          active,
          created_at,
          voucher_info,
          delivery_cost,
          voucher_id,
        ]
      );

      insertedOrders.push(result.rows[0]);
    }

    res.status(201).json(insertedOrders);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update order by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    user_id,
    items,
    phone,
    address,
    status,
    active,
    created_at,
    voucher_info,
    delivery_cost,
    voucher_id
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders
       SET user_id = $1, items = $2, phone = $3, address = $4, status = $5, active = $6,
           created_at = $7, voucher_info = $8, delivery_cost = $9, voucher_id = $10
       WHERE id = $11 RETURNING *`,
      [user_id, items, phone, address, status, active, created_at, voucher_info, delivery_cost, voucher_id, id]
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

// Delete order by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM orders WHERE id = $1 RETURNING *",
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
