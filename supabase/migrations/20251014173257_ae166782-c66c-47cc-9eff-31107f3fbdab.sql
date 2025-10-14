-- Phase 5: Add column to track user modifications
ALTER TABLE rankings 
ADD COLUMN user_modified_order boolean DEFAULT false;

COMMENT ON COLUMN rankings.user_modified_order IS 'Whether user manually reordered the algorithm suggestions';