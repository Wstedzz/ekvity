# ЄКвіти - Квіткова майстерня у Львові

Сучасний каталог продуктів для української квіткарні з адмін-панеллю та інтеграцією Telegram/Viber для замовлень.

## 🌸 Особливості

- ✨ Елегантний дизайн з квітковим настроєм
- 📱 Повністю адаптивний (mobile-first)
- 🛒 Замовлення через Telegram або Viber
- 🎨 Адмін-панель для керування продуктами
- 🗄️ Supabase backend (безкоштовний tier)
- 🖼️ Завантаження зображень у Supabase Storage

## 📁 Структура проекту

```
ekvity/
├── index.html          # Головна сторінка каталогу
├── admin.html          # Адмін-панель
├── style.css           # Всі стилі
├── app.js              # Логіка головної сторінки
├── admin.js            # Логіка адмін-панелі
└── README.md           # Ця інструкція
```

## 🚀 Налаштування Supabase

### Крок 1: Створення проекту

1. Зареєструйтеся на [supabase.com](https://supabase.com)
2. Створіть новий проект
3. Виберіть регіон (найближчий до України)
4. Зачекайте завершення налаштування (~2 хвилини)

### Крок 2: Створення таблиці `products`

1. Перейдіть в розділ **SQL Editor**
2. Створіть нову query та вставте цей код:

```sql
-- Створення таблиці products
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для швидшого пошуку
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Публічний доступ на читання
CREATE POLICY "Публічний доступ на читання"
    ON products
    FOR SELECT
    TO anon
    USING (true);

-- Доступ на запис тільки для авторизованих користувачів
CREATE POLICY "Авторизовані можуть додавати"
    ON products
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Авторизовані можуть оновлювати"
    ON products
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Авторизовані можуть видаляти"
    ON products
    FOR DELETE
    TO authenticated
    USING (true);
```

3. Натисніть **Run** або `Ctrl+Enter`

### Крок 3: Налаштування Storage для зображень

1. Перейдіть в розділ **Storage**
2. Створіть новий bucket з назвою `products`
3. У налаштуваннях bucket:
   - **Public bucket**: Увімкнути ✅
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
   - **Max file size**: 5 MB

4. Створіть Storage Policy:

```sql
-- Policy для публічного читання зображень
CREATE POLICY "Публічний доступ до зображень"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'products');

-- Policy для завантаження зображень (тільки авторизовані)
CREATE POLICY "Авторизовані можуть завантажувати"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'products');

-- Policy для видалення зображень (тільки авторизовані)
CREATE POLICY "Авторизовані можуть видаляти"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'products');
```

### Крок 4: Створення адмін-користувача

1. Перейдіть в розділ **Authentication** → **Users**
2. Натисніть **Add User**
3. Введіть:
   - **Email**: ваш email (наприклад, `admin@ekvity.ua`)
   - **Password**: створіть надійний пароль
   - **Auto Confirm User**: Увімкнути ✅
4. Збережіть ці дані — вони потрібні для входу в адмін-панель

### Крок 5: Отримання API ключів

1. Перейдіть в **Project Settings** → **API**
2. Скопіюйте:
   - **Project URL** (наприклад, `https://abcdefgh.supabase.co`)
   - **anon/public** ключ (довгий рядок)

### Крок 6: Налаштування коду

Відкрийте обидва файли (`app.js` та `admin.js`) і замініть:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

На ваші реальні дані:

```javascript
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Крок 7: Налаштування номера телефону

В файлі `app.js` замініть placeholder:

```javascript
const PHONE_NUMBER = '+380980488437';
```

На реальний номер (формат міжнародний):

```javascript
const PHONE_NUMBER = '+380501234567';
```

### Крок 8 (Опціонально): Додавання тестових продуктів

Якщо хочете одразу наповнити каталог тестовими даними:

```sql
INSERT INTO products (name, category, price, description) VALUES
('Букет #746', 'Букети', 2362, 'Розкішний букет з сезонних квітів'),
('Букет #745', 'Букети', 6760, 'Преміум композиція для особливих подій'),
('Троянда Атена роял 60см', 'Квіти поштучно', 100, 'Королівська троянда преміум якості'),
('Дженіста', 'Квіти поштучно', 40, 'Яскрава жовта гілочка');
```

## 💻 Локальний запуск

Для тестування на локальному комп'ютері:

```bash
# Опція 1: Python
python3 -m http.server 8000

# Опція 2: Node.js (якщо встановлено)
npx serve

# Опція 3: PHP
php -S localhost:8000
```

Потім відкрийте:
- Головна сторінка: `http://localhost:8000/index.html`
- Адмін-панель: `http://localhost:8000/admin.html`

## 🌐 Деплой

### Варіант 1: Netlify (рекомендовано)

1. Зареєструйтеся на [netlify.com](https://netlify.com)
2. Перетягніть папку `ekvity/` на сайт
3. Сайт буде доступний на `https://your-site.netlify.app`
4. Опціонально: підключіть свій домен

### Варіант 2: Vercel

1. Встановіть Vercel CLI: `npm i -g vercel`
2. В папці проекту: `vercel`
3. Слідуйте інструкціям

### Варіант 3: GitHub Pages

1. Створіть репозиторій на GitHub
2. Завантажте файли
3. В налаштуваннях репозиторію → Pages → виберіть гілку `main`
4. Сайт буде на `https://username.github.io/repo-name`

## 📱 Використання адмін-панелі

1. Відкрийте `admin.html`
2. Введіть email та пароль (створені в Supabase)
3. Додавайте, редагуйте або видаляйте продукти
4. Завантажуйте зображення (автоматично зберігаються в Supabase Storage)

### Додавання продукту:

1. Натисніть **"+ Додати продукт"**
2. Заповніть форму:
   - Назва (наприклад, "Букет #747")
   - Категорія (Букети / Квіти поштучно / Композиції)
   - Ціна в гривнях
   - Опис (опціонально)
   - Зображення (опціонально, але рекомендовано)
3. Натисніть **"Зберегти"**

## 🔒 Безпека

- ✅ Row Level Security (RLS) налаштовано
- ✅ Публічний доступ тільки на читання
- ✅ Додавання/редагування тільки для авторизованих
- ✅ API ключі безпечні для публічного використання
- ⚠️ **НЕ публікуйте** Service Role ключ (він в Supabase Settings)

## 🎨 Кастомізація дизайну

Всі кольори та шрифти в CSS змінних на початку `style.css`:

```css
:root {
    --cream: #FFF8F0;
    --sage: #A8B5A3;
    --dusty-pink: #E8C5C5;
    --terracotta: #D4A373;
    --forest: #5A6B54;
    /* ... */
}
```

Змініть ці значення для іншої колірної схеми.

## 📞 Підтримка

Якщо виникли проблеми:

1. Перевірте консоль браузера (F12 → Console)
2. Перевірте, чи правильні API ключі в `app.js` та `admin.js`
3. Перевірте, чи створено таблицю `products` в Supabase
4. Перевірте, чи увімкнено RLS policies

## 📄 Ліцензія

Цей проект створено для ІКвіти (@ekvity.ua). Всі права захищено.

---

💐 Створено з любов'ю для квіткової майстерні у Львові
