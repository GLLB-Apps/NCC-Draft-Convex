ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS background_blocks jsonb NOT NULL DEFAULT '[]';
