const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'wishlist.db');
const db = new DatabaseSync(DB_PATH);

// Helper for PIN hashing
function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString('hex');
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Toys & Games',
      price TEXT DEFAULT '',
      url TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      priority TEXT DEFAULT 'Normal',
      is_claimed INTEGER DEFAULT 0,
      buyer_name TEXT DEFAULT NULL,
      buyer_note TEXT DEFAULT NULL,
      buyer_token TEXT DEFAULT NULL,
      claimed_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Initialize default settings if not present
  const checkSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (!checkSetting.get('wishlist_title')) {
    insertSetting.run('wishlist_title', "Lily's Christmas Wishlist 🎄");
  }
  if (!checkSetting.get('daughter_name')) {
    insertSetting.run('daughter_name', 'Lily');
  }
  if (!checkSetting.get('intro_message')) {
    insertSetting.run(
      'intro_message',
      "Welcome! Here are some gift ideas Lily would love this Christmas. If you buy or plan to buy something, please click 'I Bought This' to mark it as claimed so others don't get the same thing. Thank you so much!"
    );
  }
  if (!checkSetting.get('admin_pin_hash')) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPin('santa2026', salt);
    insertSetting.run('admin_pin_salt', salt);
    insertSetting.run('admin_pin_hash', hash);
  }

  // Seed sample gifts if empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM items').get();
  if (countRow.count === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (title, description, category, price, url, image_url, priority, is_claimed, buyer_name, buyer_note, claimed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedItems = [
      {
        title: 'LEGO Disney Princess Enchanted Castle',
        description: 'Age 6+. Has the Cinderella and Belle mini-dolls. Lily saw this in the catalogue and loves it!',
        category: 'Toys & Games',
        price: '£44.99',
        url: 'https://www.amazon.co.uk',
        image_url: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=600&auto=format&fit=crop&q=80',
        priority: 'Most Wanted',
        is_claimed: 0,
      },
      {
        title: 'Roald Dahl 16-Book Magical Box Set',
        description: 'Paperback collection including Matilda, Charlie & The Chocolate Factory, and BFG.',
        category: 'Books',
        price: '£29.99',
        url: 'https://www.waterstones.com',
        image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80',
        priority: 'High',
        is_claimed: 0,
      },
      {
        title: 'Cozy Holiday Fleece Pyjama Set',
        description: 'Size 7-8 Years. Festive red or tartan plaid preferred.',
        category: 'Clothes',
        price: '£16.00',
        url: 'https://www.next.co.uk',
        image_url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&auto=format&fit=crop&q=80',
        priority: 'Normal',
        is_claimed: 0,
      },
      {
        title: 'Fujifilm Instax Mini 12 Instant Camera',
        description: 'Lilac Purple or Pastel Blue color. Would also love a pack of photo film!',
        category: 'Tech & Gadgets',
        price: '£69.99',
        url: 'https://www.currys.co.uk',
        image_url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
        priority: 'Most Wanted',
        is_claimed: 0,
      },
      {
        title: 'Deluxe 120-Piece Wooden Art Studio Set',
        description: 'Includes watercolours, acrylics, pastels, sketch pencils and brushes in a wooden carry case.',
        category: 'Arts & Crafts',
        price: '£24.99',
        url: 'https://www.amazon.co.uk',
        image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
        priority: 'High',
        is_claimed: 0,
      },
      {
        title: 'Spot It! (Dobble) Classic Family Card Game',
        description: 'Quick matching game for all ages. Perfect stocking filler!',
        category: 'Stocking Fillers',
        price: '£9.99',
        url: 'https://www.amazon.co.uk',
        image_url: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600&auto=format&fit=crop&q=80',
        priority: 'Normal',
        is_claimed: 0,
      },
      {
        title: 'Wireless Bluetooth Kids Cat-Ear Headphones',
        description: 'Volume-limited for children with LED light-up ears and built-in mic. Pink/Teal.',
        category: 'Tech & Gadgets',
        price: '£18.99',
        url: 'https://www.amazon.co.uk',
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
        priority: 'Normal',
        is_claimed: 0,
      },
      {
        title: 'Warm Chunky Knitted Bobble Hat & Mitten Set',
        description: 'Cream or soft pink fleece-lined winter accessories for cold walks.',
        category: 'Clothes',
        price: '£14.50',
        url: 'https://www.marksandspencer.com',
        image_url: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=600&auto=format&fit=crop&q=80',
        priority: 'Normal',
        is_claimed: 0,
      }
    ];

    for (const item of seedItems) {
      insertItem.run(
        item.title,
        item.description,
        item.category,
        item.price,
        item.url,
        item.image_url,
        item.priority,
        item.is_claimed,
        null,
        null,
        null
      );
    }
  }
}

// Public view sanitizes buyer details!
function getItems(isAdmin = false, myBuyerTokens = []) {
  const stmt = db.prepare("SELECT * FROM items ORDER BY is_claimed ASC, CASE priority WHEN 'Most Wanted' THEN 1 WHEN 'High' THEN 2 ELSE 3 END, id ASC");
  const rows = stmt.all();

  return rows.map(item => {
    const isMine = myBuyerTokens.includes(item.buyer_token);

    if (isAdmin) {
      // Admin sees everything
      return {
        ...item,
        is_mine: false
      };
    }

    // Public visitor view: NEVER reveal buyer_name or buyer_note!
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      price: item.price,
      url: item.url,
      image_url: item.image_url,
      priority: item.priority,
      is_claimed: item.is_claimed === 1,
      claimed_at: item.is_claimed === 1 ? item.claimed_at : null,
      is_mine: isMine,
      // buyer_name and buyer_note are intentionally omitted
    };
  });
}

