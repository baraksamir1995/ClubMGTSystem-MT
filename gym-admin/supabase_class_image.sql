-- Add image_url column to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS image_url text;
