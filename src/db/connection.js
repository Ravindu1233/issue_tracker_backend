const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host:               process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port:               Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user:               process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password:           process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database:           process.env.DB_NAME || process.env.MYSQLDATABASE || 'issue_tracker',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  namedPlaceholders:  true,
};

const pool = mysql.createPool({
  ...dbConfig,
});

// Test the connection on startup.
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('MySQL connection failed:', err.message || err.code || err);
    console.error('Database config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      hasPassword: Boolean(dbConfig.password),
    });
    console.error('Check DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME or Railway MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE variables.');
    process.exit(1);
  }
})();

module.exports = pool;
