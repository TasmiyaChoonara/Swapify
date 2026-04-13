CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  cash_shortfall DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);