require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { body, validationResult, param } = require('express-validator');

const app  = express();
const port = process.env.PORT || 8000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());

// Init table
pool.query(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    auth_user_id INT UNIQUE NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    vehicle_numbers TEXT[],
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

app.get('/health', (req, res) => res.json({ status: 'UP', service: 'user-service' }));

// GET all users (admin only in production)
app.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT id, auth_user_id, full_name, phone, vehicle_numbers, created_at FROM user_profiles ORDER BY id DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const count = await pool.query('SELECT COUNT(*) FROM user_profiles');
    res.json({ users: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single user by auth_user_id
app.get('/users/:auth_user_id',
  [param('auth_user_id').isInt()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const result = await pool.query(
        'SELECT * FROM user_profiles WHERE auth_user_id = $1', [req.params.auth_user_id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'User profile not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// POST create user profile
app.post('/users', [
  body('auth_user_id').isInt().withMessage('auth_user_id must be an integer'),
  body('full_name').notEmpty().withMessage('full_name is required'),
  body('phone').optional().isMobilePhone(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { auth_user_id, full_name, phone, address, vehicle_numbers = [] } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO user_profiles (auth_user_id, full_name, phone, address, vehicle_numbers) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [auth_user_id, full_name, phone, address, vehicle_numbers]
    );
    res.status(201).json({ message: 'Profile created', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Profile already exists for this user' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update user profile
app.put('/users/:auth_user_id', [
  param('auth_user_id').isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { full_name, phone, address, vehicle_numbers, avatar_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           vehicle_numbers = COALESCE($4, vehicle_numbers),
           avatar_url = COALESCE($5, avatar_url),
           updated_at = NOW()
       WHERE auth_user_id = $6 RETURNING *`,
      [full_name, phone, address, vehicle_numbers, avatar_url, req.params.auth_user_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE user profile
app.delete('/users/:auth_user_id', [param('auth_user_id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    await pool.query('DELETE FROM user_profiles WHERE auth_user_id = $1', [req.params.auth_user_id]);
    res.json({ message: 'User profile deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH add vehicle to user
app.patch('/users/:auth_user_id/vehicles', [param('auth_user_id').isInt()], async (req, res) => {
  const { vehicle_number } = req.body;
  if (!vehicle_number) return res.status(400).json({ error: 'vehicle_number required' });
  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET vehicle_numbers = array_append(vehicle_numbers, $1), updated_at = NOW()
       WHERE auth_user_id = $2 RETURNING vehicle_numbers`,
      [vehicle_number.toUpperCase(), req.params.auth_user_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Vehicle added', vehicles: result.rows[0].vehicle_numbers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;

if (require.main === module) {
  app.listen(port, () => console.log(`user-service running on port ${port}`));
}
