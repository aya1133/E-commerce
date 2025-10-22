const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../../../db");
const jwt = require("jsonwebtoken");

const router = express.Router();

// POST /admin
router.post("/", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO admin (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const adminResult = await pool.query(
      "SELECT * FROM public.admin WHERE username = $1",
      [username]
    );

    const admin = adminResult.rows[0];
    if (!admin) return res.status(404).send("admin not found");

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).send("Incorrect password");
    const token = jwt.sign(
      { id: admin.id, username: admin.name },
      process.env.jwt,
      { expiresIn: '1y' }
    );

    res.send({ sucsses: true, token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
