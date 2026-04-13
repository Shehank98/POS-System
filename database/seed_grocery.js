/**
 * Seed script — Green Valley Grocery
 * Creates a realistic grocery shop with products and transactions.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node database/seed_grocery.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Shop details ──────────────────────────────────────────────
const SHOP = {
  name:            'Green Valley Grocery',
  owner_name:      'Sarah Mitchell',
  email:           'sarah@greenvalleygrocery.com',
  phone:           '+1 (555) 247-3819',
  address:         '142 Main Street, Springfield, IL 62701',
};

// ── Staff credentials ─────────────────────────────────────────
const USERS = [
  { username: 'sarah_owner',   password: 'GVG2024!',     role: 'owner'   },
  { username: 'john_manager',  password: 'Manager2024!',  role: 'manager' },
  { username: 'emma_cashier',  password: 'Cashier2024!',  role: 'cashier' },
];

// ── Products ──────────────────────────────────────────────────
const PRODUCTS = [
  // Dairy
  { name: 'Whole Milk (1 Gallon)',       barcode: '4011', price: 4.29, cost: 2.80, stock: 45, category: 'Dairy',                 tax_rate: 0    },
  { name: 'Organic Eggs (12 ct)',        barcode: '4012', price: 5.99, cost: 3.50, stock: 60, category: 'Dairy',                 tax_rate: 0    },
  { name: 'Cheddar Cheese (8 oz)',       barcode: '4013', price: 3.79, cost: 2.20, stock: 38, category: 'Dairy',                 tax_rate: 0    },
  { name: 'Greek Yogurt (32 oz)',        barcode: '4014', price: 6.49, cost: 3.80, stock: 25, category: 'Dairy',                 tax_rate: 0    },
  { name: 'Butter (1 lb)',               barcode: '4015', price: 5.29, cost: 3.10, stock: 30, category: 'Dairy',                 tax_rate: 0    },
  // Bakery
  { name: 'White Bread (20 oz)',         barcode: '5001', price: 2.49, cost: 1.20, stock: 55, category: 'Bakery',                tax_rate: 0    },
  { name: 'Whole Wheat Bread (20 oz)',   barcode: '5002', price: 3.29, cost: 1.60, stock: 40, category: 'Bakery',                tax_rate: 0    },
  { name: 'Croissants (4-pack)',         barcode: '5003', price: 4.99, cost: 2.50, stock: 20, category: 'Bakery',                tax_rate: 0    },
  { name: 'Bagels (6-pack)',             barcode: '5004', price: 3.99, cost: 1.90, stock: 22, category: 'Bakery',                tax_rate: 0    },
  // Fruits & Vegetables
  { name: 'Bananas (per lb)',            barcode: '6001', price: 0.59, cost: 0.25, stock: 0,  category: 'Fruits & Vegetables',   tax_rate: 0,   has_inventory: false },
  { name: 'Gala Apples (3 lb bag)',      barcode: '6002', price: 4.49, cost: 2.20, stock: 35, category: 'Fruits & Vegetables',   tax_rate: 0    },
  { name: 'Baby Spinach (5 oz)',         barcode: '6003', price: 3.49, cost: 1.80, stock: 28, category: 'Fruits & Vegetables',   tax_rate: 0    },
  { name: 'Roma Tomatoes (per lb)',      barcode: '6004', price: 1.29, cost: 0.60, stock: 0,  category: 'Fruits & Vegetables',   tax_rate: 0,   has_inventory: false },
  { name: 'Russet Potatoes (5 lb)',      barcode: '6005', price: 3.99, cost: 1.80, stock: 50, category: 'Fruits & Vegetables',   tax_rate: 0    },
  { name: 'Broccoli (per head)',         barcode: '6006', price: 1.99, cost: 0.90, stock: 42, category: 'Fruits & Vegetables',   tax_rate: 0    },
  { name: 'Sweet Corn (per ear)',        barcode: '6007', price: 0.79, cost: 0.35, stock: 0,  category: 'Fruits & Vegetables',   tax_rate: 0,   has_inventory: false },
  // Beverages
  { name: 'Coca-Cola (2 Liter)',         barcode: '7001', price: 2.49, cost: 1.20, stock: 80, category: 'Beverages',             tax_rate: 5.5  },
  { name: 'Orange Juice (64 oz)',        barcode: '7002', price: 4.99, cost: 2.80, stock: 35, category: 'Beverages',             tax_rate: 0    },
  { name: 'Bottled Water (24-pack)',     barcode: '7003', price: 5.99, cost: 2.50, stock: 60, category: 'Beverages',             tax_rate: 0    },
  { name: 'Coffee (12 oz ground)',       barcode: '7004', price: 8.99, cost: 4.50, stock: 30, category: 'Beverages',             tax_rate: 5.5  },
  // Snacks
  { name: "Lay's Classic Chips (8 oz)", barcode: '8001', price: 4.29, cost: 2.00, stock: 55, category: 'Snacks',                tax_rate: 5.5  },
  { name: 'Oreo Cookies (14.3 oz)',      barcode: '8002', price: 4.49, cost: 2.20, stock: 48, category: 'Snacks',                tax_rate: 5.5  },
  { name: 'Granola Bars (6-pack)',       barcode: '8003', price: 5.49, cost: 2.80, stock: 40, category: 'Snacks',                tax_rate: 5.5  },
  // Pantry
  { name: 'Peanut Butter (16 oz)',       barcode: '9001', price: 3.99, cost: 2.00, stock: 45, category: 'Pantry',                tax_rate: 0    },
  { name: 'Strawberry Jam (18 oz)',      barcode: '9002', price: 3.29, cost: 1.60, stock: 38, category: 'Pantry',                tax_rate: 0    },
  { name: 'Pasta - Spaghetti (16 oz)',   barcode: '9003', price: 1.79, cost: 0.80, stock: 70, category: 'Pantry',                tax_rate: 0    },
  { name: 'Tomato Sauce (24 oz)',        barcode: '9004', price: 2.49, cost: 1.10, stock: 65, category: 'Pantry',                tax_rate: 0    },
  { name: 'Extra Virgin Olive Oil (16 oz)', barcode: '9005', price: 8.99, cost: 4.50, stock: 25, category: 'Pantry',            tax_rate: 0    },
  { name: 'Long Grain Rice (5 lb)',      barcode: '9006', price: 4.49, cost: 2.00, stock: 55, category: 'Pantry',                tax_rate: 0    },
  // Meat & Poultry (weighed, no inventory)
  { name: 'Chicken Breast (per lb)',     barcode: '3001', price: 4.99, cost: 2.80, stock: 0,  category: 'Meat & Poultry',        tax_rate: 0,   has_inventory: false },
  { name: 'Ground Beef 80/20 (per lb)', barcode: '3002', price: 5.99, cost: 3.50, stock: 0,  category: 'Meat & Poultry',        tax_rate: 0,   has_inventory: false },
  { name: 'Pork Chops (per lb)',         barcode: '3003', price: 4.49, cost: 2.50, stock: 0,  category: 'Meat & Poultry',        tax_rate: 0,   has_inventory: false },
];

// ── Transaction templates (items per transaction) ─────────────
// Each entry: array of [productIndex, qty], plus payment_method, daysAgo, hourOffset
const TXN_TEMPLATES = [
  { items: [[0,1],[1,1],[5,1],[10,1]],        method: 'cash',   daysAgo: 0, hour: 9  },
  { items: [[16,2],[18,1],[21,1]],             method: 'card',   daysAgo: 0, hour: 10 },
  { items: [[1,2],[2,1],[6,1],[23,1]],         method: 'card',   daysAgo: 0, hour: 11 },
  { items: [[0,2],[5,1],[8,1],[17,1]],         method: 'cash',   daysAgo: 0, hour: 13 },
  { items: [[29,2],[30,1.5],[11,1]],           method: 'mobile', daysAgo: 0, hour: 14 },
  { items: [[19,1],[25,2],[26,1],[27,1]],      method: 'card',   daysAgo: 0, hour: 15 },
  { items: [[9,2],[12,1.5],[14,2],[22,1]],     method: 'cash',   daysAgo: 0, hour: 16 },
  { items: [[3,1],[7,1],[20,1],[28,1]],        method: 'card',   daysAgo: 0, hour: 17 },
  { items: [[16,1],[21,2],[24,1]],             method: 'cash',   daysAgo: 1, hour: 9  },
  { items: [[0,1],[1,1],[2,1],[5,1],[8,1]],   method: 'card',   daysAgo: 1, hour: 10 },
  { items: [[29,1],[30,2],[11,1],[25,1]],      method: 'card',   daysAgo: 1, hour: 12 },
  { items: [[13,2],[15,3],[6,1],[17,1]],       method: 'mobile', daysAgo: 1, hour: 14 },
  { items: [[4,1],[23,1],[26,2]],              method: 'cash',   daysAgo: 1, hour: 15 },
  { items: [[18,2],[20,1],[27,1],[28,1]],      method: 'card',   daysAgo: 1, hour: 16 },
  { items: [[0,3],[5,2],[9,3],[12,2]],         method: 'cash',   daysAgo: 2, hour: 8  },
  { items: [[1,2],[3,1],[7,1],[16,2]],         method: 'card',   daysAgo: 2, hour: 11 },
  { items: [[10,1],[14,1],[21,1],[24,1]],      method: 'mobile', daysAgo: 2, hour: 13 },
  { items: [[6,1],[11,1],[22,1],[29,1]],       method: 'card',   daysAgo: 2, hour: 15 },
  { items: [[0,1],[2,1],[8,1],[19,1],[25,1]], method: 'cash',   daysAgo: 3, hour: 9  },
  { items: [[5,2],[13,2],[16,1],[30,1]],       method: 'card',   daysAgo: 3, hour: 11 },
  { items: [[1,1],[4,1],[17,1],[20,1]],        method: 'card',   daysAgo: 3, hour: 14 },
  { items: [[26,1],[27,2],[28,1]],             method: 'cash',   daysAgo: 4, hour: 10 },
  { items: [[9,4],[12,3],[15,2],[14,2]],       method: 'mobile', daysAgo: 4, hour: 12 },
  { items: [[0,2],[1,2],[2,1],[3,1],[5,1]],   method: 'card',   daysAgo: 4, hour: 16 },
  { items: [[16,3],[18,1],[21,1],[23,2]],      method: 'cash',   daysAgo: 5, hour: 9  },
  { items: [[6,1],[7,1],[25,1],[29,2]],        method: 'card',   daysAgo: 5, hour: 13 },
  { items: [[11,2],[13,3],[30,1]],             method: 'card',   daysAgo: 5, hour: 15 },
  { items: [[0,1],[8,1],[17,1],[20,1],[22,1]],method: 'cash',   daysAgo: 6, hour: 10 },
  { items: [[1,1],[3,1],[16,2],[26,1]],        method: 'mobile', daysAgo: 6, hour: 13 },
  { items: [[5,3],[10,2],[21,2],[27,1]],       method: 'card',   daysAgo: 6, hour: 15 },
];

function pad(n) { return String(n).padStart(2, '0'); }

function txnNumber(shopId, date) {
  return `TXN-${shopId}-${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting Green Valley Grocery seed...\n');

    // ── 1. Create shop ─────────────────────────────────────────
    const subEnd = new Date();
    subEnd.setFullYear(subEnd.getFullYear() + 1);

    const { rows: [shop] } = await client.query(
      `INSERT INTO shops
         (name, owner_name, email, phone, address,
          subscription_status, subscription_end_date, barcode_enabled, default_tax_rate)
       VALUES ($1,$2,$3,$4,$5,'active',$6,true,0)
       RETURNING *`,
      [SHOP.name, SHOP.owner_name, SHOP.email, SHOP.phone, SHOP.address, subEnd]
    );
    console.log(`✅ Shop created: "${shop.name}" (ID: ${shop.id})`);

    // ── 2. Create users ────────────────────────────────────────
    const userIds = {};
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const { rows: [user] } = await client.query(
        `INSERT INTO users (shop_id, username, password_hash, role)
         VALUES ($1,$2,$3,$4) RETURNING id, username, role`,
        [shop.id, u.username, hash, u.role]
      );
      userIds[u.role] = user.id;
      console.log(`   👤 User: ${user.username} (${user.role})`);
    }
    console.log();

    // ── 3. Create products ─────────────────────────────────────
    const productIds = [];
    for (const p of PRODUCTS) {
      const hasInv = p.has_inventory !== false;
      const { rows: [prod] } = await client.query(
        `INSERT INTO products
           (shop_id, name, barcode, price, cost_price, stock_quantity,
            has_inventory, category, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [shop.id, p.name, p.barcode, p.price, p.cost, p.stock,
         hasInv, p.category, p.tax_rate]
      );
      productIds.push(prod.id);
    }
    console.log(`✅ ${productIds.length} products created\n`);

    // ── 4. Create transactions ─────────────────────────────────
    const cashierRoles = ['owner', 'cashier', 'cashier', 'manager', 'cashier'];
    let txnCount = 0;

    for (let i = 0; i < TXN_TEMPLATES.length; i++) {
      const tmpl   = TXN_TEMPLATES[i];
      const userId = userIds[cashierRoles[i % cashierRoles.length]];

      const txnDate = new Date();
      txnDate.setDate(txnDate.getDate() - tmpl.daysAgo);
      txnDate.setHours(tmpl.hour, Math.floor(Math.random()*59), Math.floor(Math.random()*59), 0);

      // Build enriched items
      let subtotalSum = 0;
      let taxSum      = 0;
      const enriched  = [];

      for (const [pIdx, qty] of tmpl.items) {
        const p       = PRODUCTS[pIdx];
        const price   = parseFloat(p.price);
        const subtotal = price * qty;
        const taxAmt   = subtotal * (parseFloat(p.tax_rate) / 100);
        subtotalSum   += subtotal;
        taxSum        += taxAmt;
        enriched.push({ productId: productIds[pIdx], qty, price, subtotal });
      }

      const total  = subtotalSum + taxSum;
      const txnNum = txnNumber(shop.id, txnDate);

      const { rows: [txn] } = await client.query(
        `INSERT INTO transactions
           (shop_id, user_id, transaction_number, total_amount, tax_amount,
            discount_amount, payment_method, status, transaction_date)
         VALUES ($1,$2,$3,$4,$5,0,$6,'completed',$7) RETURNING id`,
        [shop.id, userId, txnNum, total.toFixed(2), taxSum.toFixed(2),
         tmpl.method, txnDate]
      );

      for (const item of enriched) {
        await client.query(
          `INSERT INTO transaction_items
             (transaction_id, product_id, quantity, unit_price, discount, subtotal)
           VALUES ($1,$2,$3,$4,0,$5)`,
          [txn.id, item.productId, item.qty, item.price, item.subtotal.toFixed(2)]
        );
      }
      txnCount++;
    }

    console.log(`✅ ${txnCount} transactions created\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏪 Shop:     Green Valley Grocery');
    console.log(`📋 Shop ID:  ${shop.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Login credentials:');
    console.log('  Owner:    sarah_owner   / GVG2024!');
    console.log('  Manager:  john_manager  / Manager2024!');
    console.log('  Cashier:  emma_cashier  / Cashier2024!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
