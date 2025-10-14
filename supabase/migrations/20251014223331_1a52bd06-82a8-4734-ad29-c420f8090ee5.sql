-- Standardize model name from 'Gen Peach' to 'GenPeach'
UPDATE images 
SET model_name = 'GenPeach' 
WHERE model_name = 'Gen Peach';