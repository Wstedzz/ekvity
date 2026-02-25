-- Supabase Initialization Script for Ekvity Catalog

-- 1. Create a public storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'images' bucket
-- Allow public access to read the images bucket
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'images');

-- Allow ONLY authenticated (admin) users to upload, update, or delete images
CREATE POLICY "Admin Insert Access" 
ON storage.objects FOR INSERT 
TO authenticated WITH CHECK (bucket_id = 'images');

CREATE POLICY "Admin Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated USING (bucket_id = 'images');

CREATE POLICY "Admin Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated USING (bucket_id = 'images');

-- 2. Create tables
CREATE TABLE IF NOT EXISTS public.categories (
    id text PRIMARY KEY,
    name text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    showOnMain boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.products (
    id text PRIMARY KEY,
    name text NOT NULL,
    categoryId text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    image text,
    topViewImage text,
    "desc" text,
    featured boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.constructor_flowers (
    id text PRIMARY KEY,
    name text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    image text
);

CREATE TABLE IF NOT EXISTS public.site_settings (
    key text PRIMARY KEY,
    value text
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id text PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    title text NOT NULL,
    description text,
    content text,
    image text,
    meta text,
    published boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id text PRIMARY KEY,
    author_name text NOT NULL,
    author_initial text,
    rating integer NOT NULL DEFAULT 5,
    text text NOT NULL,
    source text DEFAULT 'Google Maps',
    visible boolean NOT NULL DEFAULT true,
    "order" integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constructor_flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Public Read (anon + authenticated)
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public Read Constructor Flowers" ON public.constructor_flowers FOR SELECT USING (true);
CREATE POLICY "Public Read Site Settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Blog Posts" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Public Read Reviews" ON public.reviews FOR SELECT USING (true);

-- 5. Create Policies for Admin Edit (authenticated ONLY)
CREATE POLICY "Admin Insert Categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Categories" ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Categories" ON public.categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin Insert Products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Products" ON public.products FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin Insert Constructor Flowers" ON public.constructor_flowers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Constructor Flowers" ON public.constructor_flowers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Constructor Flowers" ON public.constructor_flowers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin Insert Site Settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Site Settings" ON public.site_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Site Settings" ON public.site_settings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin Insert Blog Posts" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Blog Posts" ON public.blog_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Blog Posts" ON public.blog_posts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Admin Insert Reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Update Reviews" ON public.reviews FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Reviews" ON public.reviews FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6. SEED DATA — populate with existing site content
-- ============================================================

-- Categories
INSERT INTO public.categories (id, name, "order", showOnMain) VALUES
    ('cat-1', 'Букети',          0, true),
    ('cat-2', 'Квіти поштучно',  1, true),
    ('cat-3', 'Композиції',      2, true)
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO public.products (id, name, categoryId, price, image, "desc", featured) VALUES
    ('EKV-001', 'Тюльпани мікс',          'cat-1', 2800, 'images/prod-bouquet1.jpg', 'Три кольори, три настрої. Букет у фірмовому пакуванні.',               true),
    ('EKV-002', 'Бордові тюльпани',        'cat-1', 2600, 'images/prod-bouquet3.jpg', 'Темно-бордові, насичені. 101 шт.',                                    true),
    ('EKV-003', 'Піоновидні рожеві',       'cat-1', 4800, 'images/prod-bouquet4.jpg', 'Розкішні піоновидні тюльпани, 101 шт.',                                false),
    ('EKV-004', 'Рожеві троянди',          'cat-1', 5200, 'images/prod-bouquet6.jpg', 'Кущові рожеві троянди. Пишний букет.',                                false),
    ('EKV-005', 'Білі троянди',            'cat-1', 4900, 'images/prod-bouquet7.jpg', 'Кремово-білі піоновидні троянди.',                                    false),
    ('EKV-006', 'Пудрові троянди',         'cat-1', 4600, 'images/prod-bouquet8.jpg', 'Пудровий відтінок, ніжна текстура. 101 шт.',                          false),
    ('EKV-010', 'Тюльпан поштучно',        'cat-2',   55, 'images/prod-bouquet3.jpg', 'Одне стебло, 60 см.',                                                true),
    ('EKV-011', 'Піоновидний тюльпан',     'cat-2',   80, 'images/prod-bouquet4.jpg', 'Піоновидний тюльпан, преміум.',                                       false),
    ('EKV-012', 'Троянда кущова',          'cat-2',   90, 'images/prod-bouquet6.jpg', 'Кущова троянда, гілка.',                                              false),
    ('EKV-013', 'Піоновидна троянда',      'cat-2',  110, 'images/prod-bouquet8.jpg', 'Одна піоновидна троянда.',                                            false),
    ('EKV-020', 'Кошик з тюльпанів',       'cat-3', 4500, 'images/hero-5.jpg',        'Плетений кошик, 51 тюльпан, стрічка.',                                true),
    ('EKV-021', 'Кошик преміум',           'cat-3', 8500, 'images/hero-4.jpg',        'Великий кошик 101 троянд з персоналізацією.',                          false)
ON CONFLICT (id) DO NOTHING;

-- Blog posts (all 20 articles that were previously hardcoded)
INSERT INTO public.blog_posts (id, slug, title, description, image, meta, published, created_at) VALUES
    ('blog-seed-01', 'tulpany-lviv',              'Тюльпани у Львові: як обрати свіжий букет і зберегти його довше',         'Як відрізнити свіжі тюльпани, які сорти найдовше стоять та як доглядати за букетом.',                  'images/prod-bouquet3.jpg', 'Тюльпани · Лютий 2026 · 5 хв',       true, '2026-02-01T10:00:00Z'),
    ('blog-seed-02', 'troyandy-lviv',             'Троянди у Львові: де купити свіжі та як обрати сорт',                     'Де купити свіжі троянди, які сорти найдовше стоять та як відрізнити якісний букет.',                   'images/prod-bouquet1.jpg', 'Троянди · Лютий 2026 · 6 хв',        true, '2026-02-02T10:00:00Z'),
    ('blog-seed-03', 'kvity-na-den-narodzhennya', 'Квіти на день народження: що подарувати у 2025',                          'Тренди, ідеї та поради — які квіти обрати для особливого подарунка.',                                  'images/prod-bouquet2.jpg', 'День народження · Лютий 2026 · 5 хв', true, '2026-02-03T10:00:00Z'),
    ('blog-seed-04', 'bukety-na-vesillya-lviv',   'Весільні букети у Львові: тренди та ціни 2025',                           'Весільні букети 2025: стилі, ціни та як замовити букет нареченої у Львові.',                           'images/prod-bouquet4.jpg', 'Весілля · Лютий 2026 · 7 хв',        true, '2026-02-04T10:00:00Z'),
    ('blog-seed-05', 'kvity-na-8-bereznya-lviv',  'Квіти на 8 березня у Львові: де замовити заздалегідь',                    'Як не залишитися без квітів у пік попиту — тюльпани, мімоза, троянди.',                                'images/prod-bouquet5.jpg', '8 березня · Лютий 2026 · 4 хв',      true, '2026-02-05T10:00:00Z'),
    ('blog-seed-06', 'pivonii-lviv',              'Півонії у Львові: сезон, ціни та найкращі букети',                        'Коли купити, скільки коштують та як зберегти букет з півоній.',                                        'images/prod-bouquet6.jpg', 'Півонії · Лютий 2026 · 5 хв',        true, '2026-02-06T10:00:00Z'),
    ('blog-seed-07', 'avtorski-bukety-lviv',      'Авторські букети у Львові: що це і скільки коштує',                       'Чим відрізняється авторський букет від звичайного та як замовити у ЄКвіти.',                           'images/prod-bouquet7.jpg', 'Флористика · Лютий 2026 · 5 хв',     true, '2026-02-07T10:00:00Z'),
    ('blog-seed-08', 'yak-zberehty-buket-dovshe', 'Як зберегти букет довше: 10 порад флориста',                              '10 практичних порад від флористів ЄКвіти — від підрізки до температури.',                              'images/hero-4.jpg',        'Догляд · Лютий 2026 · 5 хв',         true, '2026-02-08T10:00:00Z'),
    ('blog-seed-09', 'monobuket-lviv',            'Монобукет: тренд чи класика? Де замовити у Львові',                       'Монобукет з тюльпанів, троянд або піоній — сміливо та сучасно.',                                      'images/prod-bouquet1.jpg', 'Тренди · Лютий 2026 · 4 хв',         true, '2026-02-09T10:00:00Z'),
    ('blog-seed-10', 'kvity-dlya-kohanoi',        'Квіти для коханої: що обрати і як здивувати',                              'Романтичні варіанти та як організувати сюрприз з квітами у Львові.',                                   'images/prod-bouquet2.jpg', 'Романтика · Лютий 2026 · 5 хв',      true, '2026-02-10T10:00:00Z'),
    ('blog-seed-11', 'kvity-dlya-mamy',           'Які квіти подарувати мамі: поради флориста',                               'Класика та сучасні ідеї — як обрати ідеальний букет для мами.',                                        'images/hero-3.jpg',        'Для мами · Лютий 2026 · 5 хв',       true, '2026-02-11T10:00:00Z'),
    ('blog-seed-12', 'bili-kvity-buket',          'Білі квіти для букету: символіка та кращі поєднання',                     'Все про білу флористику — значення, найкращі квіти та поєднання.',                                    'images/hero-1.jpg',        'Флористика · Лютий 2026 · 5 хв',     true, '2026-02-12T10:00:00Z'),
    ('blog-seed-13', 'ranunkulus-lviv',           'Ранункулюс у Львові: де купити і як доглядати',                            'Найніжніша весняна квітка — сезон, кольори та догляд у вазі.',                                        'images/prod-bouquet5.jpg', 'Ранункулюс · Лютий 2026 · 5 хв',     true, '2026-02-13T10:00:00Z'),
    ('blog-seed-14', 'orkhideyi-lviv',            'Орхідеї у Львові: купити, доглядати, дарувати',                            'Все про орхідеї — сорти, догляд та де купити у Львові.',                                               'images/prod-bouquet6.jpg', 'Орхідеї · Лютий 2026 · 6 хв',        true, '2026-02-14T10:00:00Z'),
    ('blog-seed-15', 'sukhi-kvity-kompozytsiyi',  'Сухоцвіти та сухі квіти: сучасні композиції',                              'Памас-трава, лаванда, бавовна — тренд який не в''яне.',                                               'images/prod-bouquet3.jpg', 'Сухоцвіти · Лютий 2026 · 5 хв',      true, '2026-02-15T10:00:00Z'),
    ('blog-seed-16', 'kvity-na-vypusknyi-lviv',   'Квіти на випускний у Львові: ідеї та ціни',                                'Які квіти купити вчителям та випускникам — ідеї та бюджети.',                                          'images/hero-5.jpg',        'Випускний · Лютий 2026 · 4 хв',      true, '2026-02-16T10:00:00Z'),
    ('blog-seed-17', 'kvity-korporatyvni-lviv',   'Корпоративні квіти у Львові: оформлення офісу та подій',                   'Регулярна підписка, оформлення заходів та корпоративні подарунки.',                                    'images/prod-bouquet4.jpg', 'Корпоративне · Лютий 2026 · 4 хв',   true, '2026-02-17T10:00:00Z'),
    ('blog-seed-18', 'kvity-lviv-nedorogo',       'Квіти у Львові недорого: гарний букет за розумну ціну',                    'Які квіти виглядають дорого але коштують недорого — поради для економних.',                             'images/prod-bouquet8.jpg', 'Бюджет · Лютий 2026 · 4 хв',         true, '2026-02-18T10:00:00Z'),
    ('blog-seed-19', 'litni-kvity-lviv',          'Літні квіти у Львові: соняшники, далії, цинії',                            'Найкращі літні квіти та ідеї для яскравих сезонних букетів.',                                         'images/prod-bouquet7.jpg', 'Літо · Лютий 2026 · 5 хв',           true, '2026-02-19T10:00:00Z'),
    ('blog-seed-20', 'yak-vybrats-floryst-lviv',  'Як обрати флориста у Львові: на що звернути увагу',                        'Портфоліо, свіжість квітів, відгуки — чек-лист для правильного вибору.',                               'images/prod-bouquet8.jpg', 'Поради · Лютий 2026 · 5 хв',         true, '2026-02-20T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Reviews (4 reviews from the homepage)
INSERT INTO public.reviews (id, author_name, author_initial, rating, text, source, visible, "order") VALUES
    ('rev-seed-01', 'Марія Т.',  'М', 5, 'Замовляла букет на день народження подруги. Флористи підібрали ідеальне поєднання — все виглядало краще, ніж на фото. Дуже задоволена!',                          'Google Maps', true, 0),
    ('rev-seed-02', 'Оксана В.', 'О', 5, 'Написала у Telegram о 10 ранку — о 11:30 вже забирала готовий букет. Троянди свіжі, упаковка елегантна. Це вже не перше замовлення і не останнє.',               'Google Maps', true, 1),
    ('rev-seed-03', 'Андрій К.', 'А', 5, 'Шукав щось особливе для дружини — хлопці допомогли зі складанням авторського букету. Результат приголомшливий. Дружина в захваті, я теж!',                      'Google Maps', true, 2),
    ('rev-seed-04', 'Софія Р.',  'С', 5, 'Найкраща квіткова майстерня у Львові. Стиль, якість, швидкість — все на рівні. Рекомендую всім хто цінує красу.',                                              'Google Maps', true, 3)
ON CONFLICT (id) DO NOTHING;
