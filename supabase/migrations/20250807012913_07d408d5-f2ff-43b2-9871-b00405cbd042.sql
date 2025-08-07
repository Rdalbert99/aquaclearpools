-- Create storage bucket for pool images
INSERT INTO storage.buckets (id, name, public) VALUES ('pool-images', 'pool-images', true);

-- Create RLS policies for pool images
CREATE POLICY "Pool images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'pool-images');

CREATE POLICY "Techs and admins can upload pool images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'pool-images' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Techs and admins can update pool images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'pool-images' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Techs and admins can delete pool images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'pool-images' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

-- Add pool_image_url column to clients table
ALTER TABLE clients ADD COLUMN pool_image_url TEXT;

-- Add pool_image_uploaded_at to track when image was last updated
ALTER TABLE clients ADD COLUMN pool_image_uploaded_at TIMESTAMP WITH TIME ZONE;