const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const createBudgetService = require('./budgetService')
const initializeDatabase = require('./initializeDatabase')
const createTransactionService = require('./transactionService')

describe('budgetService', () => {
  let database
  let transactionService
  let budgetService

  beforeEach(() => {
    database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    initializeDatabase(database)
    database.prepare(`
      INSERT INTO users (id, name, account, password_hash, password_salt)
      VALUES (1, 'User One', 'one@example.com', 'hash', 'salt'),
             (2, 'User Two', 'two@example.com', 'hash', 'salt')
    `).run()
    transactionService = createTransactionService(database)
    budgetService = createBudgetService(database, transactionService)
  })

  afterEach(() => database.close())

  it('未设置预算时返回不打扰记账的空状态', () => {
    assert.deepEqual(budgetService.getBudget(1, '2026-08'), {
      month: '2026-08',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      configured: false,
      total: null,
      categories: [],
    })
  })

  it('保存总预算和分类预算并计算安全、提醒及超支状态', () => {
    transactionService.createTransaction({
      userId: 1, type: 'expense', amount: 250, category: 'Dining',
      transactionDate: '2026-08-10',
    })
    transactionService.createTransaction({
      userId: 1, type: 'expense', amount: 600, category: 'Shopping',
      transactionDate: '2026-08-11',
    })
    transactionService.createTransaction({
      userId: 2, type: 'expense', amount: 9999, category: 'Dining',
      transactionDate: '2026-08-10',
    })

    const budget = budgetService.saveBudget(1, '2026-08', {
      totalAmount: 1000,
      categories: [
        { category: 'Dining', amount: 300 },
        { category: 'Shopping', amount: 500 },
      ],
    })

    assert.deepEqual(budget.total, {
      limit: 1000,
      spent: 850,
      remaining: 150,
      percentage: 85,
      status: 'warning',
    })
    assert.deepEqual(budget.categories[0], {
      category: 'Dining',
      limit: 300,
      spent: 250,
      remaining: 50,
      percentage: 83.33,
      status: 'warning',
    })
    assert.equal(budget.categories[1].status, 'exceeded')
  })

  it('预算按用户和月份隔离并支持删除', () => {
    budgetService.saveBudget(1, '2026-08', { totalAmount: 1000 })
    budgetService.saveBudget(2, '2026-08', { totalAmount: 2000 })

    assert.equal(budgetService.getBudget(1, '2026-08').total.limit, 1000)
    assert.equal(budgetService.getBudget(2, '2026-08').total.limit, 2000)
    assert.equal(budgetService.deleteBudget(1, '2026-08'), true)
    assert.equal(budgetService.getBudget(1, '2026-08').configured, false)
    assert.equal(budgetService.getBudget(2, '2026-08').configured, true)
  })

  it('允许只设置分类预算并拒绝重复或不可用分类', () => {
    const budget = budgetService.saveBudget(1, '2026-08', {
      categories: [{ category: 'Dining', amount: 300 }],
    })
    assert.equal(budget.total, null)
    assert.equal(budget.categories.length, 1)

    assert.throws(
      () => budgetService.saveBudget(1, '2026-09', {
        categories: [
          { category: 'Dining', amount: 100 },
          { category: 'dining', amount: 200 },
        ],
      }),
      /duplicated/,
    )
    assert.throws(
      () => budgetService.saveBudget(1, '2026-09', {
        categories: [{ category: 'Not Real', amount: 100 }],
      }),
      /unavailable/,
    )
  })
})
