-- Add unique constraint to llm_discovery_faq_objects to fix ON CONFLICT errors
-- This ensures each batch_faq_pairs_id can only have one FAQ object

-- First, check if there are any duplicate batch_faq_pairs_id entries
-- If there are duplicates, we need to handle them before adding the constraint
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT batch_faq_pairs_id, COUNT(*)
        FROM llm_discovery_faq_objects
        GROUP BY batch_faq_pairs_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate batch_faq_pairs_id entries. Removing duplicates...', duplicate_count;
        
        -- Keep only the most recent entry for each batch_faq_pairs_id
        DELETE FROM llm_discovery_faq_objects
        WHERE id NOT IN (
            SELECT DISTINCT ON (batch_faq_pairs_id) id
            FROM llm_discovery_faq_objects
            ORDER BY batch_faq_pairs_id, created_at DESC
        );
    END IF;
END $$;

-- Add the unique constraint
ALTER TABLE llm_discovery_faq_objects 
ADD CONSTRAINT llm_discovery_faq_objects_batch_faq_pairs_id_unique 
UNIQUE (batch_faq_pairs_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT llm_discovery_faq_objects_batch_faq_pairs_id_unique ON llm_discovery_faq_objects 
IS 'Ensures each batch_faq_pairs_id can only have one FAQ object, enabling upsert operations with onConflict'; 