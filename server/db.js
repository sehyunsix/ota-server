// 파일: server/db.js
const mysql = require('mysql2/promise');

let pool;

async function createPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'ota_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
}

async function getPool() {
  if (!pool) {
    return await createPool();
  }
  return pool;
}

// 함수를 직접 내보내기
module.exports = {
  createPool,
  getPool
};