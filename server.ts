import express from "express";
import path from "path";
import fs from "fs";
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

  // Lazy Razorpay initialization
  let razorpayInstance: any = null;
  
  const getRazorpay = () => {
    if (razorpayInstance) return razorpayInstance;
    
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!key_id || !key_secret) {
      throw new Error("Razorpay API keys are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.");
    }
    
    // Handle potential ESM/CJS default export differences
    const RZP = (Razorpay as any).default || Razorpay;
    razorpayInstance = new RZP({
      key_id,
      key_secret,
    });
    
    return razorpayInstance;
  };

  // API Route to create Razorpay order
  app.post("/api/create-order", async (req, res) => {
    try {
      const rzp = getRazorpay();
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
        order = await rzp.orders.create(options);
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

  // Route to check if environment variables are set (for debugging)
  app.get("/api/env-check", (req, res) => {
    res.json({
      RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL
    });
  });

  // Vite middleware for development
  const isVercel = process.env.VERCEL === "1";
  const isProduction = process.env.NODE_ENV === "production" || isVercel;

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("Dist directory not found, static serving disabled");
    }
  }

  // Only listen if not running as a Vercel function
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const appPromise = startServer().catch(err => {
  console.error("Failed to start server:", err);
  throw err;
});

export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Function Error:", err);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
};
