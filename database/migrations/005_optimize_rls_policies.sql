-- Fix auth RLS initialization plan warnings by using (select auth.role()) instead of auth.role()
-- and consolidate multiple permissive policies into single policies

-- Reset policies for navigation table
DROP POLICY IF EXISTS "Allow service role and public access" ON "public"."navigation";
DROP POLICY IF EXISTS "Allow service role full access" ON "public"."navigation";

CREATE POLICY "navigation_access_policy" ON "public"."navigation"
AS PERMISSIVE FOR ALL
TO public
USING (
  (select auth.role()) = 'authenticated' 
  OR (select auth.role()) = 'anon'
  OR (select auth.role()) = 'service_role'
)
WITH CHECK (
  (select auth.role()) = 'service_role'
);

-- Reset policies for category table
DROP POLICY IF EXISTS "Allow service role and public access" ON "public"."category";
DROP POLICY IF EXISTS "Allow service role full access" ON "public"."category";

CREATE POLICY "category_access_policy" ON "public"."category"
AS PERMISSIVE FOR ALL
TO public
USING (
  (select auth.role()) = 'authenticated' 
  OR (select auth.role()) = 'anon'
  OR (select auth.role()) = 'service_role'
)
WITH CHECK (
  (select auth.role()) = 'service_role'
);

-- Reset policies for product table
DROP POLICY IF EXISTS "Allow service role and public access" ON "public"."product";
DROP POLICY IF EXISTS "Allow service role full access" ON "public"."product";

CREATE POLICY "product_access_policy" ON "public"."product"
AS PERMISSIVE FOR ALL
TO public
USING (
  (select auth.role()) = 'authenticated' 
  OR (select auth.role()) = 'anon'
  OR (select auth.role()) = 'service_role'
)
WITH CHECK (
  (select auth.role()) = 'service_role'
);

-- Reset policies for scrape_job table
DROP POLICY IF EXISTS "Allow service role full access" ON "public"."scrape_job";
DROP POLICY IF EXISTS "Service role access" ON "public"."scrape_job";

CREATE POLICY "scrape_job_access_policy" ON "public"."scrape_job"
AS PERMISSIVE FOR ALL
TO public
USING (
  (select auth.role()) = 'service_role'
)
WITH CHECK (
  (select auth.role()) = 'service_role'
);