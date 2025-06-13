-- Create end_users table
CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    org_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    inserted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
); 