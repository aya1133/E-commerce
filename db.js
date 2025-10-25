require("dotenv").config();
const { Pool } = require("pg");

// Create a connection pool (auto-reconnects when Neon sleeps)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // ✅ required for Neon
  },
});

// Log when connected
pool
  .connect()
  .then(() => console.log("✅ Connected to Neon PostgreSQL"))
  .catch((err) => console.error("❌ Initial connection error:", err.message));

// Handle idle disconnects or errors gracefully
pool.on("error", (err) => {
  console.error("⚠️ PostgreSQL client error:", err.message);
  // The pool will auto-reconnect on the next query
});

// Optional: handle uncaught exceptions (so your server never crashes)
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

module.exports = pool;
