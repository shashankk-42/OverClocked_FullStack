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

function formatContact(value) {
  const digits = String(value).replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return value;
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
    const message = err.details
      ? `${err.error}: ${err.details}`
      : err.error || "Order creation failed";
    throw new Error(message);
  }

  return response.json();
}

async function getPublicConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Unable to load Razorpay configuration");
  }
  return response.json();
}

function buildCheckoutOptions(order, keyId) {
  return {
    key: keyId,
    amount: order.amount,
    currency: order.currency,
    name: "Razorpay Test Sandbox",
    description: "Local integration test",
    image: "https://cdn.razorpay.com/logo.svg",
    order_id: order.id,
    callback_url: `${window.location.origin}/payment/callback`,
    redirect: true,
    prefill: {
      name: nameInput.value,
      email: emailInput.value,
      contact: formatContact(contactInput.value),
    },
    readonly: {
      contact: true,
    },
    theme: {
      color: "#ea580c",
    },
    config: {
      display: {
        blocks: {
          upi: {
            name: "Pay via UPI",
            instruments: [{ method: "upi" }],
          },
          card: {
            name: "Pay via Card",
            instruments: [{ method: "card" }],
          },
          emi: {
            name: "Pay via EMI",
            instruments: [{ method: "emi" }],
          },
          netbanking: {
            name: "Netbanking",
            instruments: [{ method: "netbanking" }],
          },
          wallet: {
            name: "Wallet",
            instruments: [{ method: "wallet" }],
          },
          paylater: {
            name: "Pay Later",
            instruments: [{ method: "paylater" }],
          },
        },
        sequence: [
          "block.upi",
          "block.card",
          "block.emi",
          "block.netbanking",
          "block.wallet",
          "block.paylater",
        ],
        preferences: {
          show_default_blocks: true,
        },
      },
    },
    modal: {
      ondismiss: function () {
        setStatus("info", "Checkout closed. You can retry payment anytime.");
      },
    },
  };
}

payBtn.addEventListener("click", async () => {
  try {
    payBtn.disabled = true;
    setStatus("info", "Creating order...");

    const amount = Number(amountInput.value);
    const order = await createOrder(amount);
    const { keyId } = await getPublicConfig();
    const checkout = new Razorpay(buildCheckoutOptions(order, keyId));

    checkout.on("payment.failed", function (response) {
      const reason = response?.error?.description || "Payment failed.";
      setStatus(
        "error",
        `${reason} Use UPI success@razorpay, Netbanking Success, or Indian test card 5267 3181 8797 5449.`
      );
      printResult(response.error);
    });

    setStatus("info", "Opening Razorpay checkout...");
    checkout.open();
  } catch (error) {
    setStatus("error", error.message || "Something went wrong");
    printResult({ error: error.message || String(error) });
  } finally {
    payBtn.disabled = false;
  }
});
