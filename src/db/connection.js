const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT || 3306),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'issue_tracker',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  namedPlaceholders:  true,
});

// Test the connection on startup.
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    console.error('Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME in .env.');
    process.exit(1);
  }
})();

module.exports = pool;
