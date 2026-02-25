// Catalog Page Logic
const PHONE = window.SITE_SETTINGS ? (window.SITE_SETTINGS.phone || '+380 98 048 84 37') : '+380 98 048 84 37';
const TG_USER = window.SITE_SETTINGS ? (window.SITE_SETTINGS.telegramUser || 'ekvityua') : 'ekvityua';

const DEFAULT_CATEGORIES = [
    { id: 'cat-1', name: 'Букети', order: 0, showOnMain: true },
    { id: 'cat-2', name: 'Квіти поштучно', order: 1, showOnMain: true },
    { id: 'cat-3', name: 'Композиції', order: 2, showOnMain: true }
];

const DEFAULT_PRODUCTS = [
    { id: 'EKV-001', name: 'Velvet Noir', categoryId: 'cat-1', price: 2362, image: 'images/bouquet1.jpg', desc: 'Dark red roses, eucalyptus, mystery.', featured: true },
    { id: 'EKV-002', name: 'Opulence', categoryId: 'cat-1', price: 6760, image: 'images/bouquet3.jpg', desc: 'Premium selection, gold wrapping.', featured: true },
    { id: 'EKV-003', name: 'Ethereal Mist', categoryId: 'cat-1', price: 5800, image: 'images/bouquet1.jpg', desc: 'Rare white blooms, silk ribbon.', featured: false },
    { id: 'EKV-004', name: 'Pastel Dream', categoryId: 'cat-1', price: 3140, image: 'images/bouquet3.jpg', desc: 'Soft pinks, creamy textures.', featured: false },
    { id: 'EKV-005', name: 'Classic Elegance', categoryId: 'cat-1', price: 1990, image: 'images/bouquet1.jpg', desc: 'Timeless red roses.', featured: false },
    { id: 'EKV-006', name: 'Midnight Garden', categoryId: 'cat-1', price: 2200, image: 'images/bouquet3.jpg', desc: 'Deep purples and shadows.', featured: false },
    { id: 'EKV-010', name: 'Athena Royal', categoryId: 'cat-2', price: 100, image: 'images/bouquet2.jpg', desc: 'Single stem, 60cm.', featured: true },
    { id: 'EKV-011', name: 'Genista Gold', categoryId: 'cat-2', price: 40, image: 'images/bouquet2.jpg', desc: 'Bright accent.', featured: false },
    { id: 'EKV-012', name: 'Lilac Essence', categoryId: 'cat-2', price: 290, image: 'images/bouquet2.jpg', desc: 'Fragrant luxury.', featured: false },
    { id: 'EKV-013', name: 'Chamelaucium', categoryId: 'cat-2', price: 80, image: 'images/bouquet2.jpg', desc: 'Delicate wax flower.', featured: false },
    { id: 'EKV-014', name: 'Oxypetalum Blue', categoryId: 'cat-2', price: 160, image: 'images/bouquet2.jpg', desc: 'Rare blue hue.', featured: false },
    { id: 'EKV-020', name: 'Sculptural White', categoryId: 'cat-3', price: 4500, image: 'images/bouquet4.jpg', desc: 'Modern vase arrangement.', featured: true }
];

let categories = [];
let products = [];
let currentCategory = 'all';
let currentPage = 1;
const PAGE_SIZE = 9;

function seedData() {
    if (!localStorage.getItem('ekvity_categories')) {
        localStorage.setItem('ekvity_categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem('ekvity_products')) {
        localStorage.setItem('ekvity_products', JSON.stringify(DEFAULT_PRODUCTS));
    }
}

function loadData() {
    seedData();
    categories = JSON.parse(localStorage.getItem('ekvity_categories')) || [];
    products = JSON.parse(localStorage.getItem('ekvity_products')) || [];
    categories.sort((a, b) => a.order - b.order);
}

function getCategoryName(catId) {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : '';
}

function getProductCount(catId) {
    return products.filter(p => p.categoryId === catId).length;
}

// Sidebar categories
function renderSidebarCategories() {
    const el = document.getElementById('sidebarCategories');
    let html = `<button class="sidebar-cat ${currentCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all')">Всі <span class="cat-count">${products.length}</span></button>`;
    categories.forEach(cat => {
        html += `<button class="sidebar-cat ${currentCategory === cat.id ? 'active' : ''}" onclick="filterCategory('${cat.id}')">${cat.name} <span class="cat-count">${getProductCount(cat.id)}</span></button>`;
    });
    el.innerHTML = html;
}

// Mobile category tags
function renderMobileTags() {
    const el = document.getElementById('mobileCatTags');
    let html = `<span class="cat-tag ${currentCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all')">Всі</span>`;
    categories.forEach(cat => {
        html += `<span class="cat-tag ${currentCategory === cat.id ? 'active' : ''}" onclick="filterCategory('${cat.id}')">${cat.name}</span>`;
    });
    el.innerHTML = html;
}

function getFilteredProducts() {
    let filtered = [...products];

    // Category
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.categoryId === currentCategory);
    }

    // Search
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    if (search) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search) ||
            (p.desc && p.desc.toLowerCase().includes(search))
        );
    }

    // Price
    const isMobile = window.innerWidth <= 768;
    const minEl = isMobile ? document.getElementById('priceMinMobile') : document.getElementById('priceMin');
    const maxEl = isMobile ? document.getElementById('priceMaxMobile') : document.getElementById('priceMax');
    const minVal = minEl ? parseInt(minEl.value) : NaN;
    const maxVal = maxEl ? parseInt(maxEl.value) : NaN;
    if (!isNaN(minVal)) filtered = filtered.filter(p => p.price >= minVal);
    if (!isNaN(maxVal)) filtered = filtered.filter(p => p.price <= maxVal);

    // Sort
    const sortEl = isMobile ? document.getElementById('sortSelectMobile') : document.getElementById('sortSelect');
    const sort = sortEl ? sortEl.value : 'default';
    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    else if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
}

