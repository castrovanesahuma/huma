// ══════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ══════════════════════════════════════════════════════
const SHEET_CSV_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT26n3U0sniaztj-nS4Qm8iro_fAvED2sQ5BLB7jlVE-NY0byZNmCJfBaiOQEm7qIFKxTkBNeohLwGI/pub?output=csv";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxccGfv-jhftv2il90Uisbe_idJTZy-AOvBIwha45YYsbRl_5GcNOMD6UwUAQChOVfzfw/exec"; 
const WHATSAPP_NUMBER   = "5491123456789"; // Reemplazar con el número real
// ══════════════════════════════════════════════════════

const CART_KEY = 'huma_cart';
const IS_ADMIN = typeof window !== 'undefined' && window.location.pathname.includes('admin');

// ─── CSV Parser ───────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    if (!vals.length || vals.every(v => !v.trim())) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (vals[idx] ?? '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ─── Imágenes ─────────────────────────────────────────

function parseImages(raw) {
  if (!raw) return [];
  return raw
    .split('|')
    .map(s => s.trim().replace(/\\/g, '/'))
    .filter(Boolean)
    .map(f => f.startsWith('img/') ? f : 'img/' + f);
}

// ─── Estado de cards ──────────────────────────────────
const cardState = {}; 

// ─── Render catálogo ──────────────────────────────────

function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const countEl = document.getElementById('productCount');
  if (countEl) countEl.textContent = `${products.length} prendas`;

  if (!products.length) {
    grid.innerHTML = '<p class="col-span-2 md:col-span-3 text-center font-body text-sm text-charcoal/40 py-12">Sin productos disponibles.</p>';
    return;
  }

  products.forEach(p => {
    const images  = parseImages(p.imagenes);
    const hasMany = images.length > 1;
    cardState[p.id] = { idx: 0 };

    const precio = parseFloat(p.precio) || 0;

    const thumbsHTML = hasMany
      ? `<div class="thumb-strip">
          ${images.map((src, i) => `
            <img src="${src}" alt="foto ${i + 1}"
              class="${i === 0 ? 'active' : ''}"
              data-product-id="${p.id}"
              data-action="thumb"
              data-index="${i}" />`).join('')}
        </div>`
      : '';

    const card = document.createElement('div');
    card.className = 'product-card bg-white rounded-sm overflow-hidden flex flex-col';
    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          src="${images[0] || ''}"
          alt="${p.nombre}"
          data-product-id="${p.id}"
          data-role="main-image"
          data-action="zoom"
          data-images='${JSON.stringify(images).replace(/'/g, "&#39;")}'
        />
        ${hasMany ? `
          <button class="card-arrow left"  data-product-id="${p.id}" data-action="prev" aria-label="Anterior">&#8249;</button>
          <button class="card-arrow right" data-product-id="${p.id}" data-action="next" aria-label="Siguiente">&#8250;</button>
          <span class="card-counter" data-product-id="${p.id}" data-role="counter">1/${images.length}</span>
        ` : ''}
      </div>
      <div class="flex flex-col flex-1 p-3 gap-2">
        ${thumbsHTML}
        <div class="flex-1 mt-1">
          <h3 class="font-display text-base font-light leading-tight">${p.nombre}</h3>
          ${p.descripcion ? `<p class="font-body text-xs text-charcoal/50 mt-0.5 leading-relaxed">${p.descripcion}</p>` : ''}
        </div>
        <div class="flex items-center justify-between mt-2">
          <span class="font-display text-xl font-light">$${precio.toLocaleString('es-AR')}</span>
          <button
            class="bg-charcoal text-cream font-body text-[11px] tracking-widest uppercase px-3 py-2 hover:bg-bark transition-colors"
            data-product-id="${p.id}"
            data-action="add"
            aria-label="Agregar al carrito">
            + Agregar
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Delegación de eventos en el grid ─────────────────

