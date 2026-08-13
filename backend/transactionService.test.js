const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createTransactionService = require('./transactionService')

describe('transactionService', () => {
  let database
  let transactionService

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    transactionService = createTransactionService(database)
  })

  afterEach(() => {
    database.close()
  })

  it('新增账目并将金额以美分保存', () => {
    const transaction = transactionService.createTransaction({
      type: 'expense',
      amount: 18.75,
      category: '餐饮',
      transactionDate: '2026-08-11',
      description: '午餐',
    })

    const savedRow = database
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .get(transaction.id)

    assert.equal(savedRow.amount_cents, 1875)
    assert.equal(savedRow.category, '餐饮')
  })

  it('按日期和 ID 倒序读取账目', () => {
    transactionService.createTransaction({
      type: 'expense',
      amount: 10,
      category: '交通',
      transactionDate: '2026-08-10',
      description: '',
    })
    transactionService.createTransaction({
      type: 'income',
      amount: 100,
      category: '兼职',
      transactionDate: '2026-08-11',
      description: '',
    })

    const transactions = transactionService.getAllTransactions()

    assert.equal(transactions.length, 2)
    assert.equal(transactions[0].category, '兼职')
    assert.equal(transactions[0].amount, 100)
  })

  it('修改存在的账目并在找不到时返回 null', () => {
    const original = transactionService.createTransaction({
      type: 'expense',
      amount: 20,
      category: '餐饮',
      transactionDate: '2026-08-11',
      description: '午餐',
    })

    const updated = transactionService.updateTransaction(original.id, {
      type: 'expense',
      amount: 25.5,
      category: '餐饮',
      transactionDate: '2026-08-11',
      description: '晚餐',
    })

    assert.equal(updated.amount, 25.5)
    assert.equal(updated.description, '晚餐')
    assert.equal(
      transactionService.updateTransaction(999, {
        type: 'expense',
        amount: 1,
        category: '其他支出',
        transactionDate: '2026-08-11',
        description: '',
      }),
      null,
    )
  })

  it('删除存在的账目并在重复删除时返回 false', () => {
    const transaction = transactionService.createTransaction({
      type: 'income',
      amount: 80,
      category: '兼职',
      transactionDate: '2026-08-11',
      description: '',
    })

    assert.equal(transactionService.deleteTransaction(transaction.id), true)
    assert.equal(transactionService.deleteTransaction(transaction.id), false)
    assert.deepEqual(transactionService.getAllTransactions(), [])
  })

  it('按类型、分类和日期筛选账目并限制数量', () => {
    const transactions = [
      ['expense', 20, '餐饮', '2026-08-01'],
      ['expense', 35, '餐饮', '2026-08-10'],
      ['expense', 12, '交通', '2026-08-11'],
      ['income', 500, '兼职', '2026-08-11'],
    ]

    for (const [type, amount, category, transactionDate] of transactions) {
      transactionService.createTransaction({
        type,
        amount,
        category,
        transactionDate,
        description: '',
      })
    }

    const results = transactionService.findTransactions({
      type: 'expense',
      category: '餐饮',
      startDate: '2026-08-05',
      endDate: '2026-08-31',
      limit: 1,
    })

    assert.equal(results.length, 1)
    assert.equal(results[0].amount, 35)
  })

  it('计算指定日期范围内的收入、支出和余额', () => {
    const transactions = [
      ['income', 1000, '工资', '2026-08-01'],
      ['expense', 125.5, '餐饮', '2026-08-05'],
      ['expense', 50, '交通', '2026-08-10'],
      ['income', 400, '兼职', '2026-07-20'],
    ]

    for (const [type, amount, category, transactionDate] of transactions) {
      transactionService.createTransaction({
        type,
        amount,
        category,
        transactionDate,
        description: '',
      })
    }

    assert.deepEqual(
      transactionService.getFinancialSummary({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
      {
        totalIncome: 1000,
        totalExpense: 175.5,
        balance: 824.5,
        transactionCount: 3,
      },
    )
  })

  it('按支出分类计算金额、笔数和占比', () => {
    const transactions = [
      ['expense', 60, '餐饮'],
      ['expense', 40, '餐饮'],
      ['expense', 50, '交通'],
      ['income', 500, '工资'],
    ]

    for (const [type, amount, category] of transactions) {
      transactionService.createTransaction({
        type,
        amount,
        category,
        transactionDate: '2026-08-11',
        description: '',
      })
    }

    assert.deepEqual(transactionService.getCategoryBreakdown(), [
      {
        category: '餐饮',
        amount: 100,
        transactionCount: 2,
        percentage: 66.67,
      },
      {
        category: '交通',
        amount: 50,
        transactionCount: 1,
        percentage: 33.33,
      },
    ])
  })

  it('拒绝未知字段、错误类型和过大的查询数量', () => {
    assert.throws(
      () => transactionService.findTransactions({ sql: 'DROP TABLE' }),
      /不支持筛选字段/,
    )
    assert.throws(
      () => transactionService.findTransactions({ type: 'other' }),
      /type 必须是/,
    )
    assert.throws(
      () => transactionService.findTransactions({ limit: 101 }),
      /limit 必须是/,
    )
  })
})
