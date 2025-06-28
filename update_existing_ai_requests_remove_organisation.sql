-- Update existing records to remove organisationContext from ai_request_for_questions
-- This script will clean up existing records that already have organisationContext

-- First, let's see how many records have organisationContext
SELECT 
    'Records with organisationContext' as check_type,
    COUNT(*) as count,
    'Records that need to be updated' as description
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
  AND ai_request_for_questions LIKE '%organisationContext%';

-- Show a sample of what we're working with
SELECT 
    'Sample Records' as check_type,
    id,
    LEFT(ai_request_for_questions, 200) as ai_request_preview
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
  AND ai_request_for_questions LIKE '%organisationContext%'
LIMIT 3;

-- Update existing records to remove organisationContext
UPDATE construct_faq_pairs 
SET ai_request_for_questions = (
    -- Remove the organisationContext field and its trailing comma
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            ai_request_for_questions,
            ',"organisationContext":[^}]*',  -- Remove the field and its value
            ''
        ),
        ',"organisationContext":null',       -- Remove the field if it's null
        ''
    )
)
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
  AND ai_request_for_questions LIKE '%organisationContext%';

-- Verify the update worked
SELECT 
    'Update Verification' as check_type,
    COUNT(*) as remaining_records_with_organisation,
    'Should be 0 if update was successful' as description
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
  AND ai_request_for_questions LIKE '%organisationContext%';

-- Show updated sample
SELECT 
    'Updated Sample' as check_type,
    id,
    LEFT(ai_request_for_questions, 200) as ai_request_preview
FROM construct_faq_pairs 
WHERE ai_request_for_questions IS NOT NULL 
  AND ai_request_for_questions != ''
LIMIT 3; 