const payBtn = document.getElementById("pay-btn");
const amountInput = document.getElementById("amount");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const contactInput = document.getElementById("contact");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

function printResult(payload) {
  resultEl.textContent = JSON.stringify(payload, null, 2);
}

async function createOrder(amount) {
  const response = await fetch("/api/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Order creation failed");
  }

  return response.json();
}

async function verifyPayment(paymentData) {
  const response = await fetch("/api/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentData),
  });

  return response.json();
}

async function getPublicConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Unable to load Razorpay configuration");
  }
  return response.json();
}

payBtn.addEventListener("click", async () => {
  try {
    payBtn.disabled = true;
    setStatus("info", "Creating order...");

    const amount = Number(amountInput.value);
    const order = await createOrder(amount);
    const { keyId } = await getPublicConfig();

    const options = {
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Razorpay Test Sandbox",
      description: "Local integration test",
      order_id: order.id,
      prefill: {
        name: nameInput.value,
        email: emailInput.value,
        contact: contactInput.value,
      },
      theme: {
        color: "#ea580c",
      },
      handler: async function (response) {
        setStatus("info", "Payment captured. Verifying signature...");

        const verification = await verifyPayment(response);
        const ok = verification.success;

        setStatus(ok ? "success" : "error", verification.message);
        printResult({
          order,
          payment: response,
          verification,
        });
      },
    };

    const checkout = new Razorpay(options);

    checkout.on("payment.failed", function (response) {
      setStatus("error", "Payment failed. Check failure details below.");
      printResult(response.error);
    });

    checkout.open();
  } catch (error) {
    setStatus("error", error.message || "Something went wrong");
    printResult({ error: error.message || String(error) });
  } finally {
    payBtn.disabled = false;
  }
});
