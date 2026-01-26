require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware untuk parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint untuk menerima webhook dari Midtrans
app.post("/webhook/midtrans", async (req, res) => {
  try {
    const notification = req.body;

    console.log(
      "Received webhook from Midtrans:",
      JSON.stringify(notification, null, 2),
    );

    // Ekstrak order_id
    const { order_id } = notification;

    if (!order_id) {
      console.error("Missing order_id in webhook payload");
      return res.status(400).json({
        status: "error",
        message: "Missing order_id",
      });
    }

    // Tentukan target URL berdasarkan order_id prefix
    let targetUrl;

    if (order_id.startsWith("flxbt")) {
      targetUrl = process.env.FLEXBIT_API_URL;
      console.log(`Order ${order_id} → Forwarding to Flexbit`);
    } else if (order_id.startsWith("flx-ott")) {
      targetUrl = process.env.ONTHETOK_API_URL;
      console.log(`Order ${order_id} → Forwarding to OnTheTok`);
    } else {
      console.error(`Unknown order_id prefix: ${order_id}`);
      return res.status(400).json({
        status: "error",
        message: "Unknown order_id prefix",
      });
    }

    // Forward request ke target service
    try {
      const response = await axios.post(targetUrl, notification, {
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-From": "midtrans-gateway",
        },
        timeout: 10000, // 10 detik timeout
      });

      console.log(`Successfully forwarded to ${targetUrl}:`, response.status);

      // Return response dari target service ke Midtrans
      return res.status(200).json({
        status: "success",
        message: "Notification forwarded successfully",
      });
    } catch (forwardError) {
      console.error(`Error forwarding to ${targetUrl}:`, forwardError.message);

      // Tetap return 200 ke Midtrans agar tidak retry terus-menerus
      return res.status(200).json({
        status: "accepted",
        message: "Notification received but forwarding failed",
        error: forwardError.message,
      });
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Midtrans Gateway is running",
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Midtrans Gateway Server is Running`);
  console.log(
    `📡 Webhook endpoint: https://midtrans.iqbalm.my.id/webhook/midtrans`,
  );
  console.log(`🏥 Health check: https://midtrans.iqbalm.my.id/health`);
});
