const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./db.js');

// Initialize database
db.initDb();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-memory set of active admin session tokens
const activeAdminTokens = new Set();

// Active SSE client connections
const sseClients = new Set();

function broadcastEvent(type, payload = {}) {
  const data = JSON.stringify({ type, ...payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Keep SSE connections alive with periodic heartbeat comments
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000);

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function checkAdminAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1];
  return activeAdminTokens.has(token);
}

function getBuyerTokensFromHeader(req) {
  const header = req.headers['x-buyer-tokens'];
  if (!header) return [];
  try {
    const parsed = JSON.parse(header);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Buyer-Tokens',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // --- SSE Event Stream ---
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(': connected\n\n');
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // --- API Endpoints ---
    if (pathname.startsWith('/api/')) {
      const isAdmin = checkAdminAuth(req);

      // GET /api/wishlist
      if (pathname === '/api/wishlist' && req.method === 'GET') {
        const myBuyerTokens = getBuyerTokensFromHeader(req);
        const settings = db.getSettings();
        const items = db.getItems(isAdmin, myBuyerTokens);
        const stats = isAdmin ? db.getStats() : null;

        return sendJson(res, 200, {
          isAdmin,
          settings,
          items,
          stats,
        });
      }

      // POST /api/claim
      if (pathname === '/api/claim' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { itemId, buyerName, buyerNote } = body;

        if (!itemId || !buyerName) {
          return sendJson(res, 400, { error: 'Item ID and Your Name are required' });
        }

        const result = db.claimItem(Number(itemId), buyerName, buyerNote);
        if (!result.success) {
          return sendJson(res, 400, { error: result.error });
        }

        // Notify all clients in real-time
        broadcastEvent('claim', { itemId: Number(itemId) });

        return sendJson(res, 200, {
          success: true,
          buyerToken: result.buyerToken,
          item: result.item,
        });
      }

      // POST /api/unclaim
      if (pathname === '/api/unclaim' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { itemId, buyerToken } = body;

        if (!itemId) {
          return sendJson(res, 400, { error: 'Item ID is required' });
        }

        const result = db.unclaimItem(Number(itemId), isAdmin ? true : buyerToken);
        if (!result.success) {
          return sendJson(res, 403, { error: result.error });
        }

        broadcastEvent('unclaim', { itemId: Number(itemId) });
        return sendJson(res, 200, { success: true });
      }

      // POST /api/admin/login
      if (pathname === '/api/admin/login' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { pin } = body;

        if (!pin || !db.verifyAdminPin(pin)) {
          return sendJson(res, 401, { error: 'Incorrect PIN' });
        }

        const token = crypto.randomUUID();
        activeAdminTokens.add(token);
        return sendJson(res, 200, { success: true, token });
      }

      // POST /api/admin/logout
      if (pathname === '/api/admin/logout' && req.method === 'POST') {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          if (match) activeAdminTokens.delete(match[1]);
        }
        return sendJson(res, 200, { success: true });
      }

      // Protected Admin Routes
      if (pathname.startsWith('/api/admin/')) {
        if (!isAdmin) {
          return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
        }

        // POST /api/admin/item (Create)
        if (pathname === '/api/admin/item' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const result = db.createItem(body);
          if (!result.success) {
            return sendJson(res, 400, { error: result.error });
          }
          broadcastEvent('new_item', { id: result.id });
          return sendJson(res, 201, result);
        }

        // PUT /api/admin/item/:id (Update)
        const itemUpdateMatch = pathname.match(/^\/api\/admin\/item\/(\d+)$/);
        if (itemUpdateMatch && req.method === 'PUT') {
          const id = Number(itemUpdateMatch[1]);
          const body = await parseJsonBody(req);
          const result = db.updateItem(id, body);
          if (!result.success) {
            return sendJson(res, 400, { error: 'Failed to update item' });
          }
          broadcastEvent('update_item', { id });
          return sendJson(res, 200, { success: true });
        }

        // DELETE /api/admin/item/:id (Delete)
        const itemDeleteMatch = pathname.match(/^\/api\/admin\/item\/(\d+)$/);
        if (itemDeleteMatch && req.method === 'DELETE') {
          const id = Number(itemDeleteMatch[1]);
          const result = db.deleteItem(id);
          if (!result.success) {
            return sendJson(res, 400, { error: 'Failed to delete item' });
          }
          broadcastEvent('delete_item', { id });
          return sendJson(res, 200, { success: true });
        }

        // POST /api/admin/settings
        if (pathname === '/api/admin/settings' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          db.updateSettings(body);
          broadcastEvent('settings_updated', { settings: db.getSettings() });
          return sendJson(res, 200, { success: true });
        }

        // POST /api/admin/change-pin
        if (pathname === '/api/admin/change-pin' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const { currentPin, newPin } = body;
          const result = db.updateAdminPin(currentPin, newPin);
          if (!result.success) {
            return sendJson(res, 400, { error: result.error });
          }
          return sendJson(res, 200, { success: true });
        }

        // GET /api/admin/export (CSV)
        if (pathname === '/api/admin/export' && req.method === 'GET') {
          const items = db.getItems(true);
          let csv = 'Item ID,Title,Category,Price,Status,Buyer Name,Buyer Note,Claimed Date,Store URL\n';
          for (const item of items) {
            const status = item.is_claimed ? 'Claimed' : 'Available';
            const clean = val => `"${String(val || '').replace(/"/g, '""')}"`;
            csv += `${item.id},${clean(item.title)},${clean(item.category)},${clean(item.price)},${status},${clean(item.buyer_name)},${clean(item.buyer_note)},${clean(item.claimed_at)},${clean(item.url)}\n`;
          }
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="christmas-gifts-checklist.csv"',
          });
          return res.end(csv);
        }
      }

      return sendJson(res, 404, { error: 'API route not found' });
    }

    // --- Static File Serving ---
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') {
      safePath = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);

    // Guard against directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access Denied');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA if not found
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎄 Christmas Wishlist server running on http://localhost:${PORT}`);
  console.log(`🔒 Default Parent/Admin PIN: santa2026`);
});

module.exports = server;
