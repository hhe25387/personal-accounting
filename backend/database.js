const path = require('path')
const Database = require('better-sqlite3')
const initializeDatabase = require('./initializeDatabase')

const configuredPath = process.env.DATABASE_PATH
const databasePath = configuredPath === ':memory:'
  ? ':memory:'
  : path.resolve(__dirname, configuredPath || 'accounting.db')
const database = new Database(databasePath)

initializeDatabase(database)

console.log('Database, transactions, and categories initialized')

module.exports = database
