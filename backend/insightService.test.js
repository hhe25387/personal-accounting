const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createInsightService = require('./insightService')
const createTransactionService = require('./transactionService')

describe('insightService', () => {
  let database
  let insights
  let transactions

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES ('小禾', 'he@example.com', 'hash', 'salt')
    `).run()
    insights = createInsightService(database)
    transactions = createTransactionService(database)
  })
  afterEach(() => database.close())

  function addEntries(count, dayCount) {
    for (let index = 0; index < count; index += 1) {
      transactions.createTransaction({
        userId: 1,
        type: 'expense',
        amount: 20,
        category: '交通',
        transactionDate: `2026-08-${String((index % dayCount) + 1).padStart(2, '0')}`,
      })
    }
  }

  it('少于 5 笔时处于初次认识阶段', () => {
    addEntries(4, 2)
    assert.equal(insights.getReadiness(1).stage, 'new')
  })

  it('数据量或活跃天数不足时处于了解阶段', () => {
    addEntries(15, 6)
    assert.equal(insights.getReadiness(1).stage, 'learning')
  })

  it('达到 15 笔且覆盖 7 天后形成个人参考', () => {
    addEntries(15, 7)
    assert.equal(insights.getReadiness(1).stage, 'established')
    assert.equal(insights.getReadiness(1).hasEnoughData, true)
  })
})
