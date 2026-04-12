CREATE TABLE IF NOT EXISTS price_references (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category     VARCHAR(100) NOT NULL,
  item_type    VARCHAR(150) NOT NULL,
  min_price    DECIMAL(10,2) NOT NULL,
  median_price DECIMAL(10,2) NOT NULL,
  max_price    DECIMAL(10,2) NOT NULL,
  currency     CHAR(3)      NOT NULL DEFAULT 'ZAR',
  source       TEXT,
  last_updated TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE (category, item_type)
);

-- Index for the common query pattern: look up by category
CREATE INDEX IF NOT EXISTS idx_price_references_category ON price_references (category);
