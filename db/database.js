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

    CREATE TABLE IF NOT EXISTS health_logs (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weight_kg NUMERIC,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      blood_sugar NUMERIC,
      temperature_c NUMERIC,
      mood TEXT,
      symptoms TEXT,
      baby_movements INTEGER,
      water_intake_ml INTEGER,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'UGX',
      method TEXT NOT NULL CHECK(method IN ('mobile_money','cash','insurance','bank_transfer')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','refunded')),
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id SERIAL PRIMARY KEY,
      mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('antenatal_visit','lab_result','prescription','delivery_note','postpartum_checkup','vaccination')),
      title TEXT NOT NULL,
      details TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ,
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    -- QR-code login: a browser that isn't signed in creates a pending
    -- session; a user who's already signed in on another device scans the
    -- code and approves it, which signs the waiting browser in as them.
    CREATE TABLE IF NOT EXISTS qr_login_sessions (
      token TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','used','expired')),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      note TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Migrations for databases created before these columns existed
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS due_date DATE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_type TEXT NOT NULL DEFAULT 'safeboda' CHECK(ride_type IN ('ambulance','uber','safeboda'));`);
  await pool.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS fare NUMERIC;`);
  await pool.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL;`);

  await seedUsersAndCoreData();
  await seedHospitals();
  await seedExtendedSampleData();
}

// ---------------------------------------------------------------------------
// Idempotent seeding. Safe to run on every boot, including against a
// database that was already seeded by an earlier version of this app —
// existing rows are left untouched (ON CONFLICT DO NOTHING on email), and
// only the missing demo accounts needed to reach the target counts (5
// mothers, 5 doctors, 5 health workers, 2 admins) are added.
// ---------------------------------------------------------------------------
async function seedUsersAndCoreData() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Full target roster. Emails that already exist in the DB are skipped
  // (ON CONFLICT DO NOTHING); anything missing is added to reach the counts
  // requested: 2 admins, 5 doctors, 5 health workers, 5 mothers.
  const userSeeds = [
    { name: 'Platform Administrator', email: 'admin@mamauhai.app', password: 'admin123', role: 'admin' },
    { name: 'Deputy Administrator', email: 'deputy.admin@mamauhai.app', password: 'admin123', role: 'admin' },

    { name: 'Dr. Ainebyona', email: 'doctor@mamauhai.app', password: 'doctor123', role: 'doctor', specialty: 'Obstetrics' },
    { name: 'Dr. Patricia Nakato', email: 'nakato@mamauhai.app', password: 'doctor123', role: 'doctor', specialty: 'Pediatrics' },
    { name: 'Dr. Robert Katushabe', email: 'drkatushabe@mamauhai.app', password: 'doctor123', role: 'doctor', specialty: 'General Practice' },
    { name: 'Dr. Sarah Nansubuga', email: 'drnansubuga@mamauhai.app', password: 'doctor123', role: 'doctor', specialty: 'Gynecology' },
    { name: 'Dr. Emmanuel Mugisha', email: 'drmugisha@mamauhai.app', password: 'doctor123', role: 'doctor', specialty: 'Neonatology' },

    { name: 'Grace Nabirye', email: 'health@mamauhai.app', password: 'health123', role: 'health_worker', specialty: 'Home Visits' },
    { name: 'James Okello', email: 'okello@mamauhai.app', password: 'health123', role: 'health_worker', specialty: 'Nutrition Counseling' },
    { name: 'Sarah Namuli', email: 'hw.namuli@mamauhai.app', password: 'health123', role: 'health_worker', specialty: 'Immunization Outreach' },
    { name: 'Peter Byaruhanga', email: 'hw.byaruhanga@mamauhai.app', password: 'health123', role: 'health_worker', specialty: 'Community Health' },
    { name: 'Diana Kirabo', email: 'hw.kirabo@mamauhai.app', password: 'health123', role: 'health_worker', specialty: 'Maternal Support' },

    { name: 'Martha Mulwanyi', email: 'mother@mamauhai.app', password: 'mother123', role: 'mother' },
    { name: 'Alice Namutebi', email: 'alice@mamauhai.app', password: 'mother123', role: 'mother' },
    { name: 'Brenda Achieng', email: 'brenda@mamauhai.app', password: 'mother123', role: 'mother' },
    { name: 'Sarah Nakimuli', email: 'mother.nakimuli@mamauhai.app', password: 'mother123', role: 'mother' },
    { name: 'Grace Auma', email: 'mother.auma@mamauhai.app', password: 'mother123', role: 'mother' },
  ];

  const newlyCreated = new Set();
  for (const u of userSeeds) {
    const r = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, specialty)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [u.name, u.email, hash(u.password), u.role, u.specialty || null]
    );
    if (r.rows.length) newlyCreated.add(u.email);
  }

  const { rows: allUsers } = await pool.query(
    `SELECT id, email, role FROM users WHERE email = ANY($1)`,
    [userSeeds.map((u) => u.email)]
  );
  const byEmail = {};
  allUsers.forEach((row) => { byEmail[row.email] = row; });

  if (newlyCreated.size) {
    console.log(`Seeded ${newlyCreated.size} additional demo user(s) to reach target roster counts.`);
  }

  // Only give newly-created users their own appointment/message/notification
  // history, so restarting the server never duplicates content for users
  // that already existed.
  const id = (email) => byEmail[email]?.id;

  const insertAppt = async (motherId, providerId, reason, scheduledFor, status) => {
    const r = await pool.query(
      `INSERT INTO appointments (mother_id, provider_id, reason, scheduled_for, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [motherId, providerId, reason, scheduledFor, status]
    );
    return r.rows[0].id;
  };
  const insertMsg = async (senderId, recipientId, body) => {
    await pool.query('INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1,$2,$3)', [senderId, recipientId, body]);
  };
  const insertNotif = async (userId, type, body) => {
    await pool.query('INSERT INTO notifications (user_id, type, body) VALUES ($1,$2,$3)', [userId, type, body]);
  };
  const insertComplaint = async (userId, subject, body, status) => {
    await pool.query('INSERT INTO complaints (user_id, subject, body, status) VALUES ($1,$2,$3,$4)', [userId, subject, body, status]);
  };

  if (newlyCreated.has('mother@mamauhai.app')) {
    await insertAppt(id('mother@mamauhai.app'), id('doctor@mamauhai.app'), 'Routine prenatal checkup', '2026-06-15 09:00', 'completed');
    await insertAppt(id('mother@mamauhai.app'), id('doctor@mamauhai.app'), 'Follow-up ultrasound', '2026-07-22 10:30', 'assigned');
    await insertAppt(id('mother@mamauhai.app'), null, 'Concerns about ankle swelling', null, 'pending');
    await insertMsg(id('mother@mamauhai.app'), id('doctor@mamauhai.app'), 'Hi Dr. Ainebyona, I wanted to ask about the swelling in my ankles.');
    await insertMsg(id('doctor@mamauhai.app'), id('mother@mamauhai.app'), "Thanks for reaching out — mild swelling can be normal, but let's check it at your next visit.");
    await insertMsg(id('mother@mamauhai.app'), id('doctor@mamauhai.app'), 'Okay, thank you! I booked a follow-up already.');
    await insertNotif(id('admin@mamauhai.app'), 'appointment', 'Martha Mulwanyi booked a new appointment.');
    await insertNotif(id('mother@mamauhai.app'), 'appointment', 'Your follow-up ultrasound has been assigned to Dr. Ainebyona.');
    await insertNotif(id('doctor@mamauhai.app'), 'message', 'You have a new message from Martha Mulwanyi.');
  }
  if (newlyCreated.has('alice@mamauhai.app')) {
    await insertAppt(id('alice@mamauhai.app'), id('nakato@mamauhai.app'), 'First trimester checkup', '2026-07-18 11:00', 'pending');
    await insertMsg(id('alice@mamauhai.app'), id('okello@mamauhai.app'), 'Hello, could you share some meal ideas for the first trimester?');
    await insertMsg(id('okello@mamauhai.app'), id('alice@mamauhai.app'), "Of course! I'll send over a simple nutrition guide before our next visit.");
    await insertNotif(id('admin@mamauhai.app'), 'appointment', 'Alice Namutebi booked a new appointment.');
    await insertComplaint(id('alice@mamauhai.app'), 'Difficulty reaching health worker', 'I tried messaging twice this week with no reply.', 'in_review');
  }
  if (newlyCreated.has('brenda@mamauhai.app')) {
    await insertAppt(id('brenda@mamauhai.app'), id('health@mamauhai.app'), 'Home visit — nutrition guidance', '2026-07-20 14:00', 'approved');
    await insertAppt(id('brenda@mamauhai.app'), id('okello@mamauhai.app'), 'Vaccination consultation', '2026-06-30 09:30', 'cancelled');
    await insertComplaint(id('brenda@mamauhai.app'), 'Long wait time at clinic', 'I waited over an hour past my appointment slot.', 'open');
  }
  if (newlyCreated.has('mother.nakimuli@mamauhai.app')) {
    await insertAppt(id('mother.nakimuli@mamauhai.app'), id('drnansubuga@mamauhai.app'), 'Second trimester checkup', '2026-07-25 09:30', 'approved');
    await insertMsg(id('mother.nakimuli@mamauhai.app'), id('drnansubuga@mamauhai.app'), 'Good morning Doctor, I have a question about my last scan results.');
    await insertNotif(id('mother.nakimuli@mamauhai.app'), 'appointment', 'Your checkup with Dr. Sarah Nansubuga has been approved.');
  }
  if (newlyCreated.has('mother.auma@mamauhai.app')) {
    await insertAppt(id('mother.auma@mamauhai.app'), id('drmugisha@mamauhai.app'), 'Newborn check-up, 2 weeks old', '2026-07-16 10:00', 'pending');
    await insertMsg(id('mother.auma@mamauhai.app'), id('hw.kirabo@mamauhai.app'), 'Hi Diana, my baby has been feeding well but I wanted to check on the umbilical cord care.');
    await insertMsg(id('hw.kirabo@mamauhai.app'), id('mother.auma@mamauhai.app'), "That's great to hear! Keep the area clean and dry, and I'll visit this week to check on it.");
  }

  return byEmail;
}

