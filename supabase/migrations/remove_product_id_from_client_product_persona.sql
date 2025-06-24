ALTER TABLE client_product_persona DROP COLUMN IF EXISTS product_id;
-- If there is a foreign key constraint, drop it as well (Postgres auto-drops with column) 