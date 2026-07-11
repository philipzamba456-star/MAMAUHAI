const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\n' + '='.repeat(70));
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  console.error('This app cannot start without a Postgres connection string.');
  console.error('');
  console.error('  Running locally?');
  console.error('    Create a .env file (copy .env.example) and set:');
  console.error('    DATABASE_URL=postgres://user:password@localhost:5432/mama_uhai');
  console.error('');
  console.error('  Running on Render?');
  console.error('    1. Create a Postgres database: New + -> PostgreSQL');
  console.error('    2. Open it, copy the "Internal Database URL"');
  console.error('    3. Go to your WEB SERVICE (not the database) -> Environment tab');
  console.error('    4. Add DATABASE_URL with that value, then Save Changes');
  console.error('    5. Make sure the web service and database are in the SAME region');
  console.error('='.repeat(70) + '\n');
  process.exit(1);
}

// Render's managed Postgres requires SSL; local Postgres does not.
const useSSL = /render\.com|sslmode=require/.test(connectionString) || process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

async function init() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('\n' + '='.repeat(70));
    console.error('FATAL: Could not connect to the database using DATABASE_URL.');
    console.error('Underlying error:', err.message);
    console.error('');
    console.error('Common causes:');
    console.error('  - The web service and Postgres database are in different Render regions');
    console.error('  - DATABASE_URL was pasted incompletely (check for missing characters)');
    console.error('  - You copied the External URL instead of the Internal Database URL');
    console.error('    (Internal is preferred and free for same-region services)');
    console.error('  - The database is still provisioning (wait ~1 min after creating it)');
    console.error('='.repeat(70) + '\n');
    throw err;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('mother','doctor','health_worker','admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','locked','suspended')),
      specialty TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT,
      scheduled_for TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','assigned','completed','cancelled','rescheduled')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT,
      body TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c === 0) {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const insert = `INSERT INTO users (name, email, password_hash, role, specialty) VALUES ($1,$2,$3,$4,$5)`;
    await pool.query(insert, ['Platform Administrator', 'admin@mamauhai.app', hash('admin123'), 'admin', null]);
    await pool.query(insert, ['Dr. Ainebyona', 'doctor@mamauhai.app', hash('doctor123'), 'doctor', 'Obstetrics']);
    await pool.query(insert, ['Grace Nabirye', 'health@mamauhai.app', hash('health123'), 'health_worker', 'Home Visits']);
    await pool.query(insert, ['Martha Mulwanyi', 'mother@mamauhai.app', hash('mother123'), 'mother', null]);
    console.log('Seeded default users (see README for credentials).');
  }
}

module.exports = { pool, init };