function createProductCard(p, animIndex) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = p.id;
    card.style.transitionDelay = `${animIndex * 0.08}s`;
    const catName = getCategoryName(p.categoryId);
    card.innerHTML = `
        <div class="card-image-wrapper">
            <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy">
            <div class="card-meta-overlay">
                <span class="product-id">${p.id}</span>
            </div>
        </div>
        <div class="card-content">
            <div class="product-category">${catName}</div>
            <h3 class="product-name">${p.name}</h3>
            <p class="product-price">${p.price} <span>UAH</span></p>
            <div class="card-actions">
                <button class="btn-order" onclick="orderProduct('${p.id}','${p.name.replace(/'/g, "\\'")}',${p.price})">Замовити</button>
            </div>
        </div>
    `;
    return card;
}

function renderProducts(appendOnly = false) {
    const grid = document.getElementById('catalogGrid');
    const noResults = document.getElementById('noResults');
    const loadMoreWrap = document.getElementById('loadMoreWrap');
    const resultsInfo = document.getElementById('resultsInfo');

    const filtered = getFilteredProducts();
    const prevCount = appendOnly ? (currentPage - 1) * PAGE_SIZE : 0;
    const toShow = filtered.slice(0, currentPage * PAGE_SIZE);

    if (!appendOnly) grid.innerHTML = '';

    if (filtered.length === 0) {
        noResults.style.display = 'block';
        loadMoreWrap.style.display = 'none';
        resultsInfo.textContent = '';
        return;
    }

    noResults.style.display = 'none';
    resultsInfo.textContent = `Знайдено: ${filtered.length}`;

    // Only render new items when appending
    const itemsToRender = appendOnly ? toShow.slice(prevCount) : toShow;

    itemsToRender.forEach((p, i) => {
        const card = createProductCard(p, i);
        grid.appendChild(card);
        setTimeout(() => card.classList.add('visible'), 50);
    });

    loadMoreWrap.style.display = toShow.length < filtered.length ? 'block' : 'none';
}

// Breadcrumbs
function updateBreadcrumbs() {
    const el = document.getElementById('breadcrumbCurrent');
    if (currentCategory === 'all') {
        el.textContent = 'Каталог';
    } else {
        const catName = getCategoryName(currentCategory);
        el.innerHTML = `<a href="/katalog">Каталог</a> <span>→</span> ${catName}`;
    }
}

window.filterCategory = function (catId) {
    currentCategory = catId;
    currentPage = 1;
    renderSidebarCategories();
    renderMobileTags();
    updateBreadcrumbs();
    renderProducts();
};

window.openFilterPanel = function () {
    document.getElementById('filterPanel').classList.add('open');
    document.getElementById('filterOverlay').classList.add('open');
};

window.closeFilterPanel = function () {
    document.getElementById('filterPanel').classList.remove('open');
    document.getElementById('filterOverlay').classList.remove('open');
};

window.applyMobileFilters = function () {
    closeFilterPanel();
    currentPage = 1;
    renderProducts();
};

// Order modal
window.orderProduct = function (id, name, price) {
    const modal = document.getElementById('orderModal');
    document.getElementById('modalProductDetails').innerHTML = `<h4>${name}</h4><p>ID: ${id} — ${price} грн</p>`;
    const msg = `Вітаю! Хочу замовити:\n${name} (ID: ${id})\nЦіна: ${price} грн`;
    const encoded = encodeURIComponent(msg);
    document.getElementById('btnTelegram').href = `https://t.me/${TG_USER}?text=${encoded}`;
    const phoneClean = PHONE.replace('+', '');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    document.getElementById('btnViber').href = isMobile
        ? `viber://add?number=${phoneClean}`
        : `viber://chat?number=%2B${phoneClean}&text=${encoded}`;
    modal.classList.add('open');
};

window.closeOrderModal = function () {
    document.getElementById('orderModal').classList.remove('open');
};

document.getElementById('orderModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderModal') closeOrderModal();
});

// Mobile menu
window.toggleMenu = function () {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
};

// Cursor
function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');
    if (window.matchMedia("(hover: none)").matches) return;
    window.addEventListener('mousemove', (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
        outline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: "forwards" });
    });
}

// URL params
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) {
        const found = categories.find(c => c.id === cat || c.name === cat);
        if (found) currentCategory = found.id;
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    loadData();
    checkUrlParams();
    renderSidebarCategories();
    renderMobileTags();
    updateBreadcrumbs();
    renderProducts();

    // Search input
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        renderProducts();
    });

    // Desktop filters
    document.getElementById('priceMin').addEventListener('change', () => { currentPage = 1; renderProducts(); });
    document.getElementById('priceMax').addEventListener('change', () => { currentPage = 1; renderProducts(); });
    document.getElementById('sortSelect').addEventListener('change', () => { currentPage = 1; renderProducts(); });

    // Load more
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        currentPage++;
        renderProducts(true); // appendOnly — only animate new cards
    });
});
