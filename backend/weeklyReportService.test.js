const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createTransactionService = require('./transactionService')
const createWeeklyReportService = require('./weeklyReportService')

describe('weeklyReportService', () => {
  let database
  let transactionService
  let weeklyReportService

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES ('First', 'first@example.com', 'hash', 'salt'),
             ('Second', 'second@example.com', 'hash', 'salt')
    `).run()
    transactionService = createTransactionService(database)
    weeklyReportService = createWeeklyReportService(transactionService)
  })

  afterEach(() => database.close())

  function add(userId, type, amount, category, transactionDate, description = '') {
    transactionService.createTransaction({
      userId, type, amount, category, transactionDate, description,
    })
  }

  it('没有账目时返回轻量空状态', () => {
    const report = weeklyReportService.getWeeklyReport(1, '2026-08-19')

    assert.equal(report.dataLevel, 'empty')
    assert.equal(report.summary.totalExpense, 0)
    assert.equal(report.comparison.hasPreviousData, false)
    assert.deepEqual(report.topCategories, [])
    assert.equal(report.largestExpense, null)
  })

  it('按本周已进行天数与上周同期公平比较', () => {
    add(1, 'expense', 100, 'Dining', '2026-08-10')
    add(1, 'expense', 50, 'Transport', '2026-08-12')
    add(1, 'expense', 999, 'Shopping', '2026-08-15')
    add(1, 'income', 500, 'Salary', '2026-08-17')
    add(1, 'expense', 60, 'Dining', '2026-08-17')
    add(1, 'expense', 30, 'Transport', '2026-08-19', 'Train')
    add(2, 'expense', 5000, 'Shopping', '2026-08-19')

    const report = weeklyReportService.getWeeklyReport(1, '2026-08-19')

    assert.equal(report.dataLevel, 'complete')
    assert.deepEqual(report.summary, {
      totalIncome: 500,
      totalExpense: 90,
      balance: 410,
      transactionCount: 3,
    })
    assert.equal(report.comparison.expense.previous, 150)
    assert.equal(report.comparison.expense.difference, -60)
    assert.equal(report.comparison.expense.percentageChange, -40)
    assert.equal(report.topCategories[0].category, 'Dining')
    assert.equal(report.largestExpense.description, null)
    assert.deepEqual(report.days.map((day) => day.date), [
      '2026-08-17', '2026-08-19',
    ])
  })

  it('上周只有收入时不生成支出百分比', () => {
    add(1, 'income', 100, 'Salary', '2026-08-10')
    add(1, 'expense', 40, 'Dining', '2026-08-18')

    const report = weeklyReportService.getWeeklyReport(1, '2026-08-19')

    assert.equal(report.comparison.hasPreviousData, true)
    assert.equal(report.comparison.hasPreviousExpenseData, false)
    assert.equal(report.comparison.expense.percentageChange, null)
  })

  it('拒绝无效日期', () => {
    assert.throws(
      () => weeklyReportService.getWeeklyReport(1, '2026-02-30'),
      /valid calendar date/,
    )
  })
})
