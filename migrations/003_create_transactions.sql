CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_listing_id UUID REFERENCES listings(id),
  type VARCHAR(50) CHECK (type IN ('sale', 'trade')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'complete', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);