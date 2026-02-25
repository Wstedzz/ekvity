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
