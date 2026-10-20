// Christmas Wishlist Client Application
let state = {
  items: [],
  settings: {},
  stats: null,
  isAdmin: false,
  adminToken: localStorage.getItem('wishlist_admin_token') || null,
  selectedCategory: 'all',
  statusFilter: 'all',
  searchQuery: '',
  activeClaimItemId: null,
  activeEditItemId: null,
  snowEnabled: true,
};

// Retrieve visitor's saved buyer tokens from localStorage
function getMyBuyerTokens() {
  try {
    return JSON.parse(localStorage.getItem('my_buyer_tokens') || '{}');
  } catch {
    return {};
  }
}

function saveMyBuyerToken(itemId, token) {
  const tokens = getMyBuyerTokens();
  tokens[itemId] = token;
  localStorage.setItem('my_buyer_tokens', JSON.stringify(tokens));
}

function removeMyBuyerToken(itemId) {
  const tokens = getMyBuyerTokens();
  delete tokens[itemId];
  localStorage.setItem('my_buyer_tokens', JSON.stringify(tokens));
}

// Request Helper
async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.adminToken) {
    headers['Authorization'] = `Bearer ${state.adminToken}`;
  }

  const myTokens = Object.values(getMyBuyerTokens());
  headers['X-Buyer-Tokens'] = JSON.stringify(myTokens);

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data;
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✨' : '🎄'}</span> <div>${escapeHtml(message)}</div>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// HTML Escaping
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Category Icons Mapping
const CATEGORY_ICONS = {
  'Toys & Games': '🧸',
  'Books': '📚',
  'Clothes': '🧣',
  'Arts & Crafts': '🎨',
  'Tech & Gadgets': '🎧',
  'Stocking Fillers': '🧦',
  'General': '🎁'
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '🎁';
}

// Fetch Initial Data
async function loadWishlist(silent = false) {
  try {
    const data = await apiRequest('/api/wishlist');
    state.settings = data.settings || {};
    state.items = data.items || [];
    state.isAdmin = Boolean(data.isAdmin);
    state.stats = data.stats || null;

    if (!silent) {
      updateHeader();
    }
    renderAdminBar();
    renderCategories();
    renderGiftCards();
  } catch (err) {
    console.error('Failed to load wishlist:', err);
    if (!silent) {
      showToast('Could not load gift wishlist', 'info');
    }
  }
}

