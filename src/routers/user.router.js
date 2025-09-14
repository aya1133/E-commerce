const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// GET user by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).send("User not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Register new user
router.post("/", async (req, res) => {
  const { name, username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, username, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = userResult.rows[0];
    if (!user) return res.status(404).send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Incorrect password");

    res.send("Login successful ✅");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// PUT (update user by id)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, username, email, password } = req.body;
  try {
    // Hash password if provided
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    // Build update query dynamically
    const fields = [];
    const values = [];
    let count = 1;

    if (name) {
      fields.push(`name = $${count}`);
      values.push(name);
      count++;
    }
    if (username) {
      fields.push(`username = $${count}`);
      values.push(username);
      count++;
    }
    if (email) {
      fields.push(`email = $${count}`);
      values.push(email);
      count++;
    }
    if (hashedPassword) {
      fields.push(`password = $${count}`);
      values.push(hashedPassword);
      count++;
    }

    if (fields.length === 0) return res.status(400).send("No fields to update");

    values.push(id); // add id for WHERE clause
    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${count} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).send("User not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Delete user by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM rating WHERE user_id = $1", [id]);
    await pool.query("DELETE FROM orders WHERE user_id = $1", [id]);

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ User not found");
    }

    res.send(
      `✅ User with id ${id} deleted successfully (and related ratings removed)`
    );
  } catch (err) {
    console.error("❌ Error while deleting user:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

module.exports = router;
