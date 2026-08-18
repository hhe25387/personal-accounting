const path = require('path')
const Database = require('better-sqlite3')
const initializeDatabase = require('./initializeDatabase')

const databasePath = path.join(__dirname, 'accounting.db')
const database = new Database(databasePath)

initializeDatabase(database)

console.log('Database, transactions, and categories initialized')

module.exports = database
