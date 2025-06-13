# Patch Auth IDs Edge Function

This Edge Function patches missing `auth_user_id` values in the `invoices` table by looking up the corresponding `end_users` record by email.

## Deployment

```bash
supabase functions deploy patch_auth_ids
```

## Usage

Call the function to patch any invoices with missing auth_user_id:

```bash
curl -i --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/patch_auth_ids' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

## Response

The function returns a JSON object with:

```json
{
  "patched": 1,    // Number of successfully patched invoices
  "skipped": 0,    // Number of invoices that couldn't be patched
  "errors": []     // Array of any errors encountered
}
```

## Error Handling

Errors are collected and returned in the response, rather than failing the entire operation. Each error includes:

- `invoice_id`: The ID of the invoice that failed
- `step`: Where the error occurred ("lookup_end_user" or "set_auth_user_id")
- `error`: The error message

## Notes

- Only processes invoices where `auth_user_id` is NULL
- Matches on exact email address in `end_users` table
- Updates are performed one at a time to ensure accuracy
- Requires service role key for database access 