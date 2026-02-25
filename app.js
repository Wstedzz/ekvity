// Dark Mode Editorial Luxury Theme Logic

const CONFIG = {
    phone: window.SITE_SETTINGS ? (window.SITE_SETTINGS.phone || '+380 98 048 84 37') : '+380 98 048 84 37',
    telegramUser: window.SITE_SETTINGS ? (window.SITE_SETTINGS.telegramUser || 'ekvityua') : 'ekvityua',
    demoMode: true
};

// State
let categories = [];
let products = [];
let category = 'all';

function loadData() {
    categories = JSON.parse(localStorage.getItem('ekvity_categories') || '[]');
    products = JSON.parse(localStorage.getItem('ekvity_products') || '[]');
    categories.sort((a, b) => a.order - b.order);
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
    initHeroSlideshow();

    fetchSupabaseData();
    fetchReviewsFromDB();
    loadInstagramFeed();
});

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
    const btnWa = document.getElementById('btnWhatsApp');

    details.innerHTML = `<h4>${name}</h4><p>ID: ${id} — ${price} грн</p>`;

    const message = `Вітаю! Хочу замовити:\n${name} (ID: ${id})\nЦіна: ${price} грн`;
    const encoded = encodeURIComponent(message);

    const tgLink = `https://t.me/${CONFIG.telegramUser}?text=${encoded}`;
    const phoneClean = CONFIG.phone.replace(/[\s+]/g, '');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const vbLink = isMobile
        ? `viber://add?number=${phoneClean}`
        : `viber://chat?number=%2B${phoneClean}&text=${encoded}`;
    const waLink = `https://wa.me/${phoneClean}?text=${encoded}`;

    btnTg.href = tgLink;
    btnVb.href = vbLink;
    if (btnWa) btnWa.href = waLink;

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
                <img src="${post.localImg}" alt="${post.caption ? post.caption.slice(0, 50) : 'ekvity.ua'}" loading="lazy">
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

// ===== HERO SLIDESHOW =====
function initHeroSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length < 2) return;

    let current = 0;

    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 5000);
}

// ===== HERO STATS COUNT-UP =====
function initStatCounters() {
    const stats = document.querySelectorAll('.hero-stat-number');
    if (!stats.length) return;

    const animate = (el) => {
        const target = parseInt(el.dataset.target, 10);
        const duration = 1600;
        const start = performance.now();

        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animate(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(el => observer.observe(el));
}

initStatCounters();

// ===== REVIEW CARDS FADE-IN =====
(function initReviewCards() {
    const cards = document.querySelectorAll('.review-card');
    if (!cards.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), i * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    cards.forEach(card => observer.observe(card));
})();

// ===== LOAD REVIEWS FROM DB =====
async function fetchReviewsFromDB() {
    const grid = document.querySelector('.reviews-grid');
    if (!grid) return;

    // Try localStorage cache
    const cached = localStorage.getItem('ekvity_reviews');
    if (cached) {
        const cachedReviews = JSON.parse(cached).filter(r => r.visible !== false);
        if (cachedReviews.length > 0) renderReviews(grid, cachedReviews);
    }

    // Fetch from Supabase
    if (!window.supabase) return;
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('visible', true)
            .order('order');
        if (!error && data && data.length > 0) {
            localStorage.setItem('ekvity_reviews', JSON.stringify(data));
            renderReviews(grid, data);
        }
    } catch (e) {
        console.error('Reviews fetch error:', e);
    }
}

function renderReviews(grid, reviews) {
    grid.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-stars">${'★'.repeat(r.rating || 5)}</div>
            <p class="review-text">"${r.text}"</p>
            <div class="review-author">
                <div class="review-avatar">${r.author_initial || r.author_name.charAt(0)}</div>
                <div>
                    <div class="review-name">${r.author_name}</div>
                    <div class="review-source">${r.source || 'Google Maps'}</div>
                </div>
            </div>
        </div>
    `).join('');

    // Re-init fade-in animation
    const cards = grid.querySelectorAll('.review-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), i * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    cards.forEach(card => observer.observe(card));
}
