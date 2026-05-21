const mysql = require('mysql2/promise');
require('dotenv').config();

const databaseUrl = process.env.DB_URL || process.env.DATABASE_URL || process.env.MYSQL_URL;

const baseDbConfig = {
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  namedPlaceholders:  true,
};

const dbConfig = databaseUrl ? {
  uri: databaseUrl,
  ...baseDbConfig,
} : {
  host:               process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port:               Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user:               process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password:           process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database:           process.env.DB_NAME || process.env.MYSQLDATABASE || 'issue_tracker',
  ...baseDbConfig,
};

const pool = mysql.createPool(dbConfig);

// Test the connection on startup.
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('MySQL connection failed:', err.message || err.code || err);
    console.error('Database config:', {
      usingUrl: Boolean(databaseUrl),
      host: dbConfig.host || '(from URL)',
      port: dbConfig.port || '(from URL)',
      user: dbConfig.user || '(from URL)',
      database: dbConfig.database || '(from URL)',
      hasPassword: Boolean(dbConfig.password || databaseUrl),
    });
    console.error('Check MYSQL_URL, DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, or Railway MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE variables.');
    process.exit(1);
  }
})();

module.exports = pool;
