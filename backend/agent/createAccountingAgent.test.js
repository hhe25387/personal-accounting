const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('../initializeDatabase')
const createTransactionService = require('../transactionService')
const createAccountingAgent = require('./createAccountingAgent')
const createMockProvider = require('./providers/mockProvider')

describe('createAccountingAgent', () => {
  let database
  let transactionService
  let agent

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    transactionService = createTransactionService(database)
    agent = createAccountingAgent({
      provider: createMockProvider(),
      transactionService,
    })
  })

  afterEach(() => {
    database.close()
  })

  it('通过分类工具分析内存数据库中的真实统计结果', async () => {
    transactionService.createTransaction({
      type: 'expense',
      amount: 80,
      category: '餐饮',
      transactionDate: '2026-08-12',
      description: '晚餐',
    })
    transactionService.createTransaction({
      type: 'expense',
      amount: 20,
      category: '交通',
      transactionDate: '2026-08-12',
      description: '公交',
    })

    const result = await agent.run('哪个板块花得最多？')

    assert.equal(result.answer, '餐饮是支出最多的分类，共 $80.00，占 80%。')
    assert.deepEqual(result.toolCall, {
      name: 'get_category_breakdown',
      input: { type: 'expense' },
    })
  })
})
