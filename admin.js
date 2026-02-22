// Admin Panel Logic - ЄКвіти
const AUTH_PASS = 'admin123';

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
let constructorFlowers = [];

window.handleImageUpload = async function (fileInput, targetId) {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Будь ласка, завантажте зображення (JPG, PNG, тощо).');
        return;
    }

    if (window.supabase) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

        const targetInput = document.getElementById(targetId);
        targetInput.value = 'Завантаження...';

        const { data, error } = await supabase.storage.from('images').upload(fileName, file);
        if (error) {
            console.error('Upload error', error);
            alert('Помилка завантаження: ' + error.message);
            targetInput.value = '';
            return;
        }

        const publicUrl = supabase.storage.from('images').getPublicUrl(fileName).data.publicUrl;
        targetInput.value = publicUrl;
    } else {
        // Optional: add a tiny filesize check here if needed, but for localStorage 
        // we should be careful about large files. ~2MB limit is a good idea.
        if (file.size > 2 * 1024 * 1024) {
            alert('Файл занадто великий! Рекомендується розмір до 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById(targetId).value = e.target.result;
        };
        reader.onerror = function () {
            alert('Помилка читання файлу.');
        }
        reader.readAsDataURL(file);
    }
};

// Seed
function seedData() {
    if (!localStorage.getItem('ekvity_categories')) {
        localStorage.setItem('ekvity_categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem('ekvity_products')) {
        // Also migrate old 'products' key if present
        const old = localStorage.getItem('products');
        if (old) {
            const oldProducts = JSON.parse(old);
            const catMap = { 'Букети': 'cat-1', 'Квіти поштучно': 'cat-2', 'Композиції': 'cat-3' };
            const migrated = oldProducts.map(p => ({
                id: p.id,
                name: p.name,
                categoryId: catMap[p.category] || 'cat-1',
                price: Number(p.price),
                image: p.image,
                desc: p.desc || '',
                featured: p.featured || false
            }));
            localStorage.setItem('ekvity_products', JSON.stringify(migrated));
            localStorage.removeItem('products');
        } else {
            localStorage.setItem('ekvity_products', JSON.stringify(DEFAULT_PRODUCTS));
        }
    }
}

async function loadData() {
    seedData();
    categories = JSON.parse(localStorage.getItem('ekvity_categories')) || [];
    products = JSON.parse(localStorage.getItem('ekvity_products')) || [];
    constructorFlowers = JSON.parse(localStorage.getItem('ekvity_constructor_flowers')) || [];
    categories.sort((a, b) => a.order - b.order);

    if (window.supabase) {
        try {
            const [cRes, pRes, fRes] = await Promise.all([
                supabase.from('categories').select('*').order('order'),
                supabase.from('products').select('*'),
                supabase.from('constructor_flowers').select('*')
            ]);
            if (!cRes.error && cRes.data) categories = cRes.data;
            if (!pRes.error && pRes.data) products = pRes.data;
            if (!fRes.error && fRes.data) constructorFlowers = fRes.data;

            localStorage.setItem('ekvity_categories', JSON.stringify(categories));
            localStorage.setItem('ekvity_products', JSON.stringify(products));
            localStorage.setItem('ekvity_constructor_flowers', JSON.stringify(constructorFlowers));
        } catch (e) {
            console.error('Failed to load admin data from Supabase', e);
        }
    }
}

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

// Auth
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('adminAuth')) showDashboard();
});

window.checkAuth = function () {
    if (document.getElementById('adminPass').value === AUTH_PASS) {
        localStorage.setItem('adminAuth', 'true');
        showDashboard();
    } else {
        alert('Невірний пароль');
    }
};

window.logout = function () {
    localStorage.removeItem('adminAuth');
    location.reload();
};

async function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    await loadData();
    updateStats();
    renderCategories();
    renderAdminProducts();
    populateCatDropdowns();
    if (typeof populateSettingsForm === 'function') populateSettingsForm();
}

function updateStats() {
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statCategories').textContent = categories.length;
    document.getElementById('statFeatured').textContent = products.filter(p => p.featured).length;
}

// Tabs
window.switchTab = function (tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    if (tab === 'categories') {
        document.querySelector('.admin-tab:nth-child(1)').classList.add('active');
        document.getElementById('tabCategories').classList.add('active');
    } else if (tab === 'products') {
        document.querySelector('.admin-tab:nth-child(2)').classList.add('active');
        document.getElementById('tabProducts').classList.add('active');
    } else if (tab === 'constructor') {
        document.querySelector('.admin-tab:nth-child(3)').classList.add('active');
        document.getElementById('tabConstructor').classList.add('active');
        renderConstructorFlowers();
    } else if (tab === 'settings') {
        document.querySelector('.admin-tab:nth-child(4)').classList.add('active');
        document.getElementById('tabSettings').classList.add('active');
        if (typeof populateSettingsForm === 'function') populateSettingsForm();
    }
};

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

    const msg = document.getElementById('settingsSavedMsg');
    msg.style.opacity = '1';
    setTimeout(() => msg.style.opacity = '0', 2000);
};

