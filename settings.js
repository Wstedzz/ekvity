// settings.js
const DEFAULT_SITE_SETTINGS = {
    phone: '+380 98 048 84 37',
    telegramUser: 'ekvityua',
    instagramLink: 'https://instagram.com/ekvity.ua',
    homeHeroBg: 'images/52151258a0f-db58-4a70-9af6-931e60f66504.png',
    homeHeroTitle: 'Мистецтво<br>Квітів',
    homeHeroSubtitle: 'Створюємо емоції у кожній пелюстці.<br>Ексклюзивно у Львові.',
    homeAboutTitle: 'Квіти — це мова,<br>яка не потребує слів.',
    homeAboutText: 'Ми не просто продаємо квіти. Ми створюємо візуальну поезію. Кожен букет — це окрема історія,\nрозказана мовою природи, форми та кольору.',
    constHeroTitle: 'Створи свій букет',
    constHeroSubtitle: 'Обирай квіти, упаковку та створюй унікальну композицію на свій смак',
    constDisclaimer: 'Конструктор має ознайомчий характер. Наш флорист збере букет у\nвибраній кольоровій гамі та пропорціях так, щоб він виглядав ідеально.'
};

window.SITE_SETTINGS = { ...DEFAULT_SITE_SETTINGS };

function applySettingsToDOM() {
    const applyToId = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    };

    applyToId('dyn-home-hero-title', window.SITE_SETTINGS.homeHeroTitle);
    applyToId('dyn-home-hero-subtitle', window.SITE_SETTINGS.homeHeroSubtitle);
    applyToId('dyn-home-about-title', window.SITE_SETTINGS.homeAboutTitle);
    applyToId('dyn-home-about-text', window.SITE_SETTINGS.homeAboutText);
    applyToId('dyn-const-hero-title', window.SITE_SETTINGS.constHeroTitle);
    applyToId('dyn-const-hero-subtitle', window.SITE_SETTINGS.constHeroSubtitle);
    applyToId('dyn-const-disclaimer', window.SITE_SETTINGS.constDisclaimer);

    const bg = document.getElementById('dyn-home-hero-bg');
    if (bg) bg.src = window.SITE_SETTINGS.homeHeroBg;

    // Contact info replacement (for a tags with specific classes or data attributes)
    document.querySelectorAll('.dyn-phone').forEach(el => {
        if (el.tagName === 'A') el.href = 'tel:' + window.SITE_SETTINGS.phone.replace(/[\s\-\(\)]/g, '');
        // Usually there's an SVG inside, so we replace text nodes only
        Array.from(el.childNodes).forEach(node => {
            if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                node.textContent = ' ' + window.SITE_SETTINGS.phone;
            }
        });
    });

    document.querySelectorAll('.dyn-insta').forEach(el => {
        if (el.tagName === 'A') el.href = window.SITE_SETTINGS.instagramLink;
    });

    document.querySelectorAll('.dyn-tg').forEach(el => {
        if (el.tagName === 'A') {
            let user = window.SITE_SETTINGS.telegramUser;
            el.href = user.startsWith('http') ? user : 'https://t.me/' + user.replace('@', '');
        }
    });
}

async function initSettings() {
    // Load from cache first for fast rendering
    const cached = JSON.parse(localStorage.getItem('ekvity_site_settings'));
    if (cached) {
        window.SITE_SETTINGS = { ...DEFAULT_SITE_SETTINGS, ...cached };
    }
    applySettingsToDOM();

    // Fetch fresh from Supabase
    if (window.supabase) {
        try {
            const { data, error } = await supabase.from('site_settings').select('*');
            if (!error && data) {
                const dbSettings = {};
                data.forEach(row => { dbSettings[row.key] = row.value; });
                if (Object.keys(dbSettings).length > 0) {
                    window.SITE_SETTINGS = { ...DEFAULT_SITE_SETTINGS, ...dbSettings };
                    localStorage.setItem('ekvity_site_settings', JSON.stringify(window.SITE_SETTINGS));
                    applySettingsToDOM();

                    // Re-populate admin form if on admin page
                    if (typeof window.populateSettingsForm === 'function') {
                        window.populateSettingsForm();
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load settings from Supabase', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', initSettings);
