// Catalog Page Logic
const PHONE = window.SITE_SETTINGS ? (window.SITE_SETTINGS.phone || '+380 98 048 84 37') : '+380 98 048 84 37';
const TG_USER = window.SITE_SETTINGS ? (window.SITE_SETTINGS.telegramUser || 'ekvityua') : 'ekvityua';

let categories = [];
let products = [];
let currentCategory = 'all';
let currentPage = 1;
const PAGE_SIZE = 9;

function loadData() {
    categories = JSON.parse(localStorage.getItem('ekvity_categories') || '[]');
    products = JSON.parse(localStorage.getItem('ekvity_products') || '[]');
    categories.sort((a, b) => a.order - b.order);
}

async function fetchSupabaseCatalog() {
    if (!window.supabase) return;
    try {
        const [cRes, pRes] = await Promise.all([
            supabase.from('categories').select('*').order('order'),
            supabase.from('products').select('*')
        ]);
        let shouldRender = false;
        if (!cRes.error && cRes.data && cRes.data.length > 0) {
            categories = cRes.data;
            localStorage.setItem('ekvity_categories', JSON.stringify(categories));
            shouldRender = true;
        }
        if (!pRes.error && pRes.data && pRes.data.length > 0) {
            products = pRes.data;
            localStorage.setItem('ekvity_products', JSON.stringify(products));
            shouldRender = true;
        }
        if (shouldRender) {
            renderSidebarCategories();
            renderMobileTags();
            renderProducts();
            // Reinit sliders with correct price range from real data
            initPriceSlider('priceSliderMin', 'priceSliderMax', 'sliderRange', 'sliderMinLabel', 'sliderMaxLabel', 'priceMin', 'priceMax');
            initPriceSlider('priceSliderMinMobile', 'priceSliderMaxMobile', 'sliderRangeMobile', 'sliderMinLabelMobile', 'sliderMaxLabelMobile', 'priceMinMobile', 'priceMaxMobile');
        }
    } catch (e) {
        console.error('Catalog Supabase error:', e);
    }
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
    card.dataset.productName = p.name;
    card.dataset.productPrice = p.price;
    card.style.transitionDelay = `${animIndex * 0.08}s`;
    const catName = getCategoryName(p.categoryId);
    const featuredBadge = p.featured ? `<div class="featured-badge">Рекомендуємо</div>` : '';
    const mainImg = (p.images && p.images.length) ? p.images[0] : (p.image || '');
    card.innerHTML = `
        <div class="card-image-wrapper" onclick="openLightboxFromCard('${p.id}')">
            ${featuredBadge}
            <img src="${mainImg}" alt="${p.name}" class="product-img" loading="lazy">
            <div class="card-meta-overlay">
                <span class="product-id">${p.id}</span>
            </div>
        </div>
        <div class="card-content">
            <div class="product-category">${catName}</div>
            <h3 class="product-name">${p.name}</h3>
            <p class="product-price">${p.price} <span>UAH</span></p>
            <div class="card-actions">
                <button class="btn-order" onclick="event.stopPropagation(); orderProduct('${p.id}','${p.name.replace(/'/g, "\\'")}',${p.price})">Замовити</button>
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
    const phoneClean = PHONE.replace(/[\s+]/g, '');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    document.getElementById('btnViber').href = isMobile
        ? `viber://add?number=${phoneClean}`
        : `viber://chat?number=%2B${phoneClean}&text=${encoded}`;
    const btnWa = document.getElementById('btnWhatsApp');
    if (btnWa) btnWa.href = `https://wa.me/${phoneClean}?text=${encoded}`;
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

    fetchSupabaseCatalog();

    // Search input
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        renderProducts();
    });

    // Price sliders (init after products load for correct max)
    initPriceSlider('priceSliderMin', 'priceSliderMax', 'sliderRange', 'sliderMinLabel', 'sliderMaxLabel', 'priceMin', 'priceMax');
    initPriceSlider('priceSliderMinMobile', 'priceSliderMaxMobile', 'sliderRangeMobile', 'sliderMinLabelMobile', 'sliderMaxLabelMobile', 'priceMinMobile', 'priceMaxMobile');

    // Sort
    document.getElementById('sortSelect').addEventListener('change', () => { currentPage = 1; renderProducts(); });

    // Load more
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        currentPage++;
        renderProducts(true);
    });
});

// ===== PRICE RANGE SLIDER =====
function initPriceSlider(minId, maxId, rangeId, minLabelId, maxLabelId, hiddenMinId, hiddenMaxId) {
    const sliderMin = document.getElementById(minId);
    const sliderMax = document.getElementById(maxId);
    const range = document.getElementById(rangeId);
    const minLabel = document.getElementById(minLabelId);
    const maxLabel = document.getElementById(maxLabelId);
    const hiddenMin = document.getElementById(hiddenMinId);
    const hiddenMax = document.getElementById(hiddenMaxId);

    if (!sliderMin || !sliderMax) return;

    const maxPrice = products.length ? Math.max(...products.map(p => p.price)) : 10000;
    const roundedMax = Math.ceil(maxPrice / 500) * 500;
    sliderMin.max = roundedMax;
    sliderMax.max = roundedMax;
    sliderMax.value = roundedMax;

    function fmt(v) {
        return v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + ' тис.' : v + '';
    }

    function update() {
        let minVal = parseInt(sliderMin.value);
        let maxVal = parseInt(sliderMax.value);
        if (minVal > maxVal) { [minVal, maxVal] = [maxVal, minVal]; sliderMin.value = minVal; sliderMax.value = maxVal; }
        const pct1 = (minVal / parseInt(sliderMin.max)) * 100;
        const pct2 = (maxVal / parseInt(sliderMax.max)) * 100;
        range.style.left = pct1 + '%';
        range.style.width = (pct2 - pct1) + '%';
        minLabel.textContent = fmt(minVal) + ' грн';
        maxLabel.textContent = fmt(maxVal) + ' грн';
        if (hiddenMin) hiddenMin.value = minVal > 0 ? minVal : '';
        if (hiddenMax) hiddenMax.value = maxVal < parseInt(sliderMax.max) ? maxVal : '';
        currentPage = 1;
        renderProducts();
    }

    sliderMin.addEventListener('input', update);
    sliderMax.addEventListener('input', update);
    update();
}

