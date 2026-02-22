-- Supabase Initialization Script for Ekvity Catalog

-- 1. Create a public storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read the images bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');

-- Allow authenticated (and anon, since we use anon for now) to upload
CREATE POLICY "Anon Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');

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

-- 3. Turn off RLS temporarily for easy prototyping (WARNING: In production, configure proper RLS rules!)
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.constructor_flowers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings DISABLE ROW LEVEL SECURITY;
