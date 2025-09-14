require("dotenv").config();

const express = require("express");
const routes = require("./src/routes");

const app = express();
const port = 3000;

app.use(express.json());
app.use('/api', routes);

app.use("/uploads", express.static("src/uploads"));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


/*
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const bcrypt = require("bcrypt");

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Connection error", err.stack));

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.post("/users", async (req, res) => {
  const { name, username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, username, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]); // يرجع المستخدم الجديد
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = userResult.rows[0];

    if (!user) return res.status(404).send("User not found");
    const match = await bcrypt.compare(password, user.password);
    console.log("Stored hash:", user.password);
    console.log("Typed password:", password);
    if (!match) return res.status(401).send("Incorrect password");
    res.send("Login successful ✅");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/banner", async (req, res) => {
  const {
    id,
    name,
    priority,
    active,
    type,
    map,
    background,
    hidden,
    created_at,
  } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO banner (id, name , priority, active, type, map , background, hidden, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [id, name, priority, active, type, map, background, hidden, created_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/banner", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM banner");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.post("/product", async (req, res) => {
  const {
    name,
    active,
    options,
    description,
    related,
    created_at,
    price,
    endprice,
    endpricedate,
    stock,
    available,
  } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO product (name , active, options, description , related , created_at, price, endprice, end_price_date, stock, available) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10, $11) RETURNING *",
      [
        name,
        active,
        options,
        description,
        related,
        created_at,
        price,
        endprice,
        endpricedate,
        stock,
        available,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/product", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM product");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
}); */