// ===== LIGHTBOX =====
// Arrow nav: cycles images within product, wraps to prev/next product at edges
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxProduct = null;
let lightboxProductList = [];
let lightboxProductIndex = 0;

function getProductImages(p) {
    return (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
}

window.openLightboxFromCard = function(productId) {
    const cards = document.querySelectorAll('#catalogGrid .product-card');
    const visibleIds = Array.from(cards).map(c => c.dataset.productId);
    lightboxProductList = visibleIds.map(id => products.find(x => x.id === id)).filter(Boolean);

    const idx = lightboxProductList.findIndex(x => x.id === productId);
    lightboxProductIndex = idx >= 0 ? idx : 0;
    _loadProductLightbox(lightboxProductList[lightboxProductIndex], 0);
    document.getElementById('lightboxOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
};

function _loadProductLightbox(p, imgIdx) {
    if (!p) return;
    lightboxProduct = p;
    lightboxImages = getProductImages(p);
    lightboxIndex = Math.max(0, Math.min(imgIdx, lightboxImages.length - 1));
    _renderLightbox();
}

function _renderLightbox() {
    const src = lightboxImages[lightboxIndex];
    const p = lightboxProduct;
    if (!src || !p) return;

    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxImg').alt = p.name;
    updateLightboxCounter('lightboxOverlay', lightboxIndex, lightboxImages.length,
        lightboxProductIndex, lightboxProductList.length);

    const infoEl = document.getElementById('lightboxInfo');
    if (infoEl) {
        infoEl.querySelector('.lb-name').textContent = p.name;
        infoEl.querySelector('.lb-price').textContent = p.price ? p.price + ' UAH' : '';
        infoEl.querySelector('.lb-id').textContent = 'ID: ' + p.id;
        const btn = infoEl.querySelector('.lb-order-btn');
        if (btn) btn.onclick = (e) => { e.stopPropagation(); window.closeLightboxDirect(); orderProduct(p.id, p.name, p.price); };
    }
}

function showLightbox() { _renderLightbox(); } // alias for compat

window.closeLightbox = function(e) {
    if (e && e.target !== document.getElementById('lightboxOverlay')) return;
    window.closeLightboxDirect();
};

window.closeLightboxDirect = function() {
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.body.style.overflow = '';
};

window.lightboxNav = function(dir, e) {
    if (e) e.stopPropagation();
    const newImgIdx = lightboxIndex + dir;

    if (newImgIdx >= 0 && newImgIdx < lightboxImages.length) {
        lightboxIndex = newImgIdx;
        _renderLightbox();
    } else {
        const newProdIdx = lightboxProductIndex + dir;
        if (newProdIdx < 0 || newProdIdx >= lightboxProductList.length) return;
        lightboxProductIndex = newProdIdx;
        const nextP = lightboxProductList[lightboxProductIndex];
        const nextImgs = getProductImages(nextP);
        const startImg = dir === 1 ? 0 : nextImgs.length - 1;
        _loadProductLightbox(nextP, startImg);
    }
};

document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightboxOverlay');
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') window.closeLightboxDirect();
    if (e.key === 'ArrowLeft') window.lightboxNav(-1);
    if (e.key === 'ArrowRight') window.lightboxNav(1);
});

// ===== LIGHTBOX COUNTER =====
function updateLightboxCounter(overlayId, imgIdx, imgTotal, prodIdx, prodTotal) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    let dotsEl = overlay.querySelector('.lb-counter');
    if (!dotsEl) {
        dotsEl = document.createElement('div');
        dotsEl.className = 'lb-counter';
        overlay.appendChild(dotsEl);
    }
    if (imgTotal > 1) {
        dotsEl.style.display = 'flex';
        dotsEl.innerHTML = Array.from({length: imgTotal}, (_, i) =>
            `<span class="lb-dot ${i === imgIdx ? 'active' : ''}"></span>`
        ).join('');
    } else {
        dotsEl.style.display = 'none';
    }

    let prodCounter = overlay.querySelector('.lb-prod-counter');
    if (!prodCounter) {
        prodCounter = document.createElement('div');
        prodCounter.className = 'lb-prod-counter';
        overlay.appendChild(prodCounter);
    }
    if (prodTotal > 1) {
        prodCounter.style.display = 'block';
        prodCounter.textContent = `${prodIdx + 1} / ${prodTotal}`;
    } else {
        prodCounter.style.display = 'none';
    }
}
