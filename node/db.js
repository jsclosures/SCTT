'use strict';

/**
 * PostgreSQL database connection module.
 *
 * Configuration is read from environment variables:
 *   DB_HOST     - default: localhost
 *   DB_PORT     - default: 5432
 *   DB_NAME     - default: sctt
 *   DB_USER     - default: sctt
 *   DB_PASSWORD - default: (empty)
 *
 * When the database is unavailable the module falls back to a small set of
 * in-memory sample records so the application remains usable without a
 * running PostgreSQL instance.
 */

const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'sctt',
    user:     process.env.DB_USER     || 'sctt',
    password: process.env.DB_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

pool.on('error', function (err) {
    console.error('Unexpected PostgreSQL client error', err);
});

/* In-memory fallback used when the database is unavailable. */
const FALLBACK_CUSTOMERS = [
    { id: 1, name: 'Acme Corporation',  address: '123 Main St, Springfield, IL 62701',         phone: '(217) 555-0101', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'Globex Industries', address: '456 Industrial Blvd, Shelbyville, TN 37160',  phone: '(931) 555-0202', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: 'Initech Solutions', address: '789 Tech Park Dr, Austin, TX 78701',          phone: '(512) 555-0303', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: 'Umbrella Ltd',      address: '321 Corporate Way, Chicago, IL 60601',        phone: '(312) 555-0404', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 5, name: 'Soylent Corp',      address: '654 Green St, Portland, OR 97201',            phone: '(503) 555-0505', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

let dbAvailable = false;

async function checkConnection() {
    try {
        const client = await pool.connect();
        client.release();
        dbAvailable = true;
    } catch (err) {
        console.warn('PostgreSQL not available, using in-memory fallback:', err.message);
        dbAvailable = false;
    }
}

checkConnection();

/**
 * Execute a parameterised query against PostgreSQL.
 * Rejects with an error when the database is unavailable.
 *
 * @param {string} text  - SQL statement with $1, $2 … placeholders
 * @param {Array}  params - parameter values
 */
async function query(text, params) {
    if (!dbAvailable) {
        throw new Error('Database not available');
    }
    const result = await pool.query(text, params);
    return result;
}

/**
 * Return all customer records.
 * Falls back to FALLBACK_CUSTOMERS when PostgreSQL is unreachable.
 */
async function listCustomers() {
    try {
        const result = await query(
            'SELECT id, name, address, phone, created_at, updated_at FROM customers ORDER BY name ASC',
            []
        );
        return result.rows;
    } catch (err) {
        console.warn('listCustomers falling back to sample data:', err.message);
        return FALLBACK_CUSTOMERS;
    }
}

/**
 * Return a single customer by ID.
 * Falls back to FALLBACK_CUSTOMERS when PostgreSQL is unreachable.
 *
 * @param {number} id
 */
async function getCustomer(id) {
    try {
        const result = await query(
            'SELECT id, name, address, phone, created_at, updated_at FROM customers WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.warn('getCustomer falling back to sample data:', err.message);
        return FALLBACK_CUSTOMERS.find(function (c) { return c.id === id; }) || null;
    }
}

/**
 * Create a new customer record.
 *
 * @param {string} name
 * @param {string} address
 * @param {string} phone
 */
async function createCustomer(name, address, phone) {
    const result = await query(
        'INSERT INTO customers (name, address, phone) VALUES ($1, $2, $3) RETURNING *',
        [name, address || null, phone || null]
    );
    return result.rows[0];
}

/**
 * Update an existing customer record.
 *
 * @param {number} id
 * @param {string} name
 * @param {string} address
 * @param {string} phone
 */
async function updateCustomer(id, name, address, phone) {
    const result = await query(
        'UPDATE customers SET name=$1, address=$2, phone=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
        [name, address || null, phone || null, id]
    );
    return result.rows[0] || null;
}

/**
 * Delete a customer record.
 *
 * @param {number} id
 */
async function deleteCustomer(id) {
    const result = await query(
        'DELETE FROM customers WHERE id=$1 RETURNING id',
        [id]
    );
    return result.rows[0] || null;
}

module.exports = {
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
