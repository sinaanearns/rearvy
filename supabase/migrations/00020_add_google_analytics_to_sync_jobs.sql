-- Add google_analytics to integration_sync_jobs provider constraint
ALTER TABLE integration_sync_jobs 
  DROP CONSTRAINT IF EXISTS integration_sync_jobs_provider_check;

ALTER TABLE integration_sync_jobs 
  ADD CONSTRAINT integration_sync_jobs_provider_check 
  CHECK (provider IN ('shopify', 'youtube', 'instagram', 'google_analytics'));
