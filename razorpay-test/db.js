const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
const sslMode = String(process.env.PGSSL || "false").toLowerCase() === "true";

function buildPoolConfig() {
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: sslMode ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "razorpay_test",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    ssl: sslMode ? { rejectUnauthorized: false } : false,
  };
}

const pool = new Pool(buildPoolConfig());

async function initDatabase() {
  const query = `
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      razorpay_order_id TEXT NOT NULL,
      razorpay_payment_id TEXT NOT NULL,
      razorpay_signature TEXT NOT NULL,
      is_signature_valid BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await pool.query(query);
}

async function savePaymentRecord(payment) {
  const query = `
    INSERT INTO payments (
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      is_signature_valid
    ) VALUES ($1, $2, $3, $4)
    RETURNING id, created_at;
  `;

  const values = [
    payment.razorpay_order_id,
    payment.razorpay_payment_id,
    payment.razorpay_signature,
    payment.is_signature_valid,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  initDatabase,
  savePaymentRecord,
  closeDatabase,
};
