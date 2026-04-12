CREATE TABLE IF NOT EXISTS trade_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_time TIMESTAMP NOT NULL,
  type VARCHAR(50) CHECK (type IN ('dropoff', 'collection')),
  status VARCHAR(50) DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);