// Seeds payments, reviews, and medical records exactly once (these tables
// are brand new, so gating on "table is empty" is safe and won't duplicate
// on restarts, regardless of how long the users table has existed).
async function seedHospitals() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM hospitals');
  if (Number(rows[0].count) > 0) return;

  const hospitals = [
    { name: 'Mulago National Referral Hospital', location: 'Kampala', note: 'Full maternity ward, NICU, 24/7 emergency obstetric care.', phone: '+256 414 554 000' },
    { name: 'Kawempe National Referral Hospital', location: 'Kampala', note: 'Specialist maternal & newborn health referral center.', phone: '+256 414 566 130' },
    { name: 'Nsambya Hospital', location: 'Kampala', note: 'Private, well-equipped maternity unit with antenatal clinic.', phone: '+256 414 267 012' },
    { name: 'St. Francis Hospital Nsambya', location: 'Kampala', note: 'General + maternity services, community outreach programs.', phone: '+256 414 267 025' },
    { name: 'Mengo Hospital', location: 'Kampala', note: 'One of the oldest hospitals in Uganda, active maternity department.', phone: '+256 414 270 222' },
  ];
  for (const h of hospitals) {
    await pool.query(
      'INSERT INTO hospitals (name, location, note, phone) VALUES ($1,$2,$3,$4)',
      [h.name, h.location, h.note, h.phone]
    );
  }
}

