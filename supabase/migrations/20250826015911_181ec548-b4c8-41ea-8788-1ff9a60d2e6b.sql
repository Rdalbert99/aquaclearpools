-- Fix service_requests status constraint to allow the correct status values
-- First, let's see what status values are currently being used and what the constraint allows

-- Check existing status values
-- The error indicates a constraint violation, so we need to update the constraint

-- Drop the existing status check constraint if it exists
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- Add a proper status constraint that allows all the status values we're using
ALTER TABLE service_requests 
ADD CONSTRAINT service_requests_status_check 
CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled', 'scheduled', 'approved'));

-- Similarly, ensure priority constraint allows the values we're using
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_priority_check;

ALTER TABLE service_requests 
ADD CONSTRAINT service_requests_priority_check 
CHECK (priority IN ('low', 'medium', 'high', 'emergency'));