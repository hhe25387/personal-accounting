const path = require('path')
const Database = require('better-sqlite3')

const databasePath = path.join(__dirname, 'accounting.db')
const database = new Database(databasePath)

database.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    category TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

console.log('数据库和 transactions 表创建成功')

module.exports = database