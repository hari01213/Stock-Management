import express from "express";
import Database from "better-sqlite3";
import { sql } from "@vercel/postgres";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!process.env.VERCEL;
const usePostgres = isVercel && !!process.env.POSTGRES_URL;

// SQLite setup for local dev
const dbPath = isVercel ? "/tmp/stock.db" : "stock.db";
const sqlite = new Database(dbPath);

// Initialize Database (SQLite)
if (!usePostgres) {
  sqlite.exec(`
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

  // Seed initial items if empty (SQLite)
  const itemCount = sqlite.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
  if (itemCount.count === 0) {
    const insertItem = sqlite.prepare("INSERT INTO items (name, category, is_core, unit) VALUES (?, ?, ?, ?)");
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
}

const app = express();
app.use(express.json());

// Helper to initialize Postgres tables
async function initPostgres() {
  if (!usePostgres) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        min_level INTEGER DEFAULT 0,
        is_core BOOLEAN DEFAULT FALSE,
        unit TEXT DEFAULT 'units'
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS daily_checks (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        item_id INTEGER NOT NULL REFERENCES items(id),
        status TEXT NOT NULL,
        quantity_needed INTEGER DEFAULT 0,
        is_urgent BOOLEAN DEFAULT FALSE,
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        staff_name TEXT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        item_id INTEGER NOT NULL REFERENCES items(id),
        quantity INTEGER NOT NULL,
        cost FLOAT DEFAULT 0,
        store TEXT,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed initial items if empty (Postgres)
    const { rows } = await sql`SELECT COUNT(*) as count FROM items`;
    if (parseInt(rows[0].count) === 0) {
      const initialItems = [
        ['Milk (Full cream)', 'Coffee & Beverages', true, 'cartons'],
        ['Milk (Almond)', 'Coffee & Beverages', true, 'cartons'],
        ['Coffee beans', 'Coffee & Beverages', true, 'kg'],
        ['Sugar', 'Coffee & Beverages', false, 'bags'],
        ['Syrups', 'Coffee & Beverages', false, 'bottles'],
        ['Bread', 'Kitchen Items', true, 'loaves'],
        ['Eggs', 'Kitchen Items', true, 'trays'],
        ['Cheese', 'Kitchen Items', false, 'blocks'],
        ['Butter', 'Kitchen Items', false, 'packs'],
        ['Tomatoes', 'Kitchen Items', false, 'kg'],
        ['Muffins', 'Bakery Items', false, 'units'],
        ['Croissants', 'Bakery Items', false, 'units'],
        ['Cookies', 'Bakery Items', false, 'units'],
      ];
      for (const item of initialItems) {
        await sql`INSERT INTO items (name, category, is_core, unit) VALUES (${item[0]}, ${item[1]}, ${item[2]}, ${item[3]})`;
      }
    }
  } catch (err) {
    console.error("Postgres init error:", err);
  }
}

// API Routes
app.get("/api/items", async (req, res) => {
  try {
    if (usePostgres) {
      const { rows } = await sql`SELECT * FROM items ORDER BY category, name`;
      res.json(rows);
    } else {
      const items = sqlite.prepare("SELECT * FROM items ORDER BY category, name").all();
      res.json(items);
    }
  } catch (err: any) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/items", async (req, res) => {
  try {
    const { name, category, min_level, is_core, unit } = req.body;
    if (usePostgres) {
      const { rows } = await sql`
        INSERT INTO items (name, category, min_level, is_core, unit) 
        VALUES (${name}, ${category}, ${min_level}, ${is_core}, ${unit})
        RETURNING id
      `;
      res.json({ id: rows[0].id });
    } else {
      const info = sqlite.prepare("INSERT INTO items (name, category, min_level, is_core, unit) VALUES (?, ?, ?, ?, ?)").run(name, category, min_level, is_core ? 1 : 0, unit);
      res.json({ id: info.lastInsertRowid });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (usePostgres) {
      await sql`DELETE FROM items WHERE id = ${id}`;
    } else {
      sqlite.prepare("DELETE FROM items WHERE id = ?").run(id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checks/today", async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    if (usePostgres) {
      const { rows } = await sql`
        SELECT dc.*, i.name, i.category, i.is_core, i.unit 
        FROM daily_checks dc 
        JOIN items i ON dc.item_id = i.id 
        WHERE dc.date = ${date}
      `;
      res.json(rows);
    } else {
      const checks = sqlite.prepare(`
        SELECT dc.*, i.name, i.category, i.is_core, i.unit 
        FROM daily_checks dc 
        JOIN items i ON dc.item_id = i.id 
        WHERE dc.date = ?
      `).all(date);
      res.json(checks);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checks", async (req, res) => {
  try {
    const { items, staff_name } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    if (usePostgres) {
      await sql`DELETE FROM daily_checks WHERE date = ${date}`;
      for (const check of items) {
        await sql`
          INSERT INTO daily_checks (date, item_id, status, quantity_needed, is_urgent, staff_name) 
          VALUES (${date}, ${check.item_id}, ${check.status}, ${check.quantity_needed || 0}, ${check.is_urgent}, ${staff_name})
        `;
      }
    } else {
      const deleteOld = sqlite.prepare("DELETE FROM daily_checks WHERE date = ?");
      const insertCheck = sqlite.prepare(`
        INSERT INTO daily_checks (date, item_id, status, quantity_needed, is_urgent, staff_name) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const transaction = sqlite.transaction((checks) => {
        deleteOld.run(date);
        for (const check of checks) {
          insertCheck.run(date, check.item_id, check.status, check.quantity_needed || 0, check.is_urgent ? 1 : 0, staff_name);
        }
      });
      transaction(items);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/purchases", async (req, res) => {
  try {
    if (usePostgres) {
      const { rows } = await sql`
        SELECT p.*, i.name 
        FROM purchases p 
        JOIN items i ON p.item_id = i.id 
        ORDER BY p.date DESC
      `;
      res.json(rows);
    } else {
      const purchases = sqlite.prepare(`
        SELECT p.*, i.name 
        FROM purchases p 
        JOIN items i ON p.item_id = i.id 
        ORDER BY p.date DESC
      `).all();
      res.json(purchases);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/purchases", async (req, res) => {
  try {
    const { item_id, quantity, cost, store } = req.body;
    const date = new Date().toISOString().split('T')[0];
    if (usePostgres) {
      await sql`
        INSERT INTO purchases (date, item_id, quantity, cost, store) 
        VALUES (${date}, ${item_id}, ${quantity}, ${cost}, ${store})
      `;
    } else {
      sqlite.prepare("INSERT INTO purchases (date, item_id, quantity, cost, store) VALUES (?, ?, ?, ?, ?)").run(date, item_id, quantity, cost, store);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats/weekly", async (req, res) => {
  try {
    if (usePostgres) {
      const { rows: items } = await sql`
        SELECT i.name, SUM(p.quantity) as total_quantity, SUM(p.cost) as total_cost
        FROM purchases p
        JOIN items i ON p.item_id = i.id
        WHERE p.date >= CAST(CURRENT_DATE - INTERVAL '7 days' AS TEXT)
        GROUP BY i.id, i.name
      `;

      const { rows: stores } = await sql`
        SELECT store, SUM(cost) as total_cost
        FROM purchases
        WHERE date >= CAST(CURRENT_DATE - INTERVAL '7 days' AS TEXT) AND store IS NOT NULL
        GROUP BY store
      `;
      res.json({ items, stores });
    } else {
      const stats = sqlite.prepare(`
        SELECT i.name, SUM(p.quantity) as total_quantity, SUM(p.cost) as total_cost
        FROM purchases p
        JOIN items i ON p.item_id = i.id
        WHERE p.date >= date('now', '-7 days')
        GROUP BY i.id
      `).all();

      const storeStats = sqlite.prepare(`
        SELECT store, SUM(cost) as total_cost
        FROM purchases
        WHERE date >= date('now', '-7 days') AND store IS NOT NULL
        GROUP BY store
      `).all();

      res.json({ items: stats, stores: storeStats });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  await initPostgres();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      if (req.path.startsWith('/api/')) return;
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
