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
      due_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS rides (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pickup TEXT NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','completed','cancelled')),
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

  // Migration for databases created before due_date existed
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS due_date DATE;`);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c === 0) {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const insertUser = async (name, email, password, role, specialty) => {
      const r = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, specialty) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [name, email, hash(password), role, specialty || null]
      );
      return r.rows[0].id;
    };

    const adminId = await insertUser('Platform Administrator', 'admin@mamauhai.app', 'admin123', 'admin', null);
    const doctorId = await insertUser('Dr. Ainebyona', 'doctor@mamauhai.app', 'doctor123', 'doctor', 'Obstetrics');
    const doctor2Id = await insertUser('Dr. Patricia Nakato', 'nakato@mamauhai.app', 'doctor123', 'doctor', 'Pediatrics');
    const healthId = await insertUser('Grace Nabirye', 'health@mamauhai.app', 'health123', 'health_worker', 'Home Visits');
    const health2Id = await insertUser('James Okello', 'okello@mamauhai.app', 'health123', 'health_worker', 'Nutrition Counseling');
    const motherId = await insertUser('Martha Mulwanyi', 'mother@mamauhai.app', 'mother123', 'mother', null);
    const mother2Id = await insertUser('Alice Namutebi', 'alice@mamauhai.app', 'mother123', 'mother', null);
    const mother3Id = await insertUser('Brenda Achieng', 'brenda@mamauhai.app', 'mother123', 'mother', null);

    console.log('Seeded default users (see README for credentials).');

    const insertAppt = async (motherId, providerId, reason, scheduledFor, status) => {
      const r = await pool.query(
        `INSERT INTO appointments (mother_id, provider_id, reason, scheduled_for, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [motherId, providerId, reason, scheduledFor, status]
      );
      return r.rows[0].id;
    };

    await insertAppt(motherId, doctorId, 'Routine prenatal checkup', '2026-06-15 09:00', 'completed');
    await insertAppt(motherId, doctorId, 'Follow-up ultrasound', '2026-07-22 10:30', 'assigned');
    await insertAppt(motherId, null, 'Concerns about ankle swelling', null, 'pending');
    await insertAppt(mother2Id, doctor2Id, 'First trimester checkup', '2026-07-18 11:00', 'pending');
    await insertAppt(mother3Id, healthId, 'Home visit — nutrition guidance', '2026-07-20 14:00', 'approved');
    await insertAppt(mother3Id, health2Id, 'Vaccination consultation', '2026-06-30 09:30', 'cancelled');

    const insertMsg = async (senderId, recipientId, body) => {
      await pool.query('INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1,$2,$3)', [senderId, recipientId, body]);
    };

    await insertMsg(motherId, doctorId, 'Hi Dr. Ainebyona, I wanted to ask about the swelling in my ankles.');
    await insertMsg(doctorId, motherId, 'Thanks for reaching out — mild swelling can be normal, but let\'s check it at your next visit.');
    await insertMsg(motherId, doctorId, 'Okay, thank you! I booked a follow-up already.');
    await insertMsg(mother2Id, health2Id, 'Hello, could you share some meal ideas for the first trimester?');
    await insertMsg(health2Id, mother2Id, 'Of course! I\'ll send over a simple nutrition guide before our next visit.');

    const insertNotif = async (userId, type, body) => {
      await pool.query('INSERT INTO notifications (user_id, type, body) VALUES ($1,$2,$3)', [userId, type, body]);
    };

    await insertNotif(adminId, 'appointment', 'Alice Namutebi booked a new appointment.');
    await insertNotif(adminId, 'appointment', 'Martha Mulwanyi booked a new appointment.');
    await insertNotif(motherId, 'appointment', 'Your follow-up ultrasound has been assigned to Dr. Ainebyona.');
    await insertNotif(doctorId, 'message', 'You have a new message from Martha Mulwanyi.');

    const insertComplaint = async (userId, subject, body, status) => {
      await pool.query('INSERT INTO complaints (user_id, subject, body, status) VALUES ($1,$2,$3,$4)', [userId, subject, body, status]);
    };

    await insertComplaint(mother3Id, 'Long wait time at clinic', 'I waited over an hour past my appointment slot.', 'open');
    await insertComplaint(mother2Id, 'Difficulty reaching health worker', 'I tried messaging twice this week with no reply.', 'in_review');

    console.log('Seeded demo appointments, messages, notifications, and complaints.');
  }
}

module.exports = { pool, init };
