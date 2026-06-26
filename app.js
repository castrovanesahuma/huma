// ══════════════════════════════════════════════════════
//  CONFIGURACIÓN — editá solo estos valores
// ══════════════════════════════════════════════════════
const SUPABASE_URL    = 'https://hjuswmrqjdvmgmqbxipk.supabase.co';
const SUPABASE_KEY    = 'sb_publishable_JODxvBscCTZPrnDJSPVPkA_mB9DG0aQ';
const WHATSAPP_NUMBER = '5491123456789'; // Reemplazá con el número real
// ══════════════════════════════════════════════════════

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CART_KEY = 'huma_cart';
const IS_ADMIN = window.location.pathname.includes('admin');

/* ─────────────────────────────────────────────────────
   IMÁGENES
───────────────────────────────────────────────────── */

function parseImages(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim().replace(/\\/g, '/'))
    .filter(Boolean)
    .map(f => f.startsWith('http') ? f : 'img/' + f);
}

/* ─────────────────────────────────────────────────────
   CATÁLOGO — render de cards
───────────────────────────────────────────────────── */

const cardState = {};

function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const countEl = document.getElementById('productCount');
  if (countEl) countEl.textContent = `${products.length} productos`;

  if (!products.length) {
    grid.innerHTML = '<p class="col-span-full text-center font-body text-sm text-charcoal/40 py-12">No hay productos disponibles.</p>';
    return;
  }

  products.forEach(p => {
    const images  = parseImages(p.imagenes);
    const hasMany = images.length > 1;
    cardState[p.id] = { idx: 0 };

    const precio     = parseFloat(p.precio) || 0;
    const imagesAttr = JSON.stringify(images).replace(/'/g, '&#39;');

    const thumbsHTML = hasMany
      ? `<div class="thumb-strip">
          ${images.map((src, i) => `<img
            src="${src}" alt="foto ${i + 1}"
            class="${i === 0 ? 'active' : ''}"
            data-product-id="${p.id}"
            data-action="thumb"
            data-index="${i}"
          />`).join('')}
        </div>`
      : '';

    const arrowsHTML = hasMany
      ? `<button class="card-arrow left"  data-product-id="${p.id}" data-action="prev" aria-label="Anterior">&#8249;</button>
         <button class="card-arrow right" data-product-id="${p.id}" data-action="next" aria-label="Siguiente">&#8250;</button>
         <span class="card-counter" data-product-id="${p.id}" data-role="counter">1/${images.length}</span>`
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
          data-images='${imagesAttr}'
        />
        ${arrowsHTML}
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

/* ─────────────────────────────────────────────────────
   EVENTOS DEL GRID
───────────────────────────────────────────────────── */

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
      if (!p) return;
      const images = parseImages(p.imagenes);
      const total  = images.length;
      let idx = cardState[pid].idx;
      idx = action === 'next' ? (idx + 1) % total : (idx - 1 + total) % total;
      setCardImage(pid, images, idx);
    }

    if (action === 'thumb') {
      if (!p) return;
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
      if (!p) return;
      addToCart(pid, p.nombre, parseFloat(p.precio) || 0);
      openCart();
    }
  });
}

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

/* ─────────────────────────────────────────────────────
   MODAL DE ZOOM
───────────────────────────────────────────────────── */

let _modalImages = [];
let _modalIdx    = 0;

function openImageModal(images, startIdx = 0) {
  _modalImages = images;
  _modalIdx    = startIdx;

  const hasMany = images.length > 1;
  const prev    = document.getElementById('modalPrev');
  const next    = document.getElementById('modalNext');
  const counter = document.getElementById('modalCounter');

  if (prev)    prev.style.display    = hasMany ? 'flex'  : 'none';
  if (next)    next.style.display    = hasMany ? 'flex'  : 'none';
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
  _modalIdx   = dir === 'next'
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

/* ─────────────────────────────────────────────────────
   CARRITO (LocalStorage)
───────────────────────────────────────────────────── */

function getCart()   { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); }

function addToCart(id, nombre, precio) {
  const cart = getCart();
  const item = cart.find(x => x.id === id);
  if (item) item.qty++;
  else cart.push({ id, nombre, precio, qty: 1 });
  saveCart(cart);
  updateCartUI();
}

function removeFromCart(id) {
  saveCart(getCart().filter(x => x.id !== id));
  updateCartUI();
}

