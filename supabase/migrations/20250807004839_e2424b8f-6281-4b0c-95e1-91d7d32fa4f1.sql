-- Add first_name and last_name columns to users table
ALTER TABLE public.users 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Update existing users to split the name field
UPDATE public.users 
SET 
  first_name = CASE 
    WHEN name LIKE '% %' THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name LIKE '% %' THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND last_name IS NULL;

-- Add full address validation columns
ALTER TABLE public.users
ADD COLUMN street_address text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN zip_code text,
ADD COLUMN country text DEFAULT 'US';

-- Add similar columns to service_requests for address validation
ALTER TABLE public.service_requests
ADD COLUMN street_address text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN zip_code text,
ADD COLUMN country text DEFAULT 'US';

-- Add address validation status
ALTER TABLE public.users
ADD COLUMN address_validated boolean DEFAULT false;

ALTER TABLE public.service_requests
ADD COLUMN address_validated boolean DEFAULT false;