async function seedExtendedSampleData() {
  const { rows: payCount } = await pool.query('SELECT COUNT(*)::int AS c FROM payments');
  if (payCount[0].c > 0) return;

  const { rows: mothers } = await pool.query(`SELECT id, name FROM users WHERE role = 'mother' ORDER BY id`);
  const { rows: providers } = await pool.query(`SELECT id, name, role FROM users WHERE role IN ('doctor','health_worker') ORDER BY id`);
  if (!mothers.length || !providers.length) return;

  const { rows: appts } = await pool.query(`SELECT id, mother_id, provider_id FROM appointments WHERE provider_id IS NOT NULL`);

  const methods = ['mobile_money', 'cash', 'insurance', 'mobile_money'];
  const statuses = ['completed', 'completed', 'pending', 'failed'];

  let i = 0;
  for (const appt of appts) {
    const amount = [15000, 25000, 40000, 60000, 10000][i % 5];
    await pool.query(
      `INSERT INTO payments (mother_id, appointment_id, amount, currency, method, status, description)
       VALUES ($1,$2,$3,'UGX',$4,$5,$6)`,
      [appt.mother_id, appt.id, amount, methods[i % methods.length], statuses[i % statuses.length], 'Consultation fee']
    );
    i++;
  }

  // A couple of standalone payments not tied to a specific appointment (e.g. registration fee)
  for (const m of mothers.slice(0, 2)) {
    await pool.query(
      `INSERT INTO payments (mother_id, amount, currency, method, status, description)
       VALUES ($1,5000,'UGX','mobile_money','completed','Platform registration fee')`,
      [m.id]
    );
  }

  const reviewComments = [
    'Very attentive and explained everything clearly. Thank you!',
    'Helpful home visit, answered all my questions about nutrition.',
    'Waited a little longer than expected but the care was excellent.',
    'Friendly and reassuring throughout my checkup.',
    'Great follow-up and easy to reach on the app.',
  ];
  i = 0;
  for (const appt of appts) {
    if (i % 2 === 0) {
      await pool.query(
        `INSERT INTO reviews (mother_id, provider_id, appointment_id, rating, comment)
         VALUES ($1,$2,$3,$4,$5)`,
        [appt.mother_id, appt.provider_id, appt.id, [4, 5, 5, 4, 3][i % 5], reviewComments[i % reviewComments.length]]
      );
    }
    i++;
  }

  const recordTypes = ['antenatal_visit', 'lab_result', 'prescription', 'vaccination', 'postpartum_checkup'];
  const recordTitles = {
    antenatal_visit: 'Routine antenatal visit',
    lab_result: 'Blood pressure & urine test',
    prescription: 'Prenatal vitamins prescribed',
    vaccination: 'Tetanus toxoid vaccination',
    postpartum_checkup: 'Postpartum recovery checkup',
  };
  const recordDetails = {
    antenatal_visit: 'Fundal height and fetal heartbeat normal. Weight and blood pressure within expected range.',
    lab_result: 'BP 118/76, urine protein negative. No signs of pre-eclampsia at this visit.',
    prescription: 'Folic acid 5mg daily and ferrous sulfate 200mg daily for the remainder of pregnancy.',
    vaccination: 'Second dose of tetanus toxoid administered, no adverse reaction observed.',
    postpartum_checkup: 'Mother recovering well six weeks after delivery; wound healing normally, mood stable.',
  };
  i = 0;
  for (const m of mothers) {
    const provider = providers[i % providers.length];
    const type = recordTypes[i % recordTypes.length];
    await pool.query(
      `INSERT INTO medical_records (mother_id, provider_id, record_type, title, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [m.id, provider.id, type, recordTitles[type], recordDetails[type]]
    );
    i++;
  }

  console.log('Seeded sample payments, reviews, and medical records.');
}

module.exports = { pool, init };
