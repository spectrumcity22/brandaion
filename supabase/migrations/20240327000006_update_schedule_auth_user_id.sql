-- Update auth_user_id in schedule table for the given rows
UPDATE "public"."schedule"
SET "auth_user_id" = '32c6bcbe-dc28-48d9-a7ed-00ccc8af51e2'
WHERE "id" IN (
  '1281f570-8822-4a9f-886a-b3527d984038',
  '1bb1928a-394e-407b-9bce-9abb5fb22d15',
  '42bd5678-cf83-4486-8231-37beb1255ccb',
  'c12a62a3-5017-4576-ad03-b9f8abfdaa8d'
); 