function initProductGridEvents(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const pid    = target.dataset.productId;
    const p      = products.find(x => String(x.id) === String(pid));

    if (action === 'prev' || action === 'next') {
      const images = parseImages(p.imagenes);
      const total  = images.length;
      let idx = cardState[pid].idx;
      idx = action === 'next' ? (idx + 1) % total : (idx - 1 + total) % total;
      setCardImage(pid, images, idx);
    }

    if (action === 'thumb') {
      const images = parseImages(p.imagenes);
      const idx    = parseInt(target.dataset.index, 10);
      setCardImage(pid, images, idx);
    }

    if (action === 'zoom') {
      let images = [];
      try { images = JSON.parse(target.dataset.images); } catch { images = [target.src]; }
      openImageModal(images, cardState[pid]?.idx || 0);
    }

    if (action === 'add') {
      addToCart(pid, p.nombre, parseFloat(p.precio) || 0);
      openCart();
    }
  });
}

// ─── Actualizar imagen de card ────────────────────────

function setCardImage(pid, images, idx) {
  cardState[pid].idx = idx;
  const grid    = document.getElementById('productGrid');
  const mainImg = grid.querySelector(`img[data-product-id="${pid}"][data-role="main-image"]`);
  const counter = grid.querySelector(`[data-product-id="${pid}"][data-role="counter"]`);
  const thumbs  = grid.querySelectorAll(`img[data-product-id="${pid}"][data-action="thumb"]`);

  if (mainImg) mainImg.src = images[idx];
  if (counter) counter.textContent = `${idx + 1}/${images.length}`;
  thumbs.forEach((t, i) => t.classList.toggle('active', i === idx));
}

// ─── Modal ────────────────────────────────────────────

let _modalImages = [];
let _modalIdx    = 0;

function openImageModal(images, startIdx = 0) {
  _modalImages = images;
  _modalIdx    = startIdx;

  const hasMany = images.length > 1;
  const prev    = document.getElementById('modalPrev');
  const next    = document.getElementById('modalNext');
  const counter = document.getElementById('modalCounter');

  if (prev)    prev.style.display    = hasMany ? 'flex' : 'none';
  if (next)    next.style.display    = hasMany ? 'flex' : 'none';
  if (counter) counter.style.display = hasMany ? 'block' : 'none';

  updateModalImage();
  document.getElementById('imageModal')?.classList.add('open');
  document.addEventListener('keydown', handleModalKeydown);
}

function closeImageModal() {
  document.getElementById('imageModal')?.classList.remove('open');
  document.removeEventListener('keydown', handleModalKeydown);
}

function modalNav(dir) {
  const total = _modalImages.length;
  _modalIdx = dir === 'next'
    ? (_modalIdx + 1) % total
    : (_modalIdx - 1 + total) % total;
  updateModalImage();
}

function updateModalImage() {
  const img     = document.getElementById('modalImg');
  const counter = document.getElementById('modalCounter');
  if (img)     img.src = _modalImages[_modalIdx];
  if (counter) counter.textContent = `${_modalIdx + 1} / ${_modalImages.length}`;
}

function handleModalKeydown(e) {
  if (e.key === 'ArrowLeft')  modalNav('prev');
  if (e.key === 'ArrowRight') modalNav('next');
  if (e.key === 'Escape')     closeImageModal();
}

function initModalEvents() {
  document.getElementById('modalClose')    ?.addEventListener('click', closeImageModal);
  document.getElementById('modalBackdrop') ?.addEventListener('click', closeImageModal);
  document.getElementById('modalPrev')     ?.addEventListener('click', () => modalNav('prev'));
  document.getElementById('modalNext')     ?.addEventListener('click', () => modalNav('next'));
}

// ─── Carrito ──────────────────────────────────────────

