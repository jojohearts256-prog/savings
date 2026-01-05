-- Migration: system settings (admin-configurable)
-- Date: 2026-01-05

-- A single-row settings table for global configuration.
-- Keep it permissive by schema, but protect with RLS/policies in Supabase.

CREATE TABLE IF NOT EXISTS public.system_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- loan penalties
  penalties_enabled boolean NOT NULL DEFAULT false,
  penalty_grace_days integer NOT NULL DEFAULT 0,
  penalty_type text NOT NULL DEFAULT 'fixed' CHECK (penalty_type in ('fixed', 'percent')),
  penalty_value numeric NOT NULL DEFAULT 0,

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure there's always exactly one row.
-- This pattern: force id=1 and unique constraint.
INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
