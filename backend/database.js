const path = require('path')
const Database = require('better-sqlite3')
const initializeDatabase = require('./initializeDatabase')

const databasePath = path.join(__dirname, 'accounting.db')
const database = new Database(databasePath)

initializeDatabase(database)

console.log('数据库和 transactions 表创建成功')

module.exports = database
