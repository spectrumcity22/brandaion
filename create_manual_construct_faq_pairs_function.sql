-- Create a manual function to create construct_faq_pairs records
-- This will be called when the user clicks "Next" to confirm the schedule

CREATE OR REPLACE FUNCTION create_construct_faq_pairs_from_schedule(schedule_id uuid)
RETURNS void AS $$
DECLARE
    schedule_record RECORD;
    org_record RECORD;
    product_record RECORD;
    persona_record RECORD;
    audience_record RECORD;
    brand_record RECORD;
    batch_dates text[] := ARRAY['batch_1_date', 'batch_2_date', 'batch_3_date', 'batch_4_date'];
    batch_date text;
    batch_count integer := 1;
BEGIN
    -- Get schedule details
    SELECT * INTO schedule_record 
    FROM schedules 
    WHERE id = schedule_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule not found with ID: %', schedule_id;
    END IF;
    
    -- Get organisation details
    SELECT * INTO org_record 
    FROM client_organisation 
    WHERE auth_user_id = schedule_record.auth_user_id;
    
    -- Get product details
    SELECT * INTO product_record 
    FROM client_products 
    WHERE auth_user_id = schedule_record.auth_user_id;
    
    -- Get persona details
    SELECT * INTO persona_record 
    FROM client_product_persona 
    WHERE auth_user_id = schedule_record.auth_user_id;
    
    -- Get audience details
    SELECT * INTO audience_record 
    FROM audiences 
    WHERE auth_user_id = schedule_record.auth_user_id;
    
    -- Get brand details
    SELECT * INTO brand_record 
    FROM client_brands 
    WHERE auth_user_id = schedule_record.auth_user_id;
    
    -- Create construct_faq_pairs records for each batch
    FOREACH batch_date IN ARRAY batch_dates
    LOOP
        -- Get the actual date value from the schedule
        EXECUTE format('SELECT %I FROM schedules WHERE id = $1', batch_date) 
        INTO batch_date USING schedule_id;
        
        IF batch_date IS NOT NULL THEN
            INSERT INTO construct_faq_pairs (
                unique_batch_cluster,
                unique_batch_id,
                batch_date,
                batch_faq_pairs,
                total_faq_pairs,
                organisation,
                user_email,
                auth_user_id,
                organisation_id,
                product_name,
                persona_name,
                audience_name,
                market_name,
                brand_jsonld_object,
                product_jsonld_object,
                persona_jsonld,
                organisation_jsonld_object,
                question_status
            ) VALUES (
                gen_random_uuid()::text, -- unique_batch_cluster
                gen_random_uuid()::text, -- unique_batch_id
                batch_date::date, -- batch_date
                schedule_record.faq_per_batch, -- batch_faq_pairs
                schedule_record.faq_pairs_pm, -- total_faq_pairs
                COALESCE(org_record.organisation, 'Default Organisation'), -- organisation
                schedule_record.user_email, -- user_email (if available)
                schedule_record.auth_user_id, -- auth_user_id
                COALESCE(org_record.id, gen_random_uuid()), -- organisation_id
                COALESCE(product_record.product_name, 'Default Product'), -- product_name
                COALESCE(persona_record.persona_name, 'Default Persona'), -- persona_name
                COALESCE(audience_record.audience_name, 'Default Audience'), -- audience_name
                'Default Market', -- market_name
                COALESCE(brand_record.brand_jsonld_object, '{}'), -- brand_jsonld_object
                COALESCE(product_record.product_jsonld_object, '{}'), -- product_jsonld_object
                COALESCE(persona_record.persona_jsonld, '{}'), -- persona_jsonld
                COALESCE(org_record.organisation_jsonld_object, '{}'), -- organisation_jsonld_object
                'pending' -- question_status
            );
            
            batch_count := batch_count + 1;
        END IF;
    END LOOP;
    
    -- Update schedule status to indicate construct_faq_pairs have been created
    UPDATE schedules 
    SET status = 'construct_faq_pairs_created'
    WHERE id = schedule_id;
    
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_construct_faq_pairs_from_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_construct_faq_pairs_from_schedule(uuid) TO service_role; 