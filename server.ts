import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.VERCEL ? "/tmp/stock.db" : "stock.db";
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    min_level INTEGER DEFAULT 0,
    is_core BOOLEAN DEFAULT 0,
    unit TEXT DEFAULT 'units'
  );

  CREATE TABLE IF NOT EXISTS daily_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('enough', 'low', 'critical')) NOT NULL,
    quantity_needed INTEGER DEFAULT 0,
    is_urgent BOOLEAN DEFAULT 0,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    staff_name TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    cost REAL DEFAULT 0,
    store TEXT,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );
`);

// Seed initial items if empty
const itemCount = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
if (itemCount.count === 0) {
  const insertItem = db.prepare("INSERT INTO items (name, category, is_core, unit) VALUES (?, ?, ?, ?)");
  const initialItems = [
    ['Milk (Full cream)', 'Coffee & Beverages', 1, 'cartons'],
    ['Milk (Almond)', 'Coffee & Beverages', 1, 'cartons'],
    ['Coffee beans', 'Coffee & Beverages', 1, 'kg'],
    ['Sugar', 'Coffee & Beverages', 0, 'bags'],
    ['Syrups', 'Coffee & Beverages', 0, 'bottles'],
    ['Bread', 'Kitchen Items', 1, 'loaves'],
    ['Eggs', 'Kitchen Items', 1, 'trays'],
    ['Cheese', 'Kitchen Items', 0, 'blocks'],
    ['Butter', 'Kitchen Items', 0, 'packs'],
    ['Tomatoes', 'Kitchen Items', 0, 'kg'],
    ['Muffins', 'Bakery Items', 0, 'units'],
    ['Croissants', 'Bakery Items', 0, 'units'],
    ['Cookies', 'Bakery Items', 0, 'units'],
  ];
  initialItems.forEach(item => insertItem.run(...item));
}

const app = express();
app.use(express.json());

async function startServer() {
  const PORT = 3000;

  // API Routes
  app.get("/api/items", (req, res) => {
    const items = db.prepare("SELECT * FROM items ORDER BY category, name").all();
    res.json(items);
  });

  app.post("/api/items", (req, res) => {
    const { name, category, min_level, is_core, unit } = req.body;
    const info = db.prepare("INSERT INTO items (name, category, min_level, is_core, unit) VALUES (?, ?, ?, ?, ?)").run(name, category, min_level, is_core ? 1 : 0, unit);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/items/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/checks/today", (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    const checks = db.prepare(`
      SELECT dc.*, i.name, i.category, i.is_core, i.unit 
      FROM daily_checks dc 
      JOIN items i ON dc.item_id = i.id 
      WHERE dc.date = ?
    `).all(date);
    res.json(checks);
  });

  app.post("/api/checks", (req, res) => {
    const { items, staff_name } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    const deleteOld = db.prepare("DELETE FROM daily_checks WHERE date = ?");
    const insertCheck = db.prepare(`
      INSERT INTO daily_checks (date, item_id, status, quantity_needed, is_urgent, staff_name) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((checks) => {
      deleteOld.run(date);
      for (const check of checks) {
        insertCheck.run(date, check.item_id, check.status, check.quantity_needed, check.is_urgent ? 1 : 0, staff_name);
      }
    });

    transaction(items);
    res.json({ success: true });
  });

  app.get("/api/reports", (req, res) => {
    const reports = db.prepare("SELECT * FROM reports ORDER BY date DESC LIMIT 30").all();
    res.json(reports);
  });

  app.post("/api/reports", (req, res) => {
    const { staff_name, items_needed } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const info = db.prepare("INSERT INTO reports (date, staff_name) VALUES (?, ?)").run(date, staff_name);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/purchases", (req, res) => {
    const purchases = db.prepare(`
      SELECT p.*, i.name 
      FROM purchases p 
      JOIN items i ON p.item_id = i.id 
      ORDER BY p.date DESC
    `).all();
    res.json(purchases);
  });

  app.post("/api/purchases", (req, res) => {
    const { item_id, quantity, cost, store } = req.body;
    const date = new Date().toISOString().split('T')[0];
    db.prepare("INSERT INTO purchases (date, item_id, quantity, cost, store) VALUES (?, ?, ?, ?, ?)").run(date, item_id, quantity, cost, store);
    res.json({ success: true });
  });

  app.get("/api/stats/weekly", (req, res) => {
    const stats = db.prepare(`
      SELECT i.name, SUM(p.quantity) as total_quantity, SUM(p.cost) as total_cost
      FROM purchases p
      JOIN items i ON p.item_id = i.id
      WHERE p.date >= date('now', '-7 days')
      GROUP BY i.id
    `).all();

    const storeStats = db.prepare(`
      SELECT store, SUM(cost) as total_cost
      FROM purchases
      WHERE date >= date('now', '-7 days') AND store IS NOT NULL
      GROUP BY store
    `).all();

    res.json({ items: stats, stores: storeStats });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