function getItemById(id) {
  const stmt = db.prepare('SELECT * FROM items WHERE id = ?');
  return stmt.get(id);
}

function claimItem(id, buyerName, buyerNote = '') {
  const trimmedName = (buyerName || '').trim();
  if (!trimmedName) {
    return { success: false, error: 'Name is required' };
  }

  const existing = getItemById(id);
  if (!existing) {
    return { success: false, error: 'Item not found' };
  }
  if (existing.is_claimed === 1) {
    return { success: false, error: 'This item has already been claimed by someone else!' };
  }

  const buyerToken = crypto.randomUUID();
  const stmt = db.prepare(`
    UPDATE items 
    SET is_claimed = 1,
        buyer_name = ?,
        buyer_note = ?,
        buyer_token = ?,
        claimed_at = datetime('now')
    WHERE id = ? AND is_claimed = 0
  `);

  const res = stmt.run(trimmedName, (buyerNote || '').trim(), buyerToken, id);
  if (res.changes === 0) {
    return { success: false, error: 'Someone just claimed this gift a moment ago!' };
  }

  const updatedItem = getItemById(id);
  return {
    success: true,
    buyerToken,
    item: {
      id: updatedItem.id,
      title: updatedItem.title,
      is_claimed: true
    }
  };
}

function unclaimItem(id, tokenOrIsAdmin) {
  const item = getItemById(id);
  if (!item) {
    return { success: false, error: 'Item not found' };
  }

  const isPermitted = tokenOrIsAdmin === true || (tokenOrIsAdmin && item.buyer_token === tokenOrIsAdmin);
  if (!isPermitted) {
    return { success: false, error: 'Unauthorized to unclaim this item' };
  }

  const stmt = db.prepare(`
    UPDATE items 
    SET is_claimed = 0,
        buyer_name = NULL,
        buyer_note = NULL,
        buyer_token = NULL,
        claimed_at = NULL
    WHERE id = ?
  `);

  stmt.run(id);
  return { success: true };
}

function createItem({ title, description, category, price, url, image_url, priority }) {
  if (!title || !title.trim()) {
    return { success: false, error: 'Title is required' };
  }

  const stmt = db.prepare(`
    INSERT INTO items (title, description, category, price, url, image_url, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    title.trim(),
    (description || '').trim(),
    (category || 'General').trim(),
    (price || '').trim(),
    (url || '').trim(),
    (image_url || '').trim(),
    priority || 'Normal'
  );

  return { success: true, id: res.lastInsertRowid };
}

function updateItem(id, { title, description, category, price, url, image_url, priority }) {
  if (!title || !title.trim()) {
    return { success: false, error: 'Title is required' };
  }

  const stmt = db.prepare(`
    UPDATE items 
    SET title = ?,
        description = ?,
        category = ?,
        price = ?,
        url = ?,
        image_url = ?,
        priority = ?
    WHERE id = ?
  `);

  const res = stmt.run(
    title.trim(),
    (description || '').trim(),
    (category || 'General').trim(),
    (price || '').trim(),
    (url || '').trim(),
    (image_url || '').trim(),
    priority || 'Normal',
    id
  );

  return { success: res.changes > 0 };
}

function deleteItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  const res = stmt.run(id);
  return { success: res.changes > 0 };
}

function getSettings() {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all();
  const settings = {};
  for (const row of rows) {
    if (row.key !== 'admin_pin_hash' && row.key !== 'admin_pin_salt') {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

function updateSettings(newSettings) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(newSettings)) {
    if (key !== 'admin_pin_hash' && key !== 'admin_pin_salt') {
      stmt.run(key, String(value));
    }
  }
  return { success: true };
}

function verifyAdminPin(pin) {
  if (!pin) return false;
  const saltRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_salt'").get();
  const hashRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_hash'").get();
  if (!saltRow || !hashRow) return false;

  const hash = hashPin(pin, saltRow.value);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashRow.value, 'hex'));
}

function updateAdminPin(currentPin, newPin) {
  if (!verifyAdminPin(currentPin)) {
    return { success: false, error: 'Incorrect current PIN' };
  }
  if (!newPin || newPin.length < 4) {
    return { success: false, error: 'New PIN must be at least 4 characters long' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPin(newPin, salt);
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run('admin_pin_salt', salt);
  stmt.run('admin_pin_hash', hash);

  return { success: true };
}

function getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
  const claimed = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_claimed = 1').get().count;
  const available = total - claimed;

  return {
    total,
    claimed,
    available,
  };
}

module.exports = {
  initDb,
  getItems,
  getItemById,
  claimItem,
  unclaimItem,
  createItem,
  updateItem,
  deleteItem,
  getSettings,
  updateSettings,
  verifyAdminPin,
  updateAdminPin,
  getStats,
};