// Header & Countdown
function updateHeader() {
  const titleEl = document.getElementById('wishlist-title');
  const introEl = document.getElementById('wishlist-intro');
  const daysEl = document.getElementById('christmas-days');

  if (titleEl && state.settings.wishlist_title) {
    titleEl.textContent = state.settings.wishlist_title;
    document.title = state.settings.wishlist_title;
  }
  if (introEl && state.settings.intro_message) {
    introEl.textContent = state.settings.intro_message;
  }

  // Days until Christmas
  if (daysEl) {
    const now = new Date();
    const currentYear = now.getFullYear();
    let christmas = new Date(currentYear, 11, 25); // Dec 25
    if (now > christmas) {
      christmas = new Date(currentYear + 1, 11, 25);
    }
    const diffTime = christmas - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysEl.textContent = `${diffDays} days until Christmas!`;
  }

  // Stats chips
  const total = state.items.length;
  const claimed = state.items.filter(i => i.is_claimed).length;
  const available = total - claimed;

  const statsContainer = document.getElementById('header-stats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-chip">🎁 ${total} Gift Ideas</div>
      <div class="stat-chip">✨ ${available} Available</div>
      <div class="stat-chip">✅ ${claimed} Claimed</div>
    `;
  }
}

// Render Admin Top Banner
function renderAdminBar() {
  const adminBar = document.getElementById('admin-bar');
  const adminToggleBtn = document.getElementById('admin-toggle-btn');

  if (state.isAdmin) {
    adminBar.style.display = 'flex';
    if (adminToggleBtn) {
      adminToggleBtn.classList.add('admin-active');
      adminToggleBtn.innerHTML = '👑 Parent Mode Active';
    }
  } else {
    adminBar.style.display = 'none';
    if (adminToggleBtn) {
      adminToggleBtn.classList.remove('admin-active');
      adminToggleBtn.innerHTML = '🔒 Parent Sign In';
    }
  }
}

// Render Category Filter Pills
function renderCategories() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  const categories = ['all', ...new Set(state.items.map(i => i.category || 'General'))];

  container.innerHTML = categories.map(cat => {
    const isSelected = state.selectedCategory === cat;
    const label = cat === 'all' ? '🌟 All Gifts' : `${getCategoryIcon(cat)} ${cat}`;
    return `
      <button class="filter-btn ${isSelected ? 'active' : ''}" onclick="selectCategory('${escapeHtml(cat)}')">
        ${label}
      </button>
    `;
  }).join('');
}

window.selectCategory = function(cat) {
  state.selectedCategory = cat;
  renderCategories();
  renderGiftCards();
};

window.setStatusFilter = function(filter) {
  state.statusFilter = filter;
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderGiftCards();
};

// Render Gift Cards
function renderGiftCards() {
  const grid = document.getElementById('gifts-grid');
  if (!grid) return;

  const myTokens = getMyBuyerTokens();

  // Filter items
  let filtered = state.items.filter(item => {
    // Category match
    if (state.selectedCategory !== 'all' && item.category !== state.selectedCategory) {
      return false;
    }
    // Status match
    if (state.statusFilter === 'available' && item.is_claimed) {
      return false;
    }
    if (state.statusFilter === 'claimed' && !item.is_claimed) {
      return false;
    }
    // Search match
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchCat = (item.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎁</div>
        <h3>No gift ideas found</h3>
        <p>Try clearing filters or search terms.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isClaimed = Boolean(item.is_claimed);
    const isMine = item.is_mine || Boolean(myTokens[item.id]);

    // Priority badge
    let priorityBadge = '';
    if (item.priority === 'Most Wanted') {
      priorityBadge = `<span class="badge badge-priority-wanted">⭐ Most Wanted</span>`;
    } else if (item.priority === 'High') {
      priorityBadge = `<span class="badge badge-priority-high">🌟 High Priority</span>`;
    }

    // Category badge
    const catBadge = `<span class="badge badge-category">${getCategoryIcon(item.category)} ${escapeHtml(item.category || 'Gift')}</span>`;

    // Image section
    const imageHtml = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" class="card-img" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'placeholder-img\\'>${getCategoryIcon(item.category)}</div>';">`
      : `<div class="placeholder-img">${getCategoryIcon(item.category)}</div>`;

    // Store link button
    const storeLinkHtml = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="card-store-link">
           <span>Visit Store</span> ↗
         </a>`
      : '';

    // Action button logic
    let actionBtnHtml = '';
    if (!isClaimed) {
      actionBtnHtml = `
        <button class="btn-claim" onclick="openClaimModal(${item.id})">
          <span>🎁</span> I'll Buy This!
        </button>
      `;
    } else if (isMine) {
      actionBtnHtml = `
        <div class="btn-my-claim" onclick="handleUnclaimOwn(${item.id})">
          <span>✅ You have reserved this gift</span>
          <span class="undo">Changed your mind? Click to release</span>
        </div>
      `;
    } else {
      actionBtnHtml = `
        <div class="btn-claimed-state">
          <span>✅ Claimed / Purchased</span>
        </div>
      `;
    }

    // Parent / Admin Info Box
    let adminInfoHtml = '';
    if (state.isAdmin) {
      if (isClaimed) {
        adminInfoHtml = `
          <div class="admin-card-info">
            <div class="admin-buyer-name">
              <span>👤 Purchased by:</span> <strong>${escapeHtml(item.buyer_name || 'Anonymous')}</strong>
            </div>
            ${item.buyer_note ? `<div class="admin-buyer-note">"${escapeHtml(item.buyer_note)}"</div>` : ''}
            ${item.claimed_at ? `<div class="admin-claimed-date">Claimed on: ${escapeHtml(item.claimed_at)}</div>` : ''}
            <div class="admin-card-actions">
              <button class="btn-card-admin" onclick="openEditItemModal(${item.id})">✏️ Edit</button>
              <button class="btn-card-admin" onclick="handleAdminUnclaim(${item.id})">↩️ Mark Available</button>
              <button class="btn-card-admin danger" onclick="handleDeleteItem(${item.id})">🗑️ Delete</button>
            </div>
          </div>
        `;
      } else {
        adminInfoHtml = `
          <div class="admin-card-info" style="background: #f8fafc; border-color: #e2e8f0;">
            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 6px;">Status: Available (Not purchased yet)</div>
            <div class="admin-card-actions">
              <button class="btn-card-admin" onclick="openEditItemModal(${item.id})">✏️ Edit</button>
              <button class="btn-card-admin danger" onclick="handleDeleteItem(${item.id})">🗑️ Delete</button>
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="gift-card ${isClaimed ? 'claimed-card' : ''}" id="gift-card-${item.id}">
        <div class="card-img-wrapper">
          ${imageHtml}
          <div class="card-badges">
            ${catBadge}
            ${priorityBadge}
          </div>
          ${isClaimed && !state.isAdmin ? `<div class="badge-claimed-overlay"><span>✅ Claimed</span></div>` : ''}
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${item.price ? `<span class="card-price">${escapeHtml(item.price)}</span>` : ''}
          </div>
          <p class="card-desc">${escapeHtml(item.description || '')}</p>
          ${storeLinkHtml}
          ${adminInfoHtml}
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Modal Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

window.closeModal = closeModal;

// Claim Modal
window.openClaimModal = function(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  state.activeClaimItemId = itemId;
  document.getElementById('claim-item-title').textContent = item.title;
  document.getElementById('claim-item-price').textContent = item.price ? `(${item.price})` : '';
  document.getElementById('claim-daughter-name').textContent = state.settings.daughter_name || 'her';
  document.getElementById('claim-parent-notice-name').textContent = state.settings.daughter_name || 'her';
  document.getElementById('buyer-name-input').value = '';
  document.getElementById('buyer-note-input').value = '';

  openModal('claim-modal');
  setTimeout(() => document.getElementById('buyer-name-input').focus(), 150);
};

window.submitClaim = async function(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('buyer-name-input');
  const noteInput = document.getElementById('buyer-note-input');
  const buyerName = nameInput.value.trim();
  const buyerNote = noteInput.value.trim();

  if (!buyerName) {
    alert('Please enter your name so the parent knows who to thank!');
    nameInput.focus();
    return;
  }

  const itemId = state.activeClaimItemId;
  try {
    const res = await apiRequest('/api/claim', {
      method: 'POST',
      body: JSON.stringify({ itemId, buyerName, buyerNote })
    });

    if (res.success && res.buyerToken) {
      saveMyBuyerToken(itemId, res.buyerToken);
      closeModal('claim-modal');
      showToast(`🎉 Thank you, ${buyerName}! You reserved this gift!`, 'success');
      await loadWishlist(true);
    }
  } catch (err) {
    alert(err.message);
  }
};

// Undo own claim
window.handleUnclaimOwn = async function(itemId) {
  const tokens = getMyBuyerTokens();
  const buyerToken = tokens[itemId];
  if (!buyerToken) return;

  if (!confirm('Are you sure you want to release this gift reservation so someone else can buy it?')) {
    return;
  }

  try {
    await apiRequest('/api/unclaim', {
      method: 'POST',
      body: JSON.stringify({ itemId, buyerToken })
    });
    removeMyBuyerToken(itemId);
    showToast('Gift reservation cancelled. It is now marked available again.', 'info');
    await loadWishlist(true);
  } catch (err) {
    alert(err.message);
  }
};

// Parent Admin Unclaim
window.handleAdminUnclaim = async function(itemId) {
  if (!confirm('Mark this gift as available again?')) return;
  try {
    await apiRequest('/api/unclaim', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
    showToast('Item marked as available', 'success');
    await loadWishlist(true);
  } catch (err) {
    alert(err.message);
  }
};

// Admin Delete Item
window.handleDeleteItem = async function(itemId) {
  if (!confirm('Are you sure you want to permanently delete this gift idea?')) return;
  try {
    await apiRequest(`/api/admin/item/${itemId}`, { method: 'DELETE' });
    showToast('Gift idea deleted', 'info');
    await loadWishlist(true);
  } catch (err) {
    alert(err.message);
  }
};

// Admin Login / Toggle
window.handleAdminToggle = function() {
  if (state.isAdmin) {
    openModal('admin-settings-modal');
  } else {
    document.getElementById('admin-pin-input').value = '';
    openModal('admin-login-modal');
    setTimeout(() => document.getElementById('admin-pin-input').focus(), 150);
  }
};

window.submitAdminLogin = async function(e) {
  if (e) e.preventDefault();
  const pin = document.getElementById('admin-pin-input').value.trim();
  if (!pin) return;

  try {
    const res = await apiRequest('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });

    if (res.token) {
      state.adminToken = res.token;
      localStorage.setItem('wishlist_admin_token', res.token);
      closeModal('admin-login-modal');
      showToast('🌟 Welcome to Parent Mode! You can now see who bought what.', 'success');
      await loadWishlist();
    }
  } catch (err) {
    alert('Incorrect PIN. Please try again.');
  }
};

window.handleAdminLogout = async function() {
  try {
    await apiRequest('/api/admin/logout', { method: 'POST' });
  } catch {}
  state.adminToken = null;
  state.isAdmin = false;
  localStorage.removeItem('wishlist_admin_token');
  closeModal('admin-settings-modal');
  showToast('Logged out of Parent Mode', 'info');
  await loadWishlist();
};

// Add / Edit Item
window.openAddItemModal = function() {
  state.activeEditItemId = null;
  document.getElementById('item-modal-title').textContent = '➕ Add New Gift Idea';
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-category').value = 'Toys & Games';
  document.getElementById('edit-price').value = '';
  document.getElementById('edit-url').value = '';
  document.getElementById('edit-image').value = '';
  document.getElementById('edit-priority').value = 'Normal';
  document.getElementById('edit-description').value = '';

  openModal('item-edit-modal');
};

window.openEditItemModal = function(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  state.activeEditItemId = id;
  document.getElementById('item-modal-title').textContent = '✏️ Edit Gift Idea';
  document.getElementById('edit-title').value = item.title || '';
  document.getElementById('edit-category').value = item.category || 'Toys & Games';
  document.getElementById('edit-price').value = item.price || '';
  document.getElementById('edit-url').value = item.url || '';
  document.getElementById('edit-image').value = item.image_url || '';
  document.getElementById('edit-priority').value = item.priority || 'Normal';
  document.getElementById('edit-description').value = item.description || '';

  openModal('item-edit-modal');
};

window.saveItem = async function(e) {
  if (e) e.preventDefault();

  const title = document.getElementById('edit-title').value.trim();
  if (!title) {
    alert('Please enter a gift title');
    return;
  }

  const payload = {
    title,
    category: document.getElementById('edit-category').value,
    price: document.getElementById('edit-price').value.trim(),
    url: document.getElementById('edit-url').value.trim(),
    image_url: document.getElementById('edit-image').value.trim(),
    priority: document.getElementById('edit-priority').value,
    description: document.getElementById('edit-description').value.trim(),
  };

  try {
    if (state.activeEditItemId) {
      await apiRequest(`/api/admin/item/${state.activeEditItemId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Gift updated successfully!', 'success');
    } else {
      await apiRequest('/api/admin/item', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('New gift added!', 'success');
    }
    closeModal('item-edit-modal');
    await loadWishlist(true);
  } catch (err) {
    alert(err.message);
  }
};

// Wishlist Settings & Checklist Modal
window.openSettingsModal = function() {
  document.getElementById('setting-daughter-name').value = state.settings.daughter_name || '';
  document.getElementById('setting-wishlist-title').value = state.settings.wishlist_title || '';
  document.getElementById('setting-intro-message').value = state.settings.intro_message || '';
  document.getElementById('setting-current-pin').value = '';
  document.getElementById('setting-new-pin').value = '';

  renderChecklistTable();
  openModal('admin-settings-modal');
};

function renderChecklistTable() {
  const container = document.getElementById('checklist-table-container');
  if (!container) return;

  const claimedItems = state.items.filter(i => i.is_claimed);

  if (claimedItems.length === 0) {
    container.innerHTML = '<p style="color: #64748b; padding: 12px 0;">No gifts claimed yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="checklist-table">
      <thead>
        <tr>
          <th>Gift Item</th>
          <th>Price</th>
          <th>Purchased By</th>
          <th>Note / Store</th>
        </tr>
      </thead>
      <tbody>
        ${claimedItems.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.title)}</strong></td>
            <td>${escapeHtml(item.price || '-')}</td>
            <td style="color: #854d0e; font-weight: 700;">${escapeHtml(item.buyer_name || 'Anonymous')}</td>
            <td>${escapeHtml(item.buyer_note || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.saveSettings = async function(e) {
  if (e) e.preventDefault();

  const daughter_name = document.getElementById('setting-daughter-name').value.trim();
  const wishlist_title = document.getElementById('setting-wishlist-title').value.trim();
  const intro_message = document.getElementById('setting-intro-message').value.trim();

  try {
    await apiRequest('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ daughter_name, wishlist_title, intro_message })
    });

    const currentPin = document.getElementById('setting-current-pin').value.trim();
    const newPin = document.getElementById('setting-new-pin').value.trim();
    if (newPin) {
      if (!currentPin) {
        alert('Please enter your current PIN to set a new PIN.');
        return;
      }
      await apiRequest('/api/admin/change-pin', {
        method: 'POST',
        body: JSON.stringify({ currentPin, newPin })
      });
      showToast('Admin PIN updated!', 'success');
    }

    showToast('Wishlist settings saved!', 'success');
    closeModal('admin-settings-modal');
    await loadWishlist();
  } catch (err) {
    alert(err.message);
  }
};

window.printChecklist = function() {
  window.print();
};

window.downloadCsv = function() {
  window.location.href = `/api/admin/export?t=${Date.now()}`;
};

// Share Link Helper
window.copyShareLink = function() {
  const url = window.location.origin + window.location.pathname;
  navigator.clipboard.writeText(url).then(() => {
    showToast('📋 Wishlist link copied to clipboard! Share it with family and friends.', 'success');
  }).catch(() => {
    prompt('Copy this wishlist link to share:', url);
  });
};

// Real-Time Server-Sent Events (SSE)
function setupLiveEvents() {
  let evtSource;
  try {
    evtSource = new EventSource('/api/events');

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'claim') {
          showToast('🔔 Someone just claimed a gift idea!', 'info');
          loadWishlist(true);
        } else if (data.type === 'unclaim') {
          showToast('🔔 A gift was released and is now available!', 'info');
          loadWishlist(true);
        } else if (['new_item', 'update_item', 'delete_item', 'settings_updated'].includes(data.type)) {
          loadWishlist(true);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    evtSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  } catch (err) {
    console.error('SSE not supported:', err);
  }
}

// Falling Snow Animation
function initSnowCanvas() {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const flakeCount = Math.min(65, Math.floor(window.innerWidth / 18));
  const flakes = [];

  for (let i = 0; i < flakeCount; i++) {
    flakes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 3 + 1,
      d: Math.random() * flakeCount,
      speed: Math.random() * 0.8 + 0.4,
      drift: Math.random() * 0.5 - 0.25,
      opacity: Math.random() * 0.5 + 0.2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    if (state.snowEnabled) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      for (let i = 0; i < flakeCount; i++) {
        const f = flakes[i];
        ctx.moveTo(f.x, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);

        f.y += f.speed;
        f.x += f.drift;

        if (f.y > height) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        if (f.x > width) f.x = 0;
        if (f.x < 0) f.x = width;
      }
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
}

window.toggleSnow = function() {
  state.snowEnabled = !state.snowEnabled;
  const btn = document.getElementById('snow-toggle-btn');
  if (btn) {
    btn.innerHTML = state.snowEnabled ? '❄️ Snow: On' : '❄️ Snow: Off';
  }
};

// Search Listener
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderGiftCards();
    });
  }

  initSnowCanvas();
  loadWishlist();
  setupLiveEvents();
});
