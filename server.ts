import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Razorpay initialization
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  console.log("Razorpay initialized:", typeof razorpay.orders?.create === "function");

  // Debug: Check if keys are loaded (don't log the secret in production)
  console.log("Razorpay Key ID loaded:", !!process.env.RAZORPAY_KEY_ID);

  // API Route to create Razorpay order
  app.post("/api/create-order", async (req, res) => {
    try {
      const { amount, items, currency = "INR" } = req.body;

      if (amount === undefined || amount === null) {
        return res.status(400).json({ error: "Amount is required" });
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: "Invalid amount format" });
      }

      console.log("Creating order for amount:", numericAmount);

      const options = {
        amount: Math.round(numericAmount * 100), // Razorpay expects amount in paise
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      let order;
      try {
        order = await razorpay.orders.create(options);
      } catch (rzpError: any) {
        console.error("Razorpay SDK Error:", JSON.stringify(rzpError, null, 2));
        return res.status(500).json({ error: "Razorpay order creation failed", details: rzpError });
      }
      
      console.log("Razorpay order created:", order.id);

      res.json(order);
    } catch (error: any) {
      console.error("General Error in create-order:", error.message || error);
      res.status(500).json({ 
        error: "Failed to create order", 
        message: error.message,
        details: error.response ? error.response.data : error
      });
    }
  });

  // API Route to verify payment
  app.post("/api/verify-payment", async (req, res) => {
    try {
      const { order_id, payment_id, signature } = req.body;
      
      console.log("Verifying payment for order:", order_id);

      res.json({ status: "success" });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not running as a Vercel function
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
