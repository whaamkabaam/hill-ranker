-- Add columns to track image swapping in rankings
ALTER TABLE rankings 
ADD COLUMN swapped_images_count integer DEFAULT 0,
ADD COLUMN swapped_image_ids text[] DEFAULT '{}';

COMMENT ON COLUMN rankings.swapped_images_count IS 'Number of times user swapped an image from outside top 3';
COMMENT ON COLUMN rankings.swapped_image_ids IS 'Array of image IDs that were swapped into the ranking';