function changeQty(id, delta) {
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
    if (items) items.innerHTML = '';
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

/* ─────────────────────────────────────────────────────
   WHATSAPP
───────────────────────────────────────────────────── */

function sendWhatsAppOrder() {
  const cart = getCart();
  if (!cart.length) return;
  const lines = cart.map(i => `- ${i.qty}x ${i.nombre} ($${(i.precio * i.qty).toLocaleString('es-AR')})`);
  const msg   = [
    'Hola, quiero hacer un pedido:',
    ...lines,
    '',
    `Total: $${getCartTotalAmount().toLocaleString('es-AR')}`
  ].join('\n');
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ─────────────────────────────────────────────────────
   ADMIN — tabla de productos
───────────────────────────────────────────────────── */

window.loadAdminProducts = async function () {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center">
    <div class="flex items-center justify-center gap-2 text-charcoal/30">
      <div class="w-4 h-4 border-2 border-bark/30 border-t-bark rounded-full animate-spin"></div>
      <span class="font-body text-sm">Cargando…</span>
    </div></td></tr>`;

  try {
    const { data: rows, error } = await _sb
      .from('productos')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center font-body text-sm text-charcoal/30">No hay productos.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(p => {
      const isOculto = p.estado?.toLowerCase().trim() === 'oculto';
      const badge    = isOculto
        ? `<span class="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Oculto</span>`
        : `<span class="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200/50">Visible</span>`;

      const pJson = JSON.stringify(p).replace(/"/g, '&quot;');

      const toggleBtn = isOculto
        ? `<button onclick="window.toggleVisibility(${pJson}, 'mostrar')"
             class="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors">
             👁️ Mostrar</button>`
        : `<button onclick="window.toggleVisibility(${pJson}, 'ocultar')"
             class="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-1 rounded transition-colors">
             🙈 Ocultar</button>`;

      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
          <td class="px-4 py-3 text-sm font-mono text-gray-400">${p.id}</td>
          <td class="px-4 py-3 text-sm font-medium">${p.nombre}</td>
          <td class="px-4 py-3 text-sm">$${parseFloat(p.precio || 0).toLocaleString('es-AR')}</td>
          <td class="px-4 py-3 text-sm">${badge}</td>
          <td class="px-4 py-3 text-sm text-gray-400 max-w-[160px] truncate">${p.descripcion || '—'}</td>
          <td class="px-4 py-3 text-sm text-gray-400 max-w-[120px] truncate">${p.imagenes || '—'}</td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${toggleBtn}
              <button onclick="window.fillAdminForm(${pJson})"
                class="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">Editar</button>
              <button onclick="window.deleteProduct(${p.id})"
                class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-red-500 font-body text-sm">Error: ${err.message}</td></tr>`;
  }
};

/* ─────────────────────────────────────────────────────
   ADMIN — toggle visibilidad
───────────────────────────────────────────────────── */

window.toggleVisibility = async function (producto, accion) {
  const msg = document.getElementById('adminMsg');
  if (msg) { msg.textContent = 'Actualizando…'; msg.className = 'text-charcoal/60 text-sm animate-pulse'; }

  const nuevoEstado = accion === 'ocultar' ? 'oculto' : '';

  try {
    const { error } = await _sb
      .from('productos')
      .update({ estado: nuevoEstado })
      .eq('id', producto.id);

    if (error) throw error;
    if (msg) { msg.textContent = '✓ Visibilidad actualizada.'; msg.className = 'text-green-600 text-sm font-medium'; }
    await window.loadAdminProducts();
  } catch (err) {
    if (msg) { msg.textContent = 'Error: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  }
};

/* ─────────────────────────────────────────────────────
   ADMIN — eliminar producto
───────────────────────────────────────────────────── */

window.deleteProduct = async function (id) {
  if (!confirm('¿Eliminar este producto permanentemente?')) return;
  const msg = document.getElementById('adminMsg');
  if (msg) { msg.textContent = 'Eliminando…'; msg.className = 'text-amber-600 text-sm'; }

  try {
    const { error } = await _sb
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    if (msg) { msg.textContent = '✓ Producto eliminado.'; msg.className = 'text-green-600 text-sm font-medium'; }
    await window.loadAdminProducts();
  } catch (err) {
    if (msg) { msg.textContent = 'Error: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  }
};

/* ─────────────────────────────────────────────────────
   ADMIN — formulario: llenar / limpiar / enviar
───────────────────────────────────────────────────── */

window.fillAdminForm = function (p) {
  const fields = ['nombre', 'precio', 'descripcion', 'imagenes', 'estado'];
  fields.forEach(k => {
    const el = document.getElementById('field_' + k);
    if (el) el.value = p[k] || '';
  });

  const hiddenId  = document.getElementById('field_id');
  const visibleId = document.getElementById('field_id_visible');
  if (hiddenId)  hiddenId.value  = p.id;
  if (visibleId) visibleId.value = p.id;

  const title = document.getElementById('formTitle');
  const btn   = document.getElementById('submitBtn');
  if (title) title.textContent = 'Editar producto';
  if (btn)   btn.textContent   = 'Actualizar producto';

  document.getElementById('adminForm')?.scrollIntoView({ behavior: 'smooth' });
};

window.clearAdminForm = function () {
  document.getElementById('adminForm')?.reset();

  const hiddenId  = document.getElementById('field_id');
  const visibleId = document.getElementById('field_id_visible');
  if (hiddenId)  hiddenId.value  = '';
  if (visibleId) visibleId.value = 'Autogenerado';

  const estadoEl = document.getElementById('field_estado');
  if (estadoEl) estadoEl.value = '';

  const title = document.getElementById('formTitle');
  const btn   = document.getElementById('submitBtn');
  const msg   = document.getElementById('adminMsg');
  if (title) title.textContent = 'Nuevo producto';
  if (btn)   { btn.textContent = 'Guardar producto'; btn.disabled = false; }
  if (msg)   msg.textContent   = '';
};

async function submitAdminForm(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('adminMsg');

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  if (msg) { msg.textContent = 'Guardando en Supabase…'; msg.className = 'text-charcoal/60 text-sm animate-pulse'; }

  const hiddenId = document.getElementById('field_id');
  const editId   = hiddenId?.value ? parseInt(hiddenId.value, 10) : null;

  const payload = {};
  ['nombre', 'precio', 'descripcion', 'imagenes', 'estado'].forEach(k => {
    const el  = document.getElementById('field_' + k);
    const val = el ? el.value.trim() : '';
    payload[k] = k === 'imagenes' ? val.replace(/\\/g, '/') : val;
  });
  payload.precio = parseFloat(payload.precio) || 0;

  if (!payload.nombre || !payload.precio) {
    if (msg) { msg.textContent = 'Nombre y precio son obligatorios.'; msg.className = 'text-red-600 text-sm'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar producto'; }
    return;
  }

  try {
    let error;

    if (editId) {
      ({ error } = await _sb.from('productos').update(payload).eq('id', editId));
    } else {
      ({ error } = await _sb.from('productos').insert(payload));
    }

    if (error) throw error;
    if (msg) { msg.textContent = '✓ Guardado correctamente.'; msg.className = 'text-green-600 text-sm font-medium'; }
    window.clearAdminForm();
    await window.loadAdminProducts();
  } catch (err) {
    if (msg) { msg.textContent = 'Error: ' + err.message; msg.className = 'text-red-600 text-sm'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar producto'; }
  }
}

function initAdminEvents() {
  document.getElementById('adminForm')    ?.addEventListener('submit', submitAdminForm);
  document.getElementById('clearFormBtn') ?.addEventListener('click',  window.clearAdminForm);
  document.getElementById('refreshBtn')   ?.addEventListener('click',  window.loadAdminProducts);

  const genBtn = document.getElementById('generateIdBtn');
  if (genBtn) genBtn.style.display = 'none';

  document.getElementById('field_id_visible')?.setAttribute('readonly', true);
}

/* ─────────────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────────────── */

async function initCatalog() {
  initCartEvents();
  initModalEvents();
  updateCartUI();

  const loader = document.getElementById('loader');
  const errEl  = document.getElementById('catalogError');

  try {
    const { data: rows, error } = await _sb
      .from('productos')
      .select('*')
      .neq('estado', 'oculto')
      .order('id', { ascending: true });

    if (error) throw error;

    loader?.classList.add('hidden');
    initProductGridEvents(rows);
    renderProducts(rows);
  } catch (err) {
    console.error('[HUMA] Error cargando catálogo:', err);
    loader?.classList.add('hidden');
    errEl?.classList.remove('hidden');
  }
}

async function initAdmin() {
  initAdminEvents();
  window.clearAdminForm();
  await window.loadAdminProducts();
}

document.addEventListener('DOMContentLoaded', () => {
  IS_ADMIN ? initAdmin() : initCatalog();
});
