# Lessons Learned - BrandAION Project

## Session/Authentication Issues

### What DIDN'T Work

1. **Manual Session Handling in Ask Question Function**
   - Problem: Trying to manually get session with `supabase.auth.getSession()` in button click handlers
   - Result: "No active session" errors even when user is logged in
   - Lesson: Don't manually handle sessions in button click functions when the page already works

2. **Changing Supabase Client Import**
   - Problem: Changed from `import { supabase } from '@/lib/supabase'` to `createBrowserClient` from `@supabase/ssr`
   - Result: Broke existing working authentication on review questions page
   - Lesson: If a page is already working with authentication, don't change the client setup

3. **Complex Session Retrieval in Button Handlers**
   - Problem: Added `getUser()` then `getSession()` in `handleAskQuestion` function
   - Result: "No authenticated user found" errors
   - Lesson: Keep button handlers simple - if the page loads and other buttons work, don't add complex auth logic

### What DOES Work

1. **Direct Supabase Client Calls**
   - Pattern: `supabase.from('table').update()` calls work fine
   - Example: Approve buttons work without manual session handling
   - Lesson: Use the existing working patterns

2. **Existing Authentication Setup**
   - Pattern: Pages that load successfully with `import { supabase } from '@/lib/supabase'`
   - Result: Login persists, approve buttons work
   - Lesson: Don't fix what isn't broken

## Edge Function Issues

### What DIDN'T Work

1. **Wrong Function Names**
   - Problem: Called `process-stripe-webhook` instead of `ai_request_answers`
   - Result: 400 Bad Request errors
   - Lesson: Always verify the correct endpoint name

2. **Missing Authorization Headers**
   - Problem: Not including proper headers in fetch requests
   - Result: 401 Unauthorized errors
   - Lesson: Include all required headers: Authorization, x-client-info, apikey

## Development Process Issues

### What DIDN'T Work

1. **Making Multiple Changes at Once**
   - Problem: Changed session handling AND function calls simultaneously
   - Result: Hard to isolate which change broke what
   - Lesson: Make one change at a time, test, then make the next change

2. **Not Testing Incrementally**
   - Problem: Added complex functionality without testing basic functionality first
   - Result: Broke working features while trying to add new ones
   - Lesson: Test each small change before proceeding

3. **Ignoring Working Patterns**
   - Problem: Didn't follow the same patterns as working functions
   - Result: Inconsistent behavior and errors
   - Lesson: Study and replicate working code patterns

## Current Working State

- **Restore Point**: `c726faf` - "RESTORE POINT: Enhanced review questions page working"
- **What Works**: Login, review questions page, approve buttons, batch grouping
- **What Needs**: Individual "Ask Question" buttons for approved questions

## Next Steps (When Ready)

1. **Study Working Patterns**: Look at how `client_configuration_form` calls edge functions
2. **Make Minimal Changes**: Add only the Ask Question button functionality
3. **Test Incrementally**: Test each small change before proceeding
4. **Don't Touch Session**: Leave authentication handling alone since it works

## Key Principles

1. **If it works, don't change it**
2. **One change at a time**
3. **Test incrementally**
4. **Follow existing patterns**
5. **Keep it simple** 