// ---- CATEGORIES ----
function renderCategories() {
    const list = document.getElementById('catList');
    list.innerHTML = '';
    categories.forEach((cat, idx) => {
        const count = products.filter(p => p.categoryId === cat.id).length;
        const li = document.createElement('li');
        li.className = 'cat-item';
        li.innerHTML = `
            <span class="cat-order">${idx + 1}</span>
            <span class="cat-name">${cat.name}</span>
            <span class="cat-count-badge">${count} тов.</span>
            <button class="cat-toggle ${cat.showOnMain ? 'on' : ''}" title="Показати на головній" onclick="toggleCatMain('${cat.id}')"></button>
            <button class="btn-sm" onclick="moveCat('${cat.id}',-1)" title="Вгору">↑</button>
            <button class="btn-sm" onclick="moveCat('${cat.id}',1)" title="Вниз">↓</button>
            <button class="btn-sm danger" onclick="deleteCategory('${cat.id}')" title="Видалити">✕</button>
        `;
        list.appendChild(li);
    });
}

window.addCategory = function () {
    const input = document.getElementById('newCatName');
    const name = input.value.trim();
    if (!name) return;
    const id = 'cat-' + Date.now();
    categories.push({ id, name, order: categories.length, showOnMain: false });
    saveCategories();
    input.value = '';
    renderCategories();
    populateCatDropdowns();
    updateStats();
};

