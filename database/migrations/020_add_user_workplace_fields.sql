-- Migration 020: Add workplace and job_title fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS workplace VARCHAR(150),
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);