function getCart()        { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
function saveCart(cart)   { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function addToCart(id, nombre, precio) {
  const cart = getCart();
  const item = cart.find(x => x.id === id);
  if (item) item.qty++;
  else cart.push({ id, nombre, precio, qty: 1 });
  saveCart(cart);
  updateCartUI();
}

// Se expone globalmente para los botones inline
window.removeFromCart = function(id) {
  saveCart(getCart().filter(x => x.id !== id));
  updateCartUI();
}

window.changeQty = function(id, delta) {
  const cart = getCart();
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(cart);
  updateCartUI();
}

function getCartCount()       { return getCart().reduce((s, i) => s + i.qty, 0); }
function getCartTotalAmount() { return getCart().reduce((s, i) => s + i.precio * i.qty, 0); }

function renderCart() {
  const cart    = getCart();
  const items   = document.getElementById('cartItems');
  const footer  = document.getElementById('cartFooter');
  const empty   = document.getElementById('cartEmpty');
  const totalEl = document.getElementById('cartTotal');

  if (!cart.length) {
    if (items)  items.innerHTML = '';
    footer?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }

  empty?.classList.add('hidden');
  footer?.classList.remove('hidden');

  if (items) {
    items.innerHTML = cart.map(item => `
      <div class="flex gap-3 items-start py-3 border-b border-mist last:border-0">
        <div class="flex-1 min-w-0">
          <p class="font-body text-sm font-medium truncate">${item.nombre}</p>
          <p class="font-display text-base font-light mt-0.5">$${(item.precio * item.qty).toLocaleString('es-AR')}</p>
        </div>
        <div class="flex items-center gap-2 mt-0.5 shrink-0">
          <button onclick="changeQty('${item.id}', -1)"
            class="w-6 h-6 flex items-center justify-center border border-mist hover:border-charcoal transition-colors text-lg leading-none">−</button>
          <span class="font-body text-sm w-4 text-center">${item.qty}</span>
          <button onclick="changeQty('${item.id}', 1)"
            class="w-6 h-6 flex items-center justify-center border border-mist hover:border-charcoal transition-colors text-lg leading-none">+</button>
          <button onclick="removeFromCart('${item.id}')"
            class="ml-1 text-charcoal/30 hover:text-charcoal transition-colors text-base leading-none">✕</button>
        </div>
      </div>
    `).join('');
  }

  if (totalEl) totalEl.textContent = '$' + getCartTotalAmount().toLocaleString('es-AR');
}

function updateCartUI() {
  const count = getCartCount();
  ['navCartCount', 'floatingCartCount'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  });
  renderCart();
}

function openCart() {
  const overlay = document.getElementById('cartOverlay');
  document.getElementById('cartDrawer')?.classList.add('open');
  if (overlay) {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
  }
}

function closeCart() {
  const overlay = document.getElementById('cartOverlay');
  document.getElementById('cartDrawer')?.classList.remove('open');
  if (overlay) {
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }
}

function initCartEvents() {
  document.getElementById('navCartBtn')   ?.addEventListener('click', openCart);
  document.getElementById('floatingCart') ?.addEventListener('click', openCart);
  document.getElementById('closeCartBtn') ?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')  ?.addEventListener('click', closeCart);
  document.getElementById('whatsappBtn')  ?.addEventListener('click', sendWhatsAppOrder);
}

// ─── WhatsApp ─────────────────────────────────────────

function sendWhatsAppOrder() {
  const cart = getCart();
  if (!cart.length) return;
  const lines = cart.map(i => `- ${i.qty}x ${i.nombre} ($${(i.precio * i.qty).toLocaleString('es-AR')})`);
  const msg   = ['Hola, quiero hacer un pedido:', ...lines, '', `Total: $${getCartTotalAmount().toLocaleString('es-AR')}`].join('\n');
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ─── Admin ABM ────────────────────────────────────────

async function loadAdminProducts() {
  const tbody = document.getElementById('adminTableBody');
  const msg   = document.getElementById('adminMsg');
  if (!tbody) return;

  try {
    const res  = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());

    tbody.innerHTML = rows.map(p => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="px-3 py-2 text-sm">${p.id}</td>
        <td class="px-3 py-2 text-sm font-medium">${p.nombre}</td>
        <td class="px-3 py-2 text-sm">$${parseFloat(p.precio || 0).toLocaleString('es-AR')}</td>
        <td class="px-3 py-2 text-sm text-gray-400 max-w-xs truncate">${p.descripcion || ''}</td>
        <td class="px-3 py-2 text-sm text-gray-400 max-w-xs truncate">${p.imagenes || ''}</td>
        <td class="px-3 py-2 flex gap-2">
          <button onclick="fillAdminForm(${JSON.stringify(p).replace(/"/g, '&quot;')})"
            class="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">Editar</button>
          <button onclick="deleteProduct('${p.id}')"
            class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (msg) { msg.textContent = 'Error cargando productos: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  }
}

window.fillAdminForm = function(p) {
  ['id', 'nombre', 'precio', 'descripcion', 'imagenes'].forEach(field => {
    const el = document.getElementById('field_' + field);
    if (el) el.value = p[field] || '';
  });
  const title = document.getElementById('formTitle');
  if (title) title.textContent = 'Modificar producto';
  document.getElementById('adminForm')?.scrollIntoView({ behavior: 'smooth' });
}

window.clearAdminForm = function() {
  ['id', 'nombre', 'precio', 'descripcion', 'imagenes'].forEach(field => {
    const el = document.getElementById('field_' + field);
    if (el) el.value = '';
  });
  const title = document.getElementById('formTitle');
  if (title) title.textContent = 'Nuevo producto';
}

window.deleteProduct = async function(id) {
  if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
  const msg = document.getElementById('adminMsg');
  if (msg) msg.textContent = 'Eliminando…';

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: id }),
    });
    
    if (msg) { msg.textContent = '✓ Comando de eliminación enviado. Actualiza en unos segundos.'; msg.className = 'text-green-600 text-sm'; }
    setTimeout(loadAdminProducts, 2000);
  } catch (err) {
    if (msg) { msg.textContent = 'Error al eliminar: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  }
}

async function submitAdminForm(e) {
  e.preventDefault();
  const msg     = document.getElementById('adminMsg');
  const btn     = document.getElementById('submitBtn');
  const payload = { action: 'save' };

  ['id', 'nombre', 'precio', 'descripcion', 'imagenes'].forEach(field => {
    payload[field] = (document.getElementById('field_' + field)?.value || '').trim();
  });

  if (!payload.id || !payload.nombre || !payload.precio) {
    if (msg) { msg.textContent = 'ID, nombre y precio son obligatorios.'; msg.className = 'text-red-600 text-sm'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  if (msg) msg.textContent = '';

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (msg) { msg.textContent = '✓ Datos enviados correctamente. Revisa tu Google Sheets.'; msg.className = 'text-green-600 text-sm'; }
    clearAdminForm();
    setTimeout(loadAdminProducts, 2000);
  } catch (err) {
    if (msg) { msg.textContent = 'Error al guardar: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar producto'; }
  }
}

function initAdminEvents() {
  document.getElementById('adminForm')    ?.addEventListener('submit', submitAdminForm);
  document.getElementById('clearFormBtn') ?.addEventListener('click', clearAdminForm);
  document.getElementById('refreshBtn')   ?.addEventListener('click', loadAdminProducts);
}

// ─── Bootstrap ───────────────────────────────────────

async function initCatalog() {
  const loader = document.getElementById('loader');
  const errEl  = document.getElementById('catalogError');

  initCartEvents();
  initModalEvents();
  updateCartUI();

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());
    loader?.classList.add('hidden');
    initProductGridEvents(rows);
    renderProducts(rows);
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    loader?.classList.add('hidden');
    errEl?.classList.remove('hidden');
  }
}

async function initAdmin() {
  initAdminEvents();
  await loadAdminProducts();
}

document.addEventListener('DOMContentLoaded', () => {
  if (IS_ADMIN) initAdmin();
  else          initCatalog();
});
