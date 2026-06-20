const crypto = require("crypto");
const path = require("path");

const express = require("express");
const Razorpay = require("razorpay");
require("dotenv").config();
const { initDatabase, savePaymentRecord } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "razorpay-test-sandbox" });
});

app.get("/api/config", (req, res) => {
  res.json({ keyId });
});

app.post("/api/create-order", async (req, res) => {
  try {
    const amountInRupees = Number(req.body?.amount ?? 100);

    if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        source: "local-test-sandbox",
      },
    });

    return res.json(order);
  } catch (error) {
    console.error("Order creation failed:", error);
    return res.status(500).json({
      error: "Unable to create order",
      details: error?.error?.description || error.message,
    });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment fields for verification",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    const saved = await savePaymentRecord({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      is_signature_valid: isAuthentic,
    });

    return res.json({
      success: isAuthentic,
      message: isAuthentic
        ? "Payment signature is valid"
        : "Payment signature mismatch",
      recordId: saved.id,
      storedAt: saved.created_at,
    });
  } catch (error) {
    console.error("Signature verification failed:", error);
    return res.status(500).json({ success: false, message: "Verification error" });
  }
});

async function startServer() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`Razorpay sandbox running at http://localhost:${port}`);
    console.log("Connected to PostgreSQL and ensured payments table exists.");
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize app:", error.message);
  process.exit(1);
});
