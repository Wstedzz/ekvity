// ============================================================
// Admin Panel Logic — ЄКвіти (Full CMS)
// ============================================================

// ---- STATE ----
let categories = [];
let products = [];
let constructorFlowers = [];
let blogPosts = [];
let reviews = [];

// ---- TOAST NOTIFICATIONS ----
function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => el.remove(), 3000);
}

// ---- IMAGE UPLOAD ----
window.handleImageUpload = async function (fileInput, targetId) {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Завантажте зображення (JPG, PNG)', 'error'); return; }

    const targetInput = document.getElementById(targetId);

    if (window.supabase) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
        targetInput.value = 'Завантаження...';
        const { data, error } = await supabase.storage.from('images').upload(fileName, file);
        if (error) { toast('Помилка: ' + error.message, 'error'); targetInput.value = ''; return; }
        targetInput.value = supabase.storage.from('images').getPublicUrl(fileName).data.publicUrl;
        toast('Зображення завантажено');
    } else {
        if (file.size > 2 * 1024 * 1024) { toast('Файл > 2MB', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (e) => { targetInput.value = e.target.result; };
        reader.readAsDataURL(file);
    }

    // Update image preview if present
    const previewId = targetId + 'Preview';
    const preview = document.getElementById(previewId);
    if (preview) {
        setTimeout(() => {
            const url = targetInput.value;
            if (url && !url.startsWith('Завантаження')) {
                preview.src = url;
                preview.classList.add('visible');
            }
        }, 500);
    }
};

// ---- IMAGE PREVIEW HELPER ----
window.updateImgPreview = function (input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    const url = input.value.trim();
    if (url && !url.startsWith('data:') && url.length > 5) {
        preview.src = url;
        preview.classList.add('visible');
        preview.onerror = () => { preview.classList.remove('visible'); };
    } else {
        preview.classList.remove('visible');
    }
};

// ---- DATA LOADING ----
async function loadData() {
    if (window.supabase) {
        try {
            const [cRes, pRes, fRes, bRes, rRes] = await Promise.all([
                supabase.from('categories').select('*').order('order'),
                supabase.from('products').select('*'),
                supabase.from('constructor_flowers').select('*'),
                supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
                supabase.from('reviews').select('*').order('order')
            ]);
            if (!cRes.error && cRes.data) categories = cRes.data;
            if (!pRes.error && pRes.data) products = pRes.data;
            if (!fRes.error && fRes.data) constructorFlowers = fRes.data;
            if (!bRes.error && bRes.data) blogPosts = bRes.data;
            if (!rRes.error && rRes.data) reviews = rRes.data;

            // Cache locally
            localStorage.setItem('ekvity_categories', JSON.stringify(categories));
            localStorage.setItem('ekvity_products', JSON.stringify(products));
            localStorage.setItem('ekvity_constructor_flowers', JSON.stringify(constructorFlowers));
            localStorage.setItem('ekvity_blog_posts', JSON.stringify(blogPosts));
            localStorage.setItem('ekvity_reviews', JSON.stringify(reviews));

            document.getElementById('lastSyncTime').textContent = 'Синхронізовано: ' + new Date().toLocaleTimeString('uk');
        } catch (e) {
            console.error('Load error:', e);
            toast('Помилка завантаження даних', 'error');
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    categories = JSON.parse(localStorage.getItem('ekvity_categories') || '[]');
    products = JSON.parse(localStorage.getItem('ekvity_products') || '[]');
    constructorFlowers = JSON.parse(localStorage.getItem('ekvity_constructor_flowers') || '[]');
    blogPosts = JSON.parse(localStorage.getItem('ekvity_blog_posts') || '[]');
    reviews = JSON.parse(localStorage.getItem('ekvity_reviews') || '[]');
    categories.sort((a, b) => a.order - b.order);
}

// ---- SAVE HELPERS ----
async function saveCategories() {
    localStorage.setItem('ekvity_categories', JSON.stringify(categories));
    if (window.supabase) await supabase.from('categories').upsert(categories);
}
async function saveProducts() {
    localStorage.setItem('ekvity_products', JSON.stringify(products));
    if (window.supabase) await supabase.from('products').upsert(products);
}
async function saveConstructorFlowers() {
    localStorage.setItem('ekvity_constructor_flowers', JSON.stringify(constructorFlowers));
    if (window.supabase) await supabase.from('constructor_flowers').upsert(constructorFlowers);
}
async function saveBlogPosts() {
    localStorage.setItem('ekvity_blog_posts', JSON.stringify(blogPosts));
    if (window.supabase) await supabase.from('blog_posts').upsert(blogPosts);
}
async function saveReviews() {
    localStorage.setItem('ekvity_reviews', JSON.stringify(reviews));
    if (window.supabase) await supabase.from('reviews').upsert(reviews);
}

// ---- AUTH ----
document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showDashboard();
        } else {
            supabase.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_IN') showDashboard();
                else if (event === 'SIGNED_OUT') {
                    document.getElementById('loginSection').style.display = 'flex';
                    document.getElementById('dashboardSection').style.display = 'none';
                }
            });
        }
    } else if (localStorage.getItem('adminAuth')) {
        showDashboard();
    }
});

