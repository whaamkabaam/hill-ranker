-- Remove public access to allowed_users table to prevent email harvesting
DROP POLICY IF EXISTS "Anyone can check if email is allowed" ON public.allowed_users;

-- The is_email_allowed() function with SECURITY DEFINER will handle validation
-- during signup via the handle_new_user() trigger, maintaining security without
-- exposing the email list to public queries