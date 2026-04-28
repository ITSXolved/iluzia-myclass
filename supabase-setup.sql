-- ============================================
-- Iluzia My Class - Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  subscription_expires_at timestamptz,
  class_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add username column if upgrading an existing table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Helper: check admin role WITHOUT triggering RLS
-- SECURITY DEFINER runs as the function owner (bypasses RLS),
-- so calling this from inside a policy causes NO recursion.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. RLS Policies

-- Drop old recursive policies if they exist
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert for authenticated users (for profile creation during signup)
CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admin can read all profiles (uses helper — no recursion)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- Admin can update all profiles (uses helper — no recursion)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

-- Service role can do everything (for API routes using service role key)
CREATE POLICY IF NOT EXISTS "Service role full access"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Auto-create profile on signup (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, email, phone, role, class_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', NULL),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    (new.raw_user_meta_data->>'class_id')::integer
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 7. Create your first admin user
-- After running this migration:
-- 1. Go to Supabase Auth > Users > Add User
--    Use email: youradminusername@iluzia.myclass
-- 2. Run the SQL below to set their role and username:
-- ============================================

-- UPDATE public.profiles
-- SET role = 'admin', username = 'admin'
-- WHERE email = 'admin@iluzia.myclass';