window.checkAuth = async function () {
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errorEl.style.display = 'none';

    if (window.supabase) {
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPass').value;
        if (!email || !password) { errorEl.textContent = 'Введіть email та пароль'; errorEl.style.display = 'block'; return; }

        btn.textContent = 'Завантаження...'; btn.disabled = true;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        btn.textContent = 'Увійти'; btn.disabled = false;

        if (error) { errorEl.textContent = 'Помилка: ' + error.message; errorEl.style.display = 'block'; }
    } else {
        if (document.getElementById('adminPass').value === 'admin123') {
            localStorage.setItem('adminAuth', 'true');
            showDashboard();
        } else { errorEl.textContent = 'Невірний пароль'; errorEl.style.display = 'block'; }
    }
};

window.logout = async function () {
    if (window.supabase) await supabase.auth.signOut();
    localStorage.removeItem('adminAuth');
    location.reload();
};

async function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'flex';
    await loadData();
    refreshAll();
    if (typeof populateSettingsForm === 'function') populateSettingsForm();
}

function refreshAll() {
    updateStats();
    updateNavBadges();
    renderCategories();
    renderAdminProducts();
    populateCatDropdowns();
    renderDashFeatured();
}

// ---- NAVIGATION ----
const PAGE_MAP = {
    dashboard: { title: 'Дашборд', breadcrumb: 'Панель керування', id: 'pageDashboard' },
    products: { title: 'Товари', breadcrumb: 'Контент → Товари', id: 'pageProducts' },
    categories: { title: 'Категорії', breadcrumb: 'Контент → Категорії', id: 'pageCategories' },
    blog: { title: 'Блог', breadcrumb: 'Контент → Блог', id: 'pageBlog' },
    reviews: { title: 'Відгуки', breadcrumb: 'Контент → Відгуки', id: 'pageReviews' },
    constructor: { title: 'Конструктор', breadcrumb: 'Контент → Конструктор', id: 'pageConstructor' },
    settings: { title: 'Налаштування', breadcrumb: 'Система → Налаштування', id: 'pageSettings' }
};

window.navigateTo = function (page) {
    const info = PAGE_MAP[page];
    if (!info) return;

    // Update topbar
    document.getElementById('topbarTitle').textContent = info.title;
    document.getElementById('topbarBreadcrumb').textContent = info.breadcrumb;

    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Show page
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.getElementById(info.id).classList.add('active');

    // Page-specific rendering
    if (page === 'blog') renderBlogList();
    if (page === 'reviews') renderReviewsList();
    if (page === 'constructor') renderConstructorFlowers();
    if (page === 'settings' && typeof populateSettingsForm === 'function') populateSettingsForm();
    if (page === 'products') { renderAdminProducts(); populateCatDropdowns(); }
    if (page === 'categories') renderCategories();

    // Close mobile sidebar
    closeSidebar();
};

window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
};

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ---- STATS ----
function updateStats() {
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statCategories').textContent = categories.length;
    document.getElementById('statBlog').textContent = blogPosts.length;
    document.getElementById('statReviews').textContent = reviews.length;
}

function updateNavBadges() {
    document.getElementById('navBadgeProducts').textContent = products.length;
    document.getElementById('navBadgeCategories').textContent = categories.length;
    document.getElementById('navBadgeBlog').textContent = blogPosts.length;
    document.getElementById('navBadgeReviews').textContent = reviews.length;
}

