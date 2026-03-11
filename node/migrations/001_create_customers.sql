-- Customer Records Management Schema
-- Creates the customers table for storing customer records

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    phone       VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast name searches
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

-- Sample data
INSERT INTO customers (name, address, phone) VALUES
    ('Acme Corporation',    '123 Main St, Springfield, IL 62701',      '(217) 555-0101'),
    ('Globex Industries',   '456 Industrial Blvd, Shelbyville, TN 37160', '(931) 555-0202'),
    ('Initech Solutions',   '789 Tech Park Dr, Austin, TX 78701',      '(512) 555-0303'),
    ('Umbrella Ltd',        '321 Corporate Way, Chicago, IL 60601',    '(312) 555-0404'),
    ('Soylent Corp',        '654 Green St, Portland, OR 97201',        '(503) 555-0505')
ON CONFLICT DO NOTHING;
