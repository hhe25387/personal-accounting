const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createMonthlyReportService = require('./monthlyReportService')
const createTransactionService = require('./transactionService')

describe('monthlyReportService', () => {
  let database
  let reportService
  let transactionService

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES ('First', 'first@example.com', 'hash', 'salt'),
             ('Second', 'second@example.com', 'hash', 'salt')
    `).run()
    transactionService = createTransactionService(database)
    reportService = createMonthlyReportService(transactionService)
  })

  afterEach(() => database.close())

  function add(userId, type, amount, category, transactionDate, description = '') {
    transactionService.createTransaction({
      userId, type, amount, category, transactionDate, description,
    })
  }

  it('没有账目时返回明确空状态且不编造趋势', () => {
    const report = reportService.getMonthlyReport(1, '2026-08')

    assert.equal(report.dataLevel, 'empty')
    assert.equal(report.summary.transactionCount, 0)
    assert.equal(report.summary.savingsRate, null)
    assert.equal(report.activity.averagePerSpendingDay, 0)
    assert.equal(report.topCategory, null)
    assert.equal(report.largestExpense, null)
    assert.equal(report.comparison.hasPreviousData, false)
  })

  it('计算月度习惯、环比及变化最大的分类', () => {
    add(1, 'income', 1000, 'Salary', '2026-07-01')
    add(1, 'expense', 100, 'Dining', '2026-07-03')
    add(1, 'expense', 50, 'Shopping', '2026-07-04')
    add(1, 'income', 1200, 'Salary', '2026-08-01')
    add(1, 'expense', 200, 'Dining', '2026-08-03')
    add(1, 'expense', 20, 'Shopping', '2026-08-03')
    add(1, 'expense', 300, 'Housing', '2026-08-12', 'Rent')
    add(2, 'expense', 9999, 'Shopping', '2026-08-20')

    const report = reportService.getMonthlyReport(1, '2026-08')

    assert.equal(report.dataLevel, 'complete')
    assert.deepEqual(report.summary, {
      totalIncome: 1200,
      totalExpense: 520,
      balance: 680,
      transactionCount: 4,
      savingsRate: 56.67,
    })
    assert.equal(report.activity.activeDays, 3)
    assert.equal(report.activity.spendingDays, 2)
    assert.equal(report.activity.averagePerSpendingDay, 260)
    assert.equal(report.activity.highestSpendingDay.date, '2026-08-12')
    assert.equal(report.topCategory.category, 'Housing')
    assert.equal(report.largestExpense.description, 'Rent')
    assert.deepEqual(report.comparison.expense, {
      current: 520,
      previous: 150,
      difference: 370,
      direction: 'up',
      percentageChange: 246.67,
    })
    assert.equal(report.largestCategoryChange.category, 'Housing')
    assert.equal(report.largestCategoryChange.difference, 300)
  })

  it('无上月数据时保留绝对变化但不生成无意义百分比', () => {
    add(1, 'expense', 80, 'Transport', '2026-08-02')

    const report = reportService.getMonthlyReport(1, '2026-08')

    assert.equal(report.dataLevel, 'basic')
    assert.equal(report.comparison.hasPreviousData, false)
    assert.equal(report.comparison.expense.difference, 80)
    assert.equal(report.comparison.expense.percentageChange, null)
  })

  it('拒绝格式错误或不存在的月份', () => {
    assert.throws(() => reportService.getMonthlyReport(1, '2026-8'), /YYYY-MM/)
    assert.throws(() => reportService.getMonthlyReport(1, '2026-13'), /valid month/)
  })
})