function renderDashFeatured() {
    const el = document.getElementById('dashFeatured');
    const featured = products.filter(p => p.featured);
    if (featured.length === 0) {
        el.innerHTML = '<span style="opacity:0.5">Немає виділених товарів</span>';
        return;
    }
    el.innerHTML = featured.map(p => {
        const catName = (categories.find(c => c.id === p.categoryId) || {}).name || '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <img src="${p.image}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;">
            <div>
                <div style="font-size:0.82rem;color:white;">${p.name}</div>
                <div style="font-size:0.7rem;color:var(--text-dim);">${catName} · ${p.price} грн</div>
            </div>
        </div>`;
    }).join('');
}

// ---- SETTINGS ----
window.populateSettingsForm = function () {
    if (!window.SITE_SETTINGS) return;
    document.getElementById('setPhone').value = window.SITE_SETTINGS.phone || '';
    document.getElementById('setTg').value = window.SITE_SETTINGS.telegramUser || '';
    document.getElementById('setInsta').value = window.SITE_SETTINGS.instagramLink || '';
    document.getElementById('setHomeTitle').value = window.SITE_SETTINGS.homeHeroTitle || '';
    document.getElementById('setHomeSub').value = window.SITE_SETTINGS.homeHeroSubtitle || '';
    document.getElementById('setHomeBg').value = window.SITE_SETTINGS.homeHeroBg || '';
    document.getElementById('setAboutTitle').value = window.SITE_SETTINGS.homeAboutTitle || '';
    document.getElementById('setAboutText').value = window.SITE_SETTINGS.homeAboutText || '';
    document.getElementById('setConstTitle').value = window.SITE_SETTINGS.constHeroTitle || '';
    document.getElementById('setConstSub').value = window.SITE_SETTINGS.constHeroSubtitle || '';
    document.getElementById('setConstDisc').value = window.SITE_SETTINGS.constDisclaimer || '';
};

window.saveSiteSettings = async function (e) {
    e.preventDefault();
    const s = {
        phone: document.getElementById('setPhone').value.trim(),
        telegramUser: document.getElementById('setTg').value.trim(),
        instagramLink: document.getElementById('setInsta').value.trim(),
        homeHeroTitle: document.getElementById('setHomeTitle').value.trim(),
        homeHeroSubtitle: document.getElementById('setHomeSub').value.trim(),
        homeHeroBg: document.getElementById('setHomeBg').value.trim(),
        homeAboutTitle: document.getElementById('setAboutTitle').value.trim(),
        homeAboutText: document.getElementById('setAboutText').value.trim(),
        constHeroTitle: document.getElementById('setConstTitle').value.trim(),
        constHeroSubtitle: document.getElementById('setConstSub').value.trim(),
        constDisclaimer: document.getElementById('setConstDisc').value.trim()
    };

    window.SITE_SETTINGS = { ...window.SITE_SETTINGS, ...s };
    localStorage.setItem('ekvity_site_settings', JSON.stringify(window.SITE_SETTINGS));

    if (window.supabase) {
        const updates = Object.keys(s).map(key => ({ key, value: s[key] }));
        await supabase.from('site_settings').upsert(updates);
    }
    toast('Налаштування збережено');
};

// ============================================================
// CATEGORIES
// ============================================================
function renderCategories() {
    const list = document.getElementById('catList');
    list.innerHTML = '';
    if (categories.length === 0) {
        list.innerHTML = '<li style="padding:30px;text-align:center;color:var(--text-dim);">Категорій ще немає</li>';
        return;
    }
    categories.forEach((cat, idx) => {
        const count = products.filter(p => p.categoryId === cat.id).length;
        const li = document.createElement('li');
        li.className = 'cat-item';
        li.innerHTML = `
            <span class="cat-order">${idx + 1}</span>
            <span class="cat-name">${cat.name}</span>
            <span class="badge badge-gray">${count} тов.</span>
            <button class="cat-toggle ${cat.showOnMain ? 'on' : ''}" title="На головній" onclick="toggleCatMain('${cat.id}')"></button>
            <button class="btn btn-sm" onclick="moveCat('${cat.id}',-1)" title="Вгору">↑</button>
            <button class="btn btn-sm" onclick="moveCat('${cat.id}',1)" title="Вниз">↓</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')" title="Видалити">✕</button>
        `;
        list.appendChild(li);
    });
}

window.addCategory = function () {
    const input = document.getElementById('newCatName');
    const name = input.value.trim();
    if (!name) return;
    categories.push({ id: 'cat-' + Date.now(), name, order: categories.length, showOnMain: false });
    saveCategories();
    input.value = '';
    renderCategories();
    populateCatDropdowns();
    updateStats();
    updateNavBadges();
    toast('Категорію додано');
};

window.deleteCategory = async function (id) {
    const cat = categories.find(c => c.id === id);
    const count = products.filter(p => p.categoryId === id).length;
    const msg = count > 0
        ? `Видалити "${cat.name}"? ${count} товарів залишаться без категорії.`
        : `Видалити "${cat.name}"?`;
    if (!confirm(msg)) return;
    categories = categories.filter(c => c.id !== id);
    categories.forEach((c, i) => c.order = i);
    saveCategories();
    if (window.supabase) await supabase.from('categories').delete().eq('id', id);
    renderCategories();
    populateCatDropdowns();
    updateStats();
    updateNavBadges();
    toast('Категорію видалено');
};

window.toggleCatMain = function (id) {
    const cat = categories.find(c => c.id === id);
    if (cat) { cat.showOnMain = !cat.showOnMain; saveCategories(); renderCategories(); }
};

window.moveCat = function (id, dir) {
    const idx = categories.findIndex(c => c.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    [categories[idx], categories[newIdx]] = [categories[newIdx], categories[idx]];
    categories.forEach((c, i) => c.order = i);
    saveCategories();
    renderCategories();
};

// ============================================================
// PRODUCTS
// ============================================================
function populateCatDropdowns() {
    const filter = document.getElementById('filterCatSelect');
    const current = filter.value;
    filter.innerHTML = '<option value="all">Всі категорії</option>';
    categories.forEach(c => { filter.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    filter.value = current;

    const prodCat = document.getElementById('prodCat');
    prodCat.innerHTML = '';
    categories.forEach(c => { prodCat.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
}

window.renderAdminProducts = function () {
    const grid = document.getElementById('adminProductGrid');
    const filterCat = document.getElementById('filterCatSelect').value;
    const search = (document.getElementById('productSearch').value || '').toLowerCase().trim();

    let filtered = filterCat === 'all' ? [...products] : products.filter(p => p.categoryId === filterCat);
    if (search) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search) ||
            (p.desc && p.desc.toLowerCase().includes(search))
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/></svg>
            <h4>Товарів не знайдено</h4>
            <p>Додайте перший товар або змініть фільтр</p>
        </div>`;
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(p => {
        const catName = (categories.find(c => c.id === p.categoryId) || {}).name || '—';
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            ${p.featured ? '<div class="admin-card-badge">★ Виділений</div>' : ''}
            <img src="${p.image}" alt="${p.name}" class="admin-card-img" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23111%22 width=%22200%22 height=%22200%22/></svg>'">
            <div class="admin-card-body">
                <div class="admin-card-cat">${catName}</div>
                <div class="admin-card-title">${p.name}</div>
                <div class="admin-card-price">${p.id} · ${p.price} грн</div>
            </div>
            <div class="admin-card-actions">
                <button class="btn btn-icon" onclick="editProduct('${p.id}')" title="Редагувати">✎</button>
                <button class="btn btn-icon btn-danger" onclick="deleteProduct('${p.id}')" title="Видалити">×</button>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.openProductModal = function () {
    document.getElementById('productForm').reset();
    document.getElementById('editingId').value = '';
    document.getElementById('prodImg').value = '';
    document.getElementById('productModalTitle').textContent = 'Новий товар';
    // Reset image preview
    const preview = document.getElementById('prodImgPreview');
    if (preview) { preview.classList.remove('visible'); preview.src = ''; }
    populateCatDropdowns();
    document.getElementById('productModal').classList.add('open');
};
window.closeProductModal = function () { document.getElementById('productModal').classList.remove('open'); };

window.saveProduct = function (e) {
    e.preventDefault();
    const editingId = document.getElementById('editingId').value;
    const data = {
        id: document.getElementById('prodId').value.trim(),
        name: document.getElementById('prodName').value.trim(),
        categoryId: document.getElementById('prodCat').value,
        price: Number(document.getElementById('prodPrice').value),
        image: document.getElementById('prodImg').value.trim(),
        desc: document.getElementById('prodDesc').value.trim(),
        featured: document.getElementById('prodFeatured').checked
    };

    if (editingId) {
        const idx = products.findIndex(p => p.id === editingId);
        if (idx !== -1) products[idx] = data;
    } else {
        products.unshift(data);
    }

    saveProducts();
    closeProductModal();
    renderAdminProducts();
    renderCategories();
    updateStats();
    updateNavBadges();
    renderDashFeatured();
    toast(editingId ? 'Товар оновлено' : 'Товар додано');
};

window.editProduct = function (id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    populateCatDropdowns();
    document.getElementById('editingId').value = p.id;
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodCat').value = p.categoryId;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodImg').value = p.image || '';
    document.getElementById('prodDesc').value = p.desc || '';
    document.getElementById('prodFeatured').checked = !!p.featured;
    document.getElementById('productModalTitle').textContent = 'Редагувати товар';
    // Show image preview
    const preview = document.getElementById('prodImgPreview');
    if (preview && p.image) { preview.src = p.image; preview.classList.add('visible'); }
    else if (preview) { preview.classList.remove('visible'); }
    document.getElementById('productModal').classList.add('open');
};

window.deleteProduct = async function (id) {
    const p = products.find(x => x.id === id);
    if (!confirm(`Видалити "${p ? p.name : id}"?`)) return;
    products = products.filter(x => x.id !== id);
    saveProducts();
    if (window.supabase) await supabase.from('products').delete().eq('id', id);
    renderAdminProducts();
    renderCategories();
    updateStats();
    updateNavBadges();
    renderDashFeatured();
    toast('Товар видалено');
};

// Modal overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'productModal') closeProductModal();
    if (e.target.id === 'blogModal') closeBlogModal();
    if (e.target.id === 'reviewModal') closeReviewModal();
    if (e.target.id === 'constructorFlowerModal') closeConstructorFlowerModal();
});

// ============================================================
// BLOG
// ============================================================
window.renderBlogList = function () {
    const container = document.getElementById('blogListContainer');
    const search = (document.getElementById('blogSearch').value || '').toLowerCase().trim();

    let filtered = [...blogPosts];
    if (search) {
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(search) ||
            p.slug.toLowerCase().includes(search) ||
            (p.description && p.description.toLowerCase().includes(search))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <h4>Статей ще немає</h4>
            <p>Напишіть першу статтю для блогу</p>
            <button class="btn btn-primary" onclick="openBlogModal()">+ Нова стаття</button>
        </div>`;
        return;
    }

    container.innerHTML = `<table class="data-table">
        <thead><tr>
            <th>Зображення</th><th>Заголовок</th><th>Slug</th><th>Статус</th><th>Мета</th><th>Дії</th>
        </tr></thead>
        <tbody>${filtered.map(p => `<tr>
            <td><img src="${p.image || ''}" class="thumb" onerror="this.style.display='none'"></td>
            <td style="font-family:var(--font-heading);max-width:250px;">${p.title}</td>
            <td style="color:var(--text-dim);font-size:0.78rem;">/blog/${p.slug}</td>
            <td>${p.published ? '<span class="badge badge-green">Опубліковано</span>' : '<span class="badge badge-gray">Чернетка</span>'}</td>
            <td style="color:var(--text-dim);font-size:0.78rem;">${p.meta || ''}</td>
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-sm" onclick="editBlogPost('${p.id}')">✎</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBlogPost('${p.id}')">✕</button>
                </div>
            </td>
        </tr>`).join('')}</tbody>
    </table>`;
};

window.openBlogModal = function () {
    document.getElementById('blogForm').reset();
    document.getElementById('editingBlogId').value = '';
    document.getElementById('blogPublished').checked = true;
    document.getElementById('blogModalTitle').textContent = 'Нова стаття';
    document.getElementById('blogModal').classList.add('open');
    initBlogEditor('');
};
window.closeBlogModal = function () {
    destroyBlogEditor();
    document.getElementById('blogModal').classList.remove('open');
};

// ---- TinyMCE Blog Editor ----
let blogEditorInstance = null;

function initBlogEditor(content) {
    destroyBlogEditor();
    const wrap = document.getElementById('blogEditorWrap');
    // Create a fresh element with unique ID to avoid TinyMCE registry conflicts
    const editorId = 'blogEditor_' + Date.now();
    wrap.innerHTML = `<textarea id="${editorId}"></textarea>`;

    // Set content on the textarea BEFORE TinyMCE init
    const ta = document.getElementById(editorId);
    ta.value = content || '';

    if (typeof tinymce === 'undefined') {
        // Fallback: show plain textarea
        ta.className = 'content-editor';
        ta.style.display = 'block';
        ta.id = 'blogEditorArea';
        return;
    }

    const initContent = content || '';
    tinymce.init({
        selector: '#' + editorId,
        height: 420,
        skin: 'oxide-dark',
        content_css: 'dark',
        promotion: false,
        branding: false,
        menubar: 'file edit insert format',
        plugins: 'lists link image table code hr fullscreen media autolink',
        toolbar: 'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link image media | table hr | code fullscreen',
        content_style: `
            body {
                font-family: 'Montserrat', sans-serif;
                font-size: 15px;
                line-height: 1.8;
                color: #e0e0e0;
                background: #0d0d0d;
                padding: 12px;
            }
            a { color: #c8a96e; }
            h1,h2,h3,h4 { font-family: 'Playfair Display', serif; color: #fff; }
            img { max-width: 100%; height: auto; border-radius: 6px; }
            blockquote { border-left: 3px solid #c8a96e; padding-left: 16px; color: #aaa; }
        `,
        init_instance_callback: (editor) => {
            blogEditorInstance = editor;
            if (initContent) editor.setContent(initContent);
        },
        // Image upload via Supabase storage
        images_upload_handler: async (blobInfo) => {
            if (!window.supabase) return blobInfo.blobUri();
            const ext = blobInfo.filename().split('.').pop() || 'jpg';
            const fileName = `blog-${Date.now()}-${Math.random().toString(36).substring(2,7)}.${ext}`;
            const { data, error } = await supabase.storage.from('images').upload(fileName, blobInfo.blob());
            if (error) { toast('Помилка завантаження: ' + error.message, 'error'); throw error; }
            return supabase.storage.from('images').getPublicUrl(fileName).data.publicUrl;
        }
    });
}

function destroyBlogEditor() {
    if (blogEditorInstance) {
        try { tinymce.remove(blogEditorInstance); } catch(e) {}
        blogEditorInstance = null;
    }
    // Also remove any orphaned TinyMCE editors in the wrap
    if (typeof tinymce !== 'undefined') {
        try { tinymce.get().forEach(ed => { if (ed.id && ed.id.startsWith('blogEditor_')) tinymce.remove(ed); }); } catch(e) {}
    }
}

function getBlogEditorContent() {
    if (blogEditorInstance) return blogEditorInstance.getContent();
    // Fallback textarea
    const ta = document.getElementById('blogEditorArea') || document.querySelector('#blogEditorWrap textarea');
    return ta ? ta.value.trim() : '';
}

window.autoGenerateSlug = function () {
    const titleEl = document.getElementById('blogTitle');
    const slugEl = document.getElementById('blogSlug');
    // Only auto-generate if slug is empty or was auto-generated before
    if (slugEl.dataset.manual === 'true') return;
    const title = titleEl.value;
    // Ukrainian transliteration map
    const ukMap = {'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya'};
    let slug = title.toLowerCase();
    slug = slug.split('').map(c => ukMap[c] || c).join('');
    slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
    slugEl.value = slug;
};

window.saveBlogPost = async function (e) {
    e.preventDefault();
    const editingId = document.getElementById('editingBlogId').value;
    const data = {
        id: editingId || ('blog-' + Date.now()),
        slug: document.getElementById('blogSlug').value.trim(),
        title: document.getElementById('blogTitle').value.trim(),
        description: document.getElementById('blogDesc').value.trim(),
        content: getBlogEditorContent(),
        image: document.getElementById('blogImage').value.trim(),
        meta: document.getElementById('blogMeta').value.trim(),
        published: document.getElementById('blogPublished').checked,
        updated_at: new Date().toISOString()
    };

    if (editingId) {
        const idx = blogPosts.findIndex(p => p.id === editingId);
        if (idx !== -1) blogPosts[idx] = { ...blogPosts[idx], ...data };
    } else {
        data.created_at = new Date().toISOString();
        blogPosts.unshift(data);
    }

    saveBlogPosts();
    closeBlogModal();
    renderBlogList();
    updateStats();
    updateNavBadges();
    toast(editingId ? 'Статтю оновлено' : 'Статтю створено');
};

window.editBlogPost = function (id) {
    const p = blogPosts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editingBlogId').value = p.id;
    document.getElementById('blogTitle').value = p.title || '';
    document.getElementById('blogSlug').value = p.slug || '';
    document.getElementById('blogSlug').dataset.manual = 'true';
    document.getElementById('blogDesc').value = p.description || '';
    document.getElementById('blogImage').value = p.image || '';
    document.getElementById('blogMeta').value = p.meta || '';
    document.getElementById('blogPublished').checked = !!p.published;
    document.getElementById('blogModalTitle').textContent = 'Редагувати статтю';
    document.getElementById('blogModal').classList.add('open');
    initBlogEditor(p.content || '');
};

window.deleteBlogPost = async function (id) {
    const p = blogPosts.find(x => x.id === id);
    if (!confirm(`Видалити "${p ? p.title : id}"?`)) return;
    blogPosts = blogPosts.filter(x => x.id !== id);
    saveBlogPosts();
    if (window.supabase) await supabase.from('blog_posts').delete().eq('id', id);
    renderBlogList();
    updateStats();
    updateNavBadges();
    toast('Статтю видалено');
};

// ============================================================
// REVIEWS
// ============================================================
window.renderReviewsList = function () {
    const container = document.getElementById('reviewsListContainer');

    if (reviews.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <h4>Відгуків ще немає</h4>
            <p>Додайте відгуки клієнтів для відображення на сайті</p>
            <button class="btn btn-primary" onclick="openReviewModal()">+ Додати відгук</button>
        </div>`;
        return;
    }

    container.innerHTML = `<table class="data-table">
        <thead><tr>
            <th>#</th><th>Автор</th><th>Рейтинг</th><th>Текст</th><th>Джерело</th><th>Статус</th><th>Дії</th>
        </tr></thead>
        <tbody>${reviews.map((r, i) => `<tr>
            <td style="color:var(--text-dim)">${i + 1}</td>
            <td style="white-space:nowrap;">${r.author_name}</td>
            <td style="color:var(--gold);">${'★'.repeat(r.rating || 5)}</td>
            <td style="max-width:300px;font-size:0.8rem;color:var(--text-mid);">${(r.text || '').substring(0, 120)}${(r.text || '').length > 120 ? '...' : ''}</td>
            <td style="color:var(--text-dim);font-size:0.78rem;">${r.source || 'Google Maps'}</td>
            <td>${r.visible !== false ? '<span class="badge badge-green">Видимий</span>' : '<span class="badge badge-gray">Прихований</span>'}</td>
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-sm" onclick="editReview('${r.id}')">✎</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReview('${r.id}')">✕</button>
                </div>
            </td>
        </tr>`).join('')}</tbody>
    </table>`;
};

window.openReviewModal = function () {
    document.getElementById('reviewForm').reset();
    document.getElementById('editingReviewId').value = '';
    document.getElementById('reviewRating').value = 5;
    document.getElementById('reviewSource').value = 'Google Maps';
    document.getElementById('reviewVisible').checked = true;
    document.getElementById('reviewModalTitle').textContent = 'Новий відгук';
    document.getElementById('reviewModal').classList.add('open');
};
window.closeReviewModal = function () { document.getElementById('reviewModal').classList.remove('open'); };

window.saveReview = async function (e) {
    e.preventDefault();
    const editingId = document.getElementById('editingReviewId').value;
    const authorName = document.getElementById('reviewAuthor').value.trim();
    const data = {
        id: editingId || ('rev-' + Date.now()),
        author_name: authorName,
        author_initial: authorName.charAt(0).toUpperCase(),
        rating: parseInt(document.getElementById('reviewRating').value) || 5,
        text: document.getElementById('reviewText').value.trim(),
        source: document.getElementById('reviewSource').value.trim() || 'Google Maps',
        visible: document.getElementById('reviewVisible').checked,
        order: editingId ? (reviews.find(r => r.id === editingId) || {}).order || 0 : reviews.length
    };

    if (editingId) {
        const idx = reviews.findIndex(r => r.id === editingId);
        if (idx !== -1) reviews[idx] = { ...reviews[idx], ...data };
    } else {
        data.created_at = new Date().toISOString();
        reviews.push(data);
    }

    saveReviews();
    closeReviewModal();
    renderReviewsList();
    updateStats();
    updateNavBadges();
    toast(editingId ? 'Відгук оновлено' : 'Відгук додано');
};

window.editReview = function (id) {
    const r = reviews.find(x => x.id === id);
    if (!r) return;
    document.getElementById('editingReviewId').value = r.id;
    document.getElementById('reviewAuthor').value = r.author_name || '';
    document.getElementById('reviewRating').value = r.rating || 5;
    document.getElementById('reviewText').value = r.text || '';
    document.getElementById('reviewSource').value = r.source || 'Google Maps';
    document.getElementById('reviewVisible').checked = r.visible !== false;
    document.getElementById('reviewModalTitle').textContent = 'Редагувати відгук';
    document.getElementById('reviewModal').classList.add('open');
};

window.deleteReview = async function (id) {
    const r = reviews.find(x => x.id === id);
    if (!confirm(`Видалити відгук від "${r ? r.author_name : id}"?`)) return;
    reviews = reviews.filter(x => x.id !== id);
    saveReviews();
    if (window.supabase) await supabase.from('reviews').delete().eq('id', id);
    renderReviewsList();
    updateStats();
    updateNavBadges();
    toast('Відгук видалено');
};

// ---- GOOGLE REVIEWS IMPORT ----
let _googleFetchedReviews = [];
let _googleSelectedPlaceId = '';

window.fetchGoogleReviews = function () {
    // Always start with search step
    document.getElementById('googleStep1').style.display = '';
    document.getElementById('googleStep2').style.display = 'none';
    document.getElementById('googleStep3').style.display = 'none';
    document.getElementById('googlePlaceResults').innerHTML = '';
    document.getElementById('googleModalTitle').textContent = 'Імпорт відгуків з Google Maps';
    _googleFetchedReviews = [];
    _googleSelectedPlaceId = '';

    document.getElementById('googlePlaceQuery').value = 'ЄКвіти Львів';
    document.getElementById('googleReviewsModal').classList.add('open');
};

window.searchGooglePlace = async function () {
    const query = document.getElementById('googlePlaceQuery').value.trim();
    if (!query) { toast('Введіть назву або адресу', 'error'); return; }

    const results = document.getElementById('googlePlaceResults');
    results.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-dim);">Пошук...</div>';

    try {
        const resp = await fetch(`/api/google-place-search?q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Server error');
        if (!data.places || data.places.length === 0) {
            results.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:12px;">Нічого не знайдено. Спробуйте іншу назву.</p>';
            return;
        }

        results.innerHTML = data.places.slice(0, 5).map(p => `
            <div class="g-place-card" onclick="selectGooglePlace('${p.placeId}', '${(p.name || '').replace(/'/g, "\\'")}')">
                <div class="g-place-name">${p.name}</div>
                <div class="g-place-addr">${p.address}</div>
                ${p.rating ? `<div class="g-place-rating">${'★'.repeat(Math.round(p.rating))} ${p.rating} (${p.totalReviews} відгуків)</div>` : ''}
            </div>
        `).join('');
    } catch (err) {
        results.innerHTML = `<p style="color:var(--danger);text-align:center;padding:12px;">Помилка: ${err.message}</p>`;
    }
};

window.selectGooglePlace = function (placeId, placeName) {
    loadReviewsForPlace(placeId, placeName);
};

async function loadReviewsForPlace(placeId, placeName) {
    _googleSelectedPlaceId = placeId;

    // Show loading
    document.getElementById('googleStep1').style.display = 'none';
    document.getElementById('googleStep2').style.display = '';
    document.getElementById('googleStep3').style.display = 'none';
    if (placeName) {
        document.getElementById('googleModalTitle').textContent = `Відгуки — ${placeName}`;
    }

    try {
        const resp = await fetch(`/api/google-reviews?placeId=${encodeURIComponent(placeId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Server error');
        if (!data.reviews || data.reviews.length === 0) {
            document.getElementById('googleStep2').innerHTML =
                '<p style="color:var(--text-dim);padding:20px;text-align:center;">Google не повернув жодного відгуку.</p>' +
                '<div style="text-align:center;"><button class="btn" onclick="googleBackToSearch()">← Назад</button></div>';
            return;
        }

        _googleFetchedReviews = data.reviews;

        renderGoogleReviewCards();
    } catch (err) {
        document.getElementById('googleStep2').innerHTML =
            `<p style="color:var(--danger);padding:20px;text-align:center;">Помилка: ${err.message}</p>` +
            '<div style="text-align:center;"><button class="btn" onclick="googleBackToSearch()">← Назад</button></div>';
    }
}

window.googleBackToSearch = function () {
    document.getElementById('googleStep1').style.display = '';
    document.getElementById('googleStep2').style.display = 'none';
    document.getElementById('googleStep3').style.display = 'none';
    document.getElementById('googleModalTitle').textContent = 'Імпорт відгуків з Google Maps';
};

function renderGoogleReviewCards() {
    const container = document.getElementById('googleReviewsItems');
    const existingKeys = new Set(reviews.map(r => `${r.author_name}::${(r.text || '').substring(0, 40)}`));

    container.innerHTML = _googleFetchedReviews.map((r, i) => {
        const key = `${r.author_name}::${(r.text || '').substring(0, 40)}`;
        const exists = existingKeys.has(key);
        return `<div class="g-review-card ${exists ? '' : 'selected'}" data-idx="${i}" onclick="toggleGoogleReview(this)">
            <div class="g-review-header">
                <input type="checkbox" class="g-review-check" ${exists ? '' : 'checked'} onclick="event.stopPropagation();" onchange="this.closest('.g-review-card').classList.toggle('selected', this.checked)">
                <span class="g-review-author">${r.author_name}</span>
                <span class="g-review-stars">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</span>
                <span class="g-review-time">${r.relative_time || ''}</span>
            </div>
            <div class="g-review-text">${(r.text || '').substring(0, 300)}${(r.text || '').length > 300 ? '...' : ''}</div>
            ${exists ? '<span class="g-review-exists">⚠ Вже імпортовано</span>' : ''}
        </div>`;
    }).join('');

    const total = _googleFetchedReviews.length;
    document.getElementById('googleReviewsCount').textContent = `${total} відгуків знайдено`;
    document.getElementById('googleSelectAll').checked = true;

    // Switch to step 3
    document.getElementById('googleStep1').style.display = 'none';
    document.getElementById('googleStep2').style.display = 'none';
    document.getElementById('googleStep3').style.display = '';
}

window.toggleGoogleReview = function (card) {
    const cb = card.querySelector('.g-review-check');
    cb.checked = !cb.checked;
    card.classList.toggle('selected', cb.checked);
    // Update select-all checkbox
    const all = document.querySelectorAll('#googleReviewsItems .g-review-check');
    const checked = document.querySelectorAll('#googleReviewsItems .g-review-check:checked');
    document.getElementById('googleSelectAll').checked = checked.length === all.length;
};

window.toggleAllGoogleReviews = function (state) {
    document.querySelectorAll('#googleReviewsItems .g-review-card').forEach(card => {
        const cb = card.querySelector('.g-review-check');
        cb.checked = state;
        card.classList.toggle('selected', state);
    });
};

window.importSelectedGoogleReviews = async function () {
    const cards = document.querySelectorAll('#googleReviewsItems .g-review-card');
    let imported = 0;

    cards.forEach(card => {
        const cb = card.querySelector('.g-review-check');
        if (!cb.checked) return;
        const idx = parseInt(card.dataset.idx);
        const r = _googleFetchedReviews[idx];
        if (!r) return;

        reviews.push({
            id: 'rev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            author_name: r.author_name,
            author_initial: (r.author_name || 'G').charAt(0).toUpperCase(),
            rating: r.rating || 5,
            text: r.text || '',
            source: 'Google Maps',
            visible: true,
            order: reviews.length,
            created_at: new Date().toISOString()
        });
        imported++;
    });

    if (imported === 0) {
        toast('Не обрано жодного відгуку', 'error');
        return;
    }

    await saveReviews();
    closeGoogleReviewsModal();
    renderReviewsList();
    updateStats();
    updateNavBadges();
    toast(`Імпортовано ${imported} відгук(ів) з Google Maps`);
};

window.closeGoogleReviewsModal = function () {
    document.getElementById('googleReviewsModal').classList.remove('open');
    _googleFetchedReviews = [];
};

// ============================================================
// CONSTRUCTOR FLOWERS
// ============================================================
function renderConstructorFlowers() {
    const grid = document.getElementById('constructorFlowerGrid');

    if (constructorFlowers.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            <h4>Квіти не додані</h4>
            <p>Додайте квіти для конструктора букетів</p>
            <button class="btn btn-primary" onclick="openConstructorFlowerModal()">+ Додати квітку</button>
        </div>`;
        return;
    }

    grid.innerHTML = '';
    constructorFlowers.forEach(f => {
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <img src="${f.image}" alt="${f.name}" class="admin-card-img" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23111%22 width=%22200%22 height=%22200%22/></svg>'">
            <div class="admin-card-body">
                <div class="admin-card-title">${f.name}</div>
                <div class="admin-card-price">${f.price} грн/шт</div>
            </div>
            <div class="admin-card-actions">
                <button class="btn btn-icon" onclick="editConstructorFlower('${f.id}')" title="Редагувати">✎</button>
                <button class="btn btn-icon btn-danger" onclick="deleteConstructorFlower('${f.id}')" title="Видалити">✕</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.openConstructorFlowerModal = function () {
    document.getElementById('constructorFlowerForm').reset();
    document.getElementById('editingConstructorId').value = '';
    document.getElementById('cFlowerImg').value = '';
    document.getElementById('constructorFlowerModalTitle').textContent = 'Нова квітка';
    document.getElementById('constructorFlowerModal').classList.add('open');
};
window.closeConstructorFlowerModal = function () { document.getElementById('constructorFlowerModal').classList.remove('open'); };

window.saveConstructorFlower = function (e) {
    e.preventDefault();
    const id = document.getElementById('editingConstructorId').value;
    const name = document.getElementById('cFlowerName').value.trim();
    const price = parseInt(document.getElementById('cFlowerPrice').value);
    const image = document.getElementById('cFlowerImg').value.trim();

    if (!name || !price || !image) { toast('Заповніть всі поля', 'error'); return; }

    if (id) {
        const flower = constructorFlowers.find(f => f.id === id);
        if (flower) { flower.name = name; flower.price = price; flower.image = image; }
    } else {
        constructorFlowers.push({ id: 'cf-' + Date.now(), name, price, image });
    }

    saveConstructorFlowers();
    closeConstructorFlowerModal();
    renderConstructorFlowers();
    toast(id ? 'Квітку оновлено' : 'Квітку додано');
};

window.editConstructorFlower = function (id) {
    const f = constructorFlowers.find(x => x.id === id);
    if (!f) return;
    document.getElementById('editingConstructorId').value = f.id;
    document.getElementById('cFlowerName').value = f.name;
    document.getElementById('cFlowerPrice').value = f.price;
    document.getElementById('cFlowerImg').value = f.image;
    document.getElementById('constructorFlowerModalTitle').textContent = 'Редагувати квітку';
    document.getElementById('constructorFlowerModal').classList.add('open');
};

window.deleteConstructorFlower = async function (id) {
    const f = constructorFlowers.find(x => x.id === id);
    if (!confirm(`Видалити "${f ? f.name : id}"?`)) return;
    constructorFlowers = constructorFlowers.filter(x => x.id !== id);
    saveConstructorFlowers();
    if (window.supabase) await supabase.from('constructor_flowers').delete().eq('id', id);
    renderConstructorFlowers();
    toast('Квітку видалено');
};
