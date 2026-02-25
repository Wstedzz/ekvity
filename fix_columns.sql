-- ============================================================
-- FIX: Rename lowercase columns to proper camelCase
-- Run this ONCE in Supabase SQL Editor to fix the column casing
-- ============================================================

-- Fix categories table
ALTER TABLE public.categories RENAME COLUMN showonmain TO "showOnMain";

-- Fix products table
ALTER TABLE public.products RENAME COLUMN categoryid TO "categoryId";
