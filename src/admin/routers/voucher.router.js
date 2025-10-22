const express = require("express");
const pool = require("../../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Total count
    const totalResult = await pool.query("SELECT COUNT(*) FROM voucher");
    const total = parseInt(totalResult.rows[0].count, 10);

    // Paginated data
    const result = await pool.query(
      "SELECT * FROM voucher ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [pageSize, offset]
    );

    res.json({
      data: result.rows,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("❌ Error fetching vouchers:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Decrease voucher usage when used in an order
router.put("/use/:code", async (req, res) => {
  const { code } = req.params;

  try {
    // Check if voucher exists, active, not expired, and has usage left
    const voucherResult = await pool.query(
      `SELECT * FROM voucher 
       WHERE code = $1 
       AND active = true 
       AND (no_of_usage IS NULL OR no_of_usage > 0) 
       AND expire_date > NOW()`,
      [code]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ error: "❌ Voucher not found or no usages left" });
    }

    const voucher = voucherResult.rows[0];

    // Decrease usage if it has a limit
    if (voucher.no_of_usage !== null) {
      const updated = await pool.query(
        `UPDATE voucher 
         SET no_of_usage = no_of_usage - 1
         WHERE code = $1
         RETURNING *`,
        [code]
      );

      // If usage reaches 0, deactivate the voucher
      if (updated.rows[0].no_of_usage <= 0) {
        await pool.query(`UPDATE voucher SET active = false WHERE code = $1`, [code]);
      }

      return res.json(updated.rows[0]);
    }

    // If usage is unlimited (null), just return it
    res.json(voucher);
  } catch (err) {
    console.error("❌ Error updating voucher usage:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get voucher by code
router.get("/code/:code", async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM voucher 
   WHERE code = $1 AND active = true AND expire_date > NOW()`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ voucher not found");
    }

    res.json(result.rows[0]); // return the voucher with this code
  } catch (err) {
    console.error("❌ Error while fetching voucher by code:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Get one voucher by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM voucher WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).send(" voucher not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/", async (req, res) => {
  let vouchers = req.body;

  if (!Array.isArray(vouchers)) {
    vouchers = [vouchers]; // إذا دخلتِ object واحد نحوله array
  }

  try {
    const insertedVoucher = [];

    for (const voucher of vouchers) {
      const {
        name,
        code,
        min_value,
        max_value,
        expire_date,
        type,
        active,
        created_at,
        is_first,
        no_of_usage,
        value,
      } = voucher;

      const result = await pool.query(
        `INSERT INTO voucher
          (  name, code, min_value, max_value, expire_date,type,active,created_at, is_first, no_of_usage, value  )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          name,
          code,
          min_value,
          max_value,
          expire_date,
          type,
          active,
          created_at,
          is_first,
          no_of_usage,
          value,
        ]
      );

      insertedVoucher.push(result.rows[0]);
    }

    res.status(201).json(insertedVoucher);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//update voucher by id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, code, min_value, max_value, expire_date, value } = req.body;

  try {
    const result = await pool.query(
      `UPDATE voucher
       SET name = $1, code = $2, min_value = $3, max_value = $4, expire_date = $5, value =$6
       WHERE id = $7 RETURNING *`,
      [name, code, min_value, max_value, expire_date, value, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ voucher not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating voucher:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Delete voucher by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM public.orders WHERE voucher_id = $1", [id]);
    const result = await pool.query(
      "DELETE FROM voucher WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ voucher not found");
    }

    res.send(`✅voucher with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting rating:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

module.exports = router;
