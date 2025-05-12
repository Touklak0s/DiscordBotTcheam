const mysql = require('mysql2/promise');

async function connectDB() {
  const db = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
  });
  console.log('✅ Connecté à la base de données MySQL');
  return db;
}

module.exports = { connectDB };