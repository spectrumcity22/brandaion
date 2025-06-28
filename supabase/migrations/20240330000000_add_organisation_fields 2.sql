-- Add missing fields to client_organisation table
ALTER TABLE client_organisation 
ADD COLUMN IF NOT EXISTS organisation_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS industry VARCHAR(255),
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(255),
ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_organisation_industry ON client_organisation(industry);
CREATE INDEX IF NOT EXISTS idx_client_organisation_headquarters ON client_organisation(headquarters);

-- Add comment to document the changes
COMMENT ON TABLE client_organisation IS 'Updated with additional organisation fields for enhanced profile management'; 