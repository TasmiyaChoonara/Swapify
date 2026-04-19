CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  condition VARCHAR(50) CHECK (condition IN ('new', 'good', 'fair')),
  type VARCHAR(50) CHECK (type IN ('sale', 'trade', 'both')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);