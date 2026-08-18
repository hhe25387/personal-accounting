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

  it('按用户隔离账目、统计和修改权限', () => {
    database
      .prepare(`
        INSERT INTO users (name, account, password_hash, password_salt)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?)
      `)
      .run(
        '用户一', 'one@example.com', 'hash', 'salt',
        '用户二', 'two@example.com', 'hash', 'salt',
      )
    const first = transactionService.createTransaction({
      userId: 1,
      type: 'expense',
      amount: 100,
      category: 'Shopping',
      transactionDate: '2026-08-03',
    })
    transactionService.createTransaction({
      userId: 2,
      type: 'income',
      amount: 900,
      category: 'Salary',
      transactionDate: '2026-08-03',
    })

    assert.equal(transactionService.getAllTransactions({ userId: 1 }).length, 1)
    assert.equal(
      transactionService.getFinancialSummary({ userId: 1 }).totalExpense,
      100,
    )
    assert.equal(transactionService.getFinancialSummary({ userId: 1 }).totalIncome, 0)
    assert.equal(
      transactionService.updateTransaction(
        first.id,
        {
          type: 'expense', amount: 20, category: 'Shopping',
          transactionDate: '2026-08-03', description: '',
        },
        2,
      ),
      null,
    )
    assert.equal(transactionService.deleteTransaction(first.id, 2), false)
    assert.equal(transactionService.deleteTransaction(first.id, 1), true)
  })

  it('按 ID 读取单笔账目并在不存在时返回 null', () => {
    const transaction = transactionService.createTransaction({
      type: 'expense',
      amount: 88,
      category: '购物',
      transactionDate: '2026-08-12',
      description: '生活用品',
    })

    assert.equal(transactionService.getTransactionById(transaction.id).amount, 88)
    assert.equal(transactionService.getTransactionById(999), null)
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

  it('支持按日期或金额稳定排序', () => {
    const transactions = [
      ['expense', 20, '餐饮', '2026-08-01'],
      ['expense', 80, '购物', '2026-08-03'],
      ['income', 50, '兼职', '2026-08-02'],
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
      transactionService.getAllTransactions({ sortBy: 'amount', sortOrder: 'desc' })
        .map((transaction) => transaction.amount),
      [80, 50, 20],
    )
    assert.deepEqual(
      transactionService.getAllTransactions({ sortBy: 'date', sortOrder: 'asc' })
        .map((transaction) => transaction.transactionDate),
      ['2026-08-01', '2026-08-02', '2026-08-03'],
    )
  })

  it('按分类或备注关键词搜索并转义通配符', () => {
    transactionService.createTransaction({
      type: 'expense',
      amount: 88,
      category: '餐饮',
      transactionDate: '2026-08-10',
      description: '和朋友聚餐',
    })
    transactionService.createTransaction({
      type: 'expense',
      amount: 20,
      category: '购物',
      transactionDate: '2026-08-11',
      description: '打折 20%',
    })

    assert.deepEqual(
      transactionService.findTransactions({ keyword: '朋友' })
        .map((transaction) => transaction.category),
      ['餐饮'],
    )
    assert.equal(transactionService.findTransactions({ keyword: '餐饮' }).length, 1)
    assert.equal(transactionService.findTransactions({ keyword: '%' }).length, 1)
  })

  it('按 25 笔分页并返回总数和是否还有更多', () => {
    for (let index = 1; index <= 30; index += 1) {
      transactionService.createTransaction({
        type: 'expense',
        amount: index,
        category: '餐饮',
        transactionDate: '2026-08-14',
        description: `第 ${index} 笔`,
      })
    }

    const firstPage = transactionService.getTransactionPage({
      limit: 25,
      offset: 0,
    })
    const secondPage = transactionService.getTransactionPage({
      limit: 25,
      offset: 25,
    })

    assert.equal(firstPage.transactions.length, 25)
    assert.deepEqual(firstPage.pagination, {
      total: 30,
      limit: 25,
      offset: 0,
      hasMore: true,
    })
    assert.equal(secondPage.transactions.length, 5)
    assert.equal(secondPage.pagination.hasMore, false)
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

  it('按日期计算每日收入和支出趋势', () => {
    const transactions = [
      ['income', 1000, '工资', '2026-08-01'],
      ['expense', 20, '餐饮', '2026-08-01'],
      ['expense', 35.5, '交通', '2026-08-02'],
      ['income', 400, '兼职', '2026-07-31'],
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
      transactionService.getDailyBreakdown({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
      [
        {
          date: '2026-08-01',
          income: 1000,
          expense: 20,
          transactionCount: 2,
        },
        {
          date: '2026-08-02',
          income: 0,
          expense: 35.5,
          transactionCount: 1,
        },
      ],
    )
  })

  it('拒绝未知字段、错误类型和过大的查询数量', () => {
    assert.throws(
      () => transactionService.findTransactions({ sql: 'DROP TABLE' }),
      /Unsupported filter/,
    )
    assert.throws(
      () => transactionService.findTransactions({ type: 'other' }),
      /type must be/,
    )
    assert.throws(
      () => transactionService.findTransactions({ limit: 101 }),
      /limit must be/,
    )
    assert.throws(
      () => transactionService.findTransactions({ sortBy: 'description' }),
      /sortBy must be/,
    )
    assert.throws(
      () => transactionService.findTransactions({ sortOrder: 'sideways' }),
      /sortOrder must be/,
    )
    assert.throws(
      () => transactionService.findTransactions({ keyword: ' '.repeat(2) }),
      /keyword must be/,
    )
    assert.throws(
      () => transactionService.getTransactionPage({ offset: -1 }),
      /offset must be/,
    )
  })

  it('登录用户写入时严格校验金额、日期、分类和备注', () => {
    database.prepare(`
      INSERT INTO users (id, name, account, password_hash, password_salt)
      VALUES (1, 'User One', 'one@example.com', 'hash', 'salt')
    `).run()

    const valid = transactionService.createTransaction({
      userId: 1,
      type: 'expense',
      amount: '12.345',
      category: 'dining',
      transactionDate: '2026-02-28',
      description: '  lunch  ',
    })
    assert.equal(valid.amount, 12.35)
    assert.equal(valid.category, 'Dining')
    assert.equal(valid.description, 'lunch')

    const invalidEntries = [
      { type: 'other', amount: 10, category: 'Dining', transactionDate: '2026-02-28' },
      { type: 'expense', amount: -5, category: 'Dining', transactionDate: '2026-02-28' },
      { type: 'expense', amount: 0.001, category: 'Dining', transactionDate: '2026-02-28' },
      { type: 'expense', amount: 10, category: 'Dining', transactionDate: '2026-02-30' },
      { type: 'expense', amount: 10, category: 'Missing', transactionDate: '2026-02-28' },
      { type: 'expense', amount: 10, category: 'Salary', transactionDate: '2026-02-28' },
      { type: 'expense', amount: 10, category: 'Dining', transactionDate: '2026-02-28', description: 'x'.repeat(501) },
    ]
    for (const entry of invalidEntries) {
      assert.throws(
        () => transactionService.createTransaction({ userId: 1, ...entry }),
        TypeError,
      )
    }
    assert.equal(transactionService.getAllTransactions({ userId: 1 }).length, 1)
  })

  it('编辑校验失败时保留原账目不变', () => {
    database.prepare(`
      INSERT INTO users (id, name, account, password_hash, password_salt)
      VALUES (1, 'User One', 'one@example.com', 'hash', 'salt')
    `).run()
    const original = transactionService.createTransaction({
      userId: 1,
      type: 'expense',
      amount: 20,
      category: 'Dining',
      transactionDate: '2026-08-11',
      description: 'Lunch',
    })

    assert.throws(
      () => transactionService.updateTransaction(original.id, {
        type: 'expense',
        amount: 25,
        category: 'Missing',
        transactionDate: '2026-08-11',
      }, 1),
      /Category is unavailable/,
    )
    assert.equal(transactionService.getTransactionById(original.id, 1).amount, 20)
    assert.equal(transactionService.getTransactionById(original.id, 1).category, 'Dining')
  })
})
