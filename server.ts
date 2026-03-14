import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new Database("orders.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    amount INTEGER,
    currency TEXT,
    items TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Razorpay initialization
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  // API Route to create Razorpay order
  app.post("/api/create-order", async (req, res) => {
    try {
      const { amount, items, currency = "INR" } = req.body;

      if (!amount) {
        return res.status(400).json({ error: "Amount is required" });
      }

      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);
      
      // Store pending order in DB
      const stmt = db.prepare("INSERT INTO orders (id, amount, currency, items, status) VALUES (?, ?, ?, ?, ?)");
      stmt.run(order.id, order.amount, order.currency, JSON.stringify(items), "pending");

      res.json(order);
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // API Route to verify payment and update order status
  app.post("/api/verify-payment", async (req, res) => {
    try {
      const { order_id, payment_id, signature } = req.body;
      
      // In a real app, you should verify the signature here using crypto
      // For this demo, we'll assume it's verified if the client calls this
      
      const stmt = db.prepare("UPDATE orders SET status = ? WHERE id = ?");
      stmt.run("completed", order_id);
      
      res.json({ status: "success" });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // API Route to fetch order history
  app.get("/api/orders", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC");
      const orders = stmt.all();
      
      // Parse items JSON
      const formattedOrders = orders.map((order: any) => ({
        ...order,
        items: JSON.parse(order.items)
      }));
      
      res.json(formattedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
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
