
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    trade_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    buyer_id VARCHAR(255) NOT NULL,
    seller_id VARCHAR(255) NOT NULL,
    slot_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'booked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent double booking of same slot
CREATE UNIQUE INDEX IF NOT EXISTS unique_slot_booking
ON bookings (slot_time);