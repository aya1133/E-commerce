const express = require("express");
const pool = require("../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM voucher"); // ✅ الجدول اسمه product
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get one voucher by id
router.get("/:id", async(req, res) => {
  const { id } = req.params;
  try{
const result = await pool.query("SELECT * FROM voucher WHERE id = $1" ,[
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
      const {  name, code, min_value, max_value, expire_date,type,active,created_at, is_first, no_of_usage } = voucher;

      const result = await pool.query(
        `INSERT INTO voucher
          (  name, code, min_value, max_value, expire_date,type,active,created_at, is_first, no_of_usage  )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [ name, code, min_value, max_value, expire_date,type,active,created_at, is_first, no_of_usage  ]
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
  const {  name, code, min_value, max_value, expire_date  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE voucher
       SET name = $1, code = $2, min_value = $3, max_value = $4, expire_date = $5
       WHERE id = $6 RETURNING *`,
      [  name, code, min_value, max_value, expire_date, id]
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
    await pool.query("DELETE FROM orders WHERE voucher_id = $1", [id]);
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
