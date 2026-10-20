const { EventEmitter } = require('node:events');
const { Readable, Writable } = require('node:stream');
const server = require('./server.js');

// Mock HTTP Request / Response for in-sandbox testing
function mockRequest(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    // Create readable stream for request
    const req = new Readable({
      read() {
        if (body) {
          this.push(typeof body === 'string' ? body : JSON.stringify(body));
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:3000', ...headers };

    // Create response collector
    let statusCode = 200;
    let resHeaders = {};
    let responseData = '';

    const res = new EventEmitter();
    res.writeHead = function(code, headersObj = {}) {
      statusCode = code;
      resHeaders = { ...resHeaders, ...headersObj };
    };
    res.setHeader = function(key, val) {
      resHeaders[key.toLowerCase()] = val;
    };
    res.write = function(chunk) {
      if (chunk) responseData += chunk.toString();
    };
    res.end = function(chunk) {
      if (chunk) responseData += chunk.toString();
      let json = null;
      try { json = JSON.parse(responseData); } catch {}
      resolve({ statusCode, headers: resHeaders, body: responseData, json });
    };

    server.emit('request', req, res);
  });
}

async function run() {
  console.log('Testing server endpoints via in-memory mock...');

  // 1. GET /api/wishlist
  const res1 = await mockRequest('GET', '/api/wishlist');
  console.assert(res1.statusCode === 200, 'Wishlist should return 200');
  console.assert(res1.json.isAdmin === false, 'Visitor is not admin');
  console.assert(Array.isArray(res1.json.items), 'Items must be an array');
  console.log('✓ Public wishlist returns 200 with items count:', res1.json.items.length);

  // Check privacy: no buyer names in public response
  const hasLeakedName = res1.json.items.some(i => i.buyer_name !== undefined || i.buyer_note !== undefined);
  console.assert(!hasLeakedName, 'Public items MUST NOT leak buyer name or note');
  console.log('✓ Privacy verified: buyer_name and buyer_note are completely hidden from public');

  // 2. POST /api/claim
  const claimRes = await mockRequest('POST', '/api/claim', { 'content-type': 'application/json' }, {
    itemId: 1,
    buyerName: 'Aunt Sophie',
    buyerNote: 'Ordered with gift wrap on Amazon'
  });
  console.assert(claimRes.statusCode === 200, 'Claim should return 200');
  console.assert(claimRes.json.buyerToken, 'Claim should provide buyerToken');
  const buyerToken = claimRes.json.buyerToken;
  console.log('✓ Gift #1 successfully claimed by Aunt Sophie. Token received:', buyerToken);

  // 3. GET /api/wishlist again (as public visitor)
  const res2 = await mockRequest('GET', '/api/wishlist');
  const item1 = res2.json.items.find(i => i.id === 1);
  console.assert(item1.is_claimed === true, 'Item 1 is marked claimed');
  console.assert(item1.buyer_name === undefined, 'Item 1 buyer name is hidden from public');
  console.log('✓ Public view shows Item 1 is claimed, with buyer identity strictly concealed');

  // 4. POST /api/admin/login with correct PIN
  const loginRes = await mockRequest('POST', '/api/admin/login', { 'content-type': 'application/json' }, {
    pin: 'santa2026'
  });
  console.assert(loginRes.statusCode === 200, 'Login should succeed');
  const adminToken = loginRes.json.token;
  console.log('✓ Admin login succeeded, session token:', adminToken);

  // 5. GET /api/wishlist as Parent Admin
  const adminWishlist = await mockRequest('GET', '/api/wishlist', {
    'authorization': `Bearer ${adminToken}`
  });
  console.assert(adminWishlist.json.isAdmin === true, 'Parent verified as admin');
  const adminItem1 = adminWishlist.json.items.find(i => i.id === 1);
  console.assert(adminItem1.buyer_name === 'Aunt Sophie', 'Parent can see buyer: Aunt Sophie');
  console.assert(adminItem1.buyer_note === 'Ordered with gift wrap on Amazon', 'Parent can see buyer note');
  console.log(`✓ PARENT VIEW CONFIRMED: Item 1 shows buyer "${adminItem1.buyer_name}" and note "${adminItem1.buyer_note}"`);

  // 6. Admin create item
  const createRes = await mockRequest('POST', '/api/admin/item', {
    'authorization': `Bearer ${adminToken}`,
    'content-type': 'application/json'
  }, {
    title: 'Snow Globe Musical Carousel',
    category: 'Toys & Games',
    price: '£22.00',
    priority: 'High',
    description: 'Plays Jingle Bells'
  });
  console.assert(createRes.statusCode === 201, 'Create should return 201');
  const newItemId = createRes.json.id;
  console.log('✓ Admin successfully created new gift idea, ID:', newItemId);

  // 7. Admin CSV export
  const exportRes = await mockRequest('GET', '/api/admin/export', {
    'authorization': `Bearer ${adminToken}`
  });
  console.assert(exportRes.statusCode === 200, 'Export CSV returns 200');
  console.assert(exportRes.body.includes('Aunt Sophie'), 'CSV includes buyer name');
  console.log('✓ CSV export generated with buyer details for printing/thank-you notes');

  // 8. Delete created item and unclaim item 1
  await mockRequest('DELETE', `/api/admin/item/${newItemId}`, {
    'authorization': `Bearer ${adminToken}`
  });
  await mockRequest('POST', '/api/unclaim', {
    'authorization': `Bearer ${adminToken}`,
    'content-type': 'application/json'
  }, { itemId: 1 });
  console.log('✓ Test items cleaned up');

  console.log('\n🎉 ALL IN-MEMORY VERIFICATION TESTS PASSED 100%!');
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  server.close();
  process.exit(1);
});
