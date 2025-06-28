# AI Request Organisation Context Removal

## Problem Identified

The `ai_request_for_questions` field in the `construct_faq_pairs` table currently includes an `organisationContext` field that contains organization JSON-LD data. You want to remove this field from the AI request.

## How the Field is Produced

**Answer: SQL Function (Database Trigger)**

The `ai_request_for_questions` field is automatically populated by a **SQL function** called `format_ai_request()` which is triggered automatically when records are inserted into the `construct_faq_pairs` table.

### Location of the Function
- **File**: `supabase/schema.sql` (lines 194-220)
- **Function Name**: `public.format_ai_request()`
- **Trigger**: `format_ai_request_trigger` on `construct_faq_pairs` table

### Current Function Logic
The function:
1. Retrieves client configuration data from the `client_configuration` table
2. Builds a JSON string with various fields including `organisationContext`
3. Sets `NEW.ai_request_for_questions` to this JSON string

## Files Created for Backup and Fix

### 1. Backup File: `backup_format_ai_request_function.sql`
- Contains a backup of the current function logic
- Function name: `format_ai_request_backup()` (not triggered)
- For reference only

### 2. Fix File: `remove_organisation_from_ai_request.sql`
- Modified version of the function that removes `organisationContext`
- Updates the existing `format_ai_request()` function
- The trigger automatically uses the updated function

### 3. Cleanup File: `update_existing_ai_requests_remove_organisation.sql`
- Updates existing records that already have `organisationContext`
- Uses regex to remove the field from existing JSON data
- Includes verification queries

## Changes Made

### Before (Current)
```json
{
  "batchDispatchDate": "10/07/2025",
  "batchNo": "2b4f3e9f-3d2d-49ad-ae22-b664f87a00f1",
  "uniqueBatchId": "ed010b66-0ddc-4744-8f1d-8f2bccf3a5cd",
  "faqCountInBatch": 5,
  "email": "rickychopra@me.com",
  "brand": "Brandaion",
  "industry": "United Kingdom",
  "subCategory": "FAQ Pairs",
  "audience": "CMO & VP Of Marketing",
  "brandContext": {...},
  "productContext": {...},
  "organisationContext": {...}  // ← This will be removed
}
```

### After (Modified)
```json
{
  "batchDispatchDate": "10/07/2025",
  "batchNo": "2b4f3e9f-3d2d-49ad-ae22-b664f87a00f1",
  "uniqueBatchId": "ed010b66-0ddc-4744-8f1d-8f2bccf3a5cd",
  "faqCountInBatch": 5,
  "email": "rickychopra@me.com",
  "brand": "Brandaion",
  "industry": "United Kingdom",
  "subCategory": "FAQ Pairs",
  "audience": "CMO & VP Of Marketing",
  "brandContext": {...},
  "productContext": {...}
  // organisationContext removed
}
```

## Implementation Steps

1. **Run the backup script** (optional but recommended):
   ```sql
   -- Execute: backup_format_ai_request_function.sql
   ```

2. **Update the function**:
   ```sql
   -- Execute: remove_organisation_from_ai_request.sql
   ```

3. **Clean up existing records**:
   ```sql
   -- Execute: update_existing_ai_requests_remove_organisation.sql
   ```

## Verification

After running the scripts, verify:
- New records inserted into `construct_faq_pairs` will not have `organisationContext`
- Existing records have been cleaned up
- The function is working correctly

## Notes

- The trigger will automatically use the updated function
- No need to recreate the trigger
- The change affects all future insertions into the table
- Existing records are cleaned up by the separate script 