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
app.use(express.urlencoded({ extended: true }));
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
    const details = error?.error?.description || error.message;
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    return res.status(statusCode).json({
      error: "Unable to create order",
      details,
    });
  }
});

function verifyPaymentSignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}

app.post("/payment/callback", async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).send("Missing payment details.");
    }

    const isAuthentic = verifyPaymentSignature(orderId, paymentId, signature);

    const saved = await savePaymentRecord({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      is_signature_valid: isAuthentic,
    });

    if (!isAuthentic) {
      return res.status(400).send("Payment signature verification failed.");
    }

    const order = await razorpay.orders.fetch(orderId);
    const amountInRupees = Number(order.amount) / 100;
    const params = new URLSearchParams({
      amount: String(amountInRupees),
      payment_id: paymentId,
      method: "UPI",
      stored_at: saved.created_at,
    });

    return res.redirect(`/payment-success.html?${params.toString()}`);
  } catch (error) {
    console.error("Payment callback failed:", error);
    return res.status(500).send("Unable to process payment callback.");
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
    const isAuthentic = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

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
