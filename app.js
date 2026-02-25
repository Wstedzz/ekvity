// Dark Mode Editorial Luxury Theme Logic

const CONFIG = {
    phone: window.SITE_SETTINGS ? (window.SITE_SETTINGS.phone || '+380 98 048 84 37') : '+380 98 048 84 37',
    telegramUser: window.SITE_SETTINGS ? (window.SITE_SETTINGS.telegramUser || 'ekvityua') : 'ekvityua',
    demoMode: true
};

// Default seed data
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

// State
let categories = [];
let products = [];
let category = 'all';

// Seed data if needed
function seedData() {
    if (!localStorage.getItem('ekvity_categories')) {
        localStorage.setItem('ekvity_categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem('ekvity_products')) {
        // Migrate old 'products' key
        const old = localStorage.getItem('products');
        if (old) {
            const oldProducts = JSON.parse(old);
            const catMap = { 'Букети': 'cat-1', 'Квіти поштучно': 'cat-2', 'Композиції': 'cat-3' };
            const migrated = oldProducts.map(p => ({
                id: p.id, name: p.name,
                categoryId: catMap[p.category] || 'cat-1',
                price: Number(p.price), image: p.image,
                desc: p.desc || '', featured: p.featured || false
            }));
            localStorage.setItem('ekvity_products', JSON.stringify(migrated));
            localStorage.removeItem('products');
        } else {
            localStorage.setItem('ekvity_products', JSON.stringify(DEFAULT_PRODUCTS));
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    loadData();
    buildCategoryTabs();
    renderGrid();
    setupTabs();
    setupScroll();
    setupScrollHint();

    fetchSupabaseData();
    loadInstagramFeed();
});

function loadData() {
    seedData();
    categories = JSON.parse(localStorage.getItem('ekvity_categories')) || [];
    products = JSON.parse(localStorage.getItem('ekvity_products')) || [];
    categories.sort((a, b) => a.order - b.order);
}

async function fetchSupabaseData() {
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
            buildCategoryTabs();
            renderGrid();
            setupTabs();
        }
    } catch (e) {
        console.error('Supabase fetch error:', e);
    }
}

// Build category tabs dynamically
function buildCategoryTabs() {
    const tabsContainer = document.getElementById('categoryTabs');
    if (!tabsContainer) return;
    const mainCats = categories.filter(c => c.showOnMain);
    let html = '<button class="tab active" data-category="all">Всі</button>';
    mainCats.forEach(cat => {
        html += `<button class="tab" data-category="${cat.id}">${cat.name}</button>`;
    });
    tabsContainer.innerHTML = html;
}

// Render Grid
function renderGrid() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const mainCatIds = categories.filter(c => c.showOnMain).map(c => c.id);

    let filtered;
    if (category === 'all') {
        filtered = products.filter(p => mainCatIds.includes(p.categoryId));
    } else {
        filtered = products.filter(p => p.categoryId === category);
    }

    filtered.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.transitionDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy">
                <div class="card-meta-overlay">
                    <span class="product-id">${p.id}</span>
                </div>
            </div>
            <div class="card-content">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-price">${p.price} <span>UAH</span></p>
                <div class="card-actions">
                    <button class="btn-order" onclick="order('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price})">
                        Замовити
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);
        setTimeout(() => card.classList.add('visible'), 100);
    });
}

// Order Logic (Modal)
window.order = function (id, name, price) {
    const modal = document.getElementById('orderModal');
    const details = document.getElementById('modalProductDetails');
    const btnTg = document.getElementById('btnTelegram');
    const btnVb = document.getElementById('btnViber');

    details.innerHTML = `<h4>${name}</h4><p>ID: ${id} — ${price} грн</p>`;

    const message = `Вітаю! Хочу замовити:\n${name} (ID: ${id})\nЦіна: ${price} грн`;
    const encoded = encodeURIComponent(message);

    const tgLink = `https://t.me/${CONFIG.telegramUser}?text=${encoded}`;
    const phoneClean = CONFIG.phone.replace('+', '');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const vbLink = isMobile
        ? `viber://add?number=${phoneClean}`
        : `viber://chat?number=%2B${phoneClean}&text=${encoded}`;

    btnTg.href = tgLink;
    btnVb.href = vbLink;

    modal.classList.add('open');
};

window.closeModal = function () {
    document.getElementById('orderModal').classList.remove('open');
};

document.getElementById('orderModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderModal') window.closeModal();
});

// Tabs Logic
function setupTabs() {
    const tabsContainer = document.getElementById('categoryTabs');
    if (!tabsContainer) return;

    tabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        category = tab.dataset.category;
        renderGrid();

        const gridSection = document.getElementById('collection');
        const offset = 150;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = gridSection.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    });
}

// Mobile Menu
window.toggleMenu = function () {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
};

// Cursor Effect
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

// Scroll Animations
function setupScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.manifesto, .footer, .hero-content').forEach(el => observer.observe(el));
}

// Dynamic Category Scroll Hint Update
function setupScrollHint() {
    const tabs = document.querySelector('.tabs');
    const hint = document.getElementById('categoryScrollHint');
    if (!tabs || !hint) return;

    let isFlipping = false;

    hint.addEventListener('click', () => {
        if (hint.classList.contains('left-hint')) {
            tabs.scrollBy({ left: -200, behavior: 'smooth' });
        } else {
            tabs.scrollBy({ left: 200, behavior: 'smooth' });
        }
    });

    tabs.addEventListener('scroll', () => {
        if (isFlipping) return;

        // Switch arrow side if reached the scroll end
        const isAtEnd = tabs.scrollWidth - tabs.clientWidth - tabs.scrollLeft <= 5;

        if (isAtEnd && !hint.classList.contains('left-hint')) {
            isFlipping = true;
            hint.classList.add('hidden-hint'); // Fade out
            setTimeout(() => {
                hint.classList.add('left-hint'); // Move instantly while hidden
                hint.classList.remove('hidden-hint'); // Fade back in
                isFlipping = false;
            }, 300);
        } else if (tabs.scrollLeft <= 5 && hint.classList.contains('left-hint')) {
            isFlipping = true;
            hint.classList.add('hidden-hint'); // Fade out
            setTimeout(() => {
                hint.classList.remove('left-hint'); // Move instantly while hidden
                hint.classList.remove('hidden-hint'); // Fade back in
                isFlipping = false;
            }, 300);
        }
    });
}

// ===== INSTAGRAM FEED =====
async function loadInstagramFeed() {
    const grid = document.getElementById('instagramGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/instagram');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        if (!data.posts || data.posts.length === 0) {
            grid.innerHTML = '';
            return;
        }

        grid.innerHTML = data.posts.map(post => `
            <a class="ig-post" href="${post.url}" target="_blank" rel="noopener">
                <img src="/api/proxy?url=${encodeURIComponent(post.displayUrl)}" alt="${post.caption ? post.caption.slice(0, 50) : 'ekvity.ua'}" loading="lazy">
                <div class="ig-post-overlay">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                </div>
            </a>
        `).join('');
    } catch (err) {
        console.error('Instagram feed error:', err);
        // Hide section on error — no broken UI
        const section = document.getElementById('instagram');
        if (section) section.style.display = 'none';
    }
}