window.deleteCategory = async function (id) {
    const cat = categories.find(c => c.id === id);
    const count = products.filter(p => p.categoryId === id).length;
    const msg = count > 0
        ? `Видалити категорію "${cat.name}"? В ній ${count} товарів (вони залишаться без категорії).`
        : `Видалити категорію "${cat.name}"?`;
    if (!confirm(msg)) return;
    categories = categories.filter(c => c.id !== id);
    categories.forEach((c, i) => c.order = i);
    saveCategories();
    if (window.supabase) await supabase.from('categories').delete().eq('id', id);
    renderCategories();
    populateCatDropdowns();
    updateStats();
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

// ---- PRODUCTS ----
function populateCatDropdowns() {
    // Filter dropdown
    const filter = document.getElementById('filterCatSelect');
    const current = filter.value;
    filter.innerHTML = '<option value="all">Всі категорії</option>';
    categories.forEach(c => {
        filter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    filter.value = current;

    // Product form dropdown
    const prodCat = document.getElementById('prodCat');
    prodCat.innerHTML = '';
    categories.forEach(c => {
        prodCat.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

window.renderAdminProducts = function () {
    const grid = document.getElementById('adminProductGrid');
    const filterCat = document.getElementById('filterCatSelect').value;
    let filtered = filterCat === 'all' ? products : products.filter(p => p.categoryId === filterCat);

    grid.innerHTML = '';
    filtered.forEach(p => {
        const catName = (categories.find(c => c.id === p.categoryId) || {}).name || '—';
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            ${p.featured ? '<div class="featured-badge">★ Виділений</div>' : ''}
            <div class="card-image-wrapper" style="height: 200px;">
                <img src="${p.image}" class="product-img" style="filter: none;">
            </div>
            <div style="padding: 15px;">
                <div class="product-category">${catName}</div>
                <h4 style="color: white; margin: 5px 0; font-family: var(--font-heading);">${p.name}</h4>
                <div style="color: var(--gold); font-size: 0.85rem;">${p.id} — ${p.price} грн</div>
                ${p.desc ? `<div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 5px;">${p.desc}</div>` : ''}
            </div>
            <div class="admin-card-actions">
                <button onclick="editProduct('${p.id}')" class="btn-icon" title="Редагувати">✎</button>
                <button onclick="deleteProduct('${p.id}')" class="btn-icon btn-delete" title="Видалити">×</button>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.openProductModal = function () {
    document.getElementById('productForm').reset();
    document.getElementById('editingId').value = '';
    document.getElementById('prodImg').value = 'images/bouquet1.jpg';
    document.getElementById('productModalTitle').textContent = 'Новий товар';
    populateCatDropdowns();
    document.getElementById('productModal').classList.add('open');
};

window.closeProductModal = function () {
    document.getElementById('productModal').classList.remove('open');
};

window.saveProduct = function (e) {
    e.preventDefault();
    const editingId = document.getElementById('editingId').value;
    const data = {
        id: document.getElementById('prodId').value.trim(),
        name: document.getElementById('prodName').value.trim(),
        categoryId: document.getElementById('prodCat').value,
        price: Number(document.getElementById('prodPrice').value),
        image: document.getElementById('prodImg').value.trim(),
        topViewImage: document.getElementById('prodTopView').value.trim(),
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
    document.getElementById('prodImg').value = p.image;
    document.getElementById('prodTopView').value = p.topViewImage || '';
    document.getElementById('prodDesc').value = p.desc || '';
    document.getElementById('prodFeatured').checked = !!p.featured;
    document.getElementById('productModalTitle').textContent = 'Редагувати товар';
    document.getElementById('productModal').classList.add('open');
};

window.deleteProduct = async function (id) {
    const p = products.find(x => x.id === id);
    if (!confirm(`Видалити товар "${p ? p.name : id}"?`)) return;
    products = products.filter(x => x.id !== id);
    saveProducts();
    if (window.supabase) await supabase.from('products').delete().eq('id', id);
    renderAdminProducts();
    renderCategories();
    updateStats();
};

// Close modal on overlay click
document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target.id === 'productModal') closeProductModal();
});

// ---- CONSTRUCTOR FLOWERS ----
function renderConstructorFlowers() {
    const grid = document.getElementById('constructorFlowerGrid');
    grid.innerHTML = '';

    if (constructorFlowers.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-dim); padding: 40px; text-align: center;">Квіти для конструктора ще не додані.<br>Натисніть "Додати квітку" щоб створити першу.</p>';
        return;
    }

    constructorFlowers.forEach(f => {
        const card = document.createElement('div');
        card.className = 'card admin-card';
        card.innerHTML = `
            <div class="admin-card-actions">
                <button class="btn-icon" onclick="editConstructorFlower('${f.id}')" title="Редагувати">✎</button>
                <button class="btn-icon btn-delete" onclick="deleteConstructorFlower('${f.id}')" title="Видалити">✕</button>
            </div>
            <img src="${f.image}" alt="${f.name}" loading="lazy">
            <div class="card-info">
                <h3 class="card-title">${f.name}</h3>
                <p class="card-price">${f.price} грн/шт</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.openConstructorFlowerModal = function () {
    document.getElementById('editingConstructorId').value = '';
    document.getElementById('cFlowerName').value = '';
    document.getElementById('cFlowerPrice').value = '';
    document.getElementById('cFlowerImg').value = 'images/bouquet1.jpg';
    document.getElementById('cFlowerImgSelect').value = 'images/bouquet1.jpg';
    document.getElementById('constructorFlowerModalTitle').textContent = 'Нова квітка';
    document.getElementById('constructorFlowerModal').classList.add('open');
};

window.closeConstructorFlowerModal = function () {
    document.getElementById('constructorFlowerModal').classList.remove('open');
};

window.saveConstructorFlower = function (e) {
    e.preventDefault();
    const id = document.getElementById('editingConstructorId').value;
    const name = document.getElementById('cFlowerName').value.trim();
    const price = parseInt(document.getElementById('cFlowerPrice').value);
    const image = document.getElementById('cFlowerImg').value.trim();

    if (!name || !price || !image) {
        alert('Заповніть всі поля');
        return;
    }

    if (id) {
        // Edit existing
        const flower = constructorFlowers.find(f => f.id === id);
        if (flower) {
            flower.name = name;
            flower.price = price;
            flower.image = image;
        }
    } else {
        // Add new
        const newId = 'cf-' + Date.now();
        constructorFlowers.push({ id: newId, name, price, image });
    }

    saveConstructorFlowers();
    closeConstructorFlowerModal();
    renderConstructorFlowers();
};

window.editConstructorFlower = function (id) {
    const f = constructorFlowers.find(x => x.id === id);
    if (!f) return;
    document.getElementById('editingConstructorId').value = f.id;
    document.getElementById('cFlowerName').value = f.name;
    document.getElementById('cFlowerPrice').value = f.price;
    document.getElementById('cFlowerImg').value = f.image;

    const sel = document.getElementById('cFlowerImgSelect');
    const opt = Array.from(sel.options).find(o => o.value === f.image);
    sel.value = opt ? f.image : 'custom';

    document.getElementById('constructorFlowerModalTitle').textContent = 'Редагувати квітку';
    document.getElementById('constructorFlowerModal').classList.add('open');
};

window.deleteConstructorFlower = async function (id) {
    const f = constructorFlowers.find(x => x.id === id);
    if (!confirm(`Видалити квітку "${f ? f.name : id}" з конструктора?`)) return;
    constructorFlowers = constructorFlowers.filter(x => x.id !== id);
    saveConstructorFlowers();
    if (window.supabase) await supabase.from('constructor_flowers').delete().eq('id', id);
    renderConstructorFlowers();
};

// Close constructor modal on overlay click
document.getElementById('constructorFlowerModal').addEventListener('click', (e) => {
    if (e.target.id === 'constructorFlowerModal') closeConstructorFlowerModal();
});
