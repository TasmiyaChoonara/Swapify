ALTER TABLE facility_config
  ADD CONSTRAINT facility_config_day_unique UNIQUE (day_of_week);
