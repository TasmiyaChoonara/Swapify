ALTER TABLE facility_config
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
