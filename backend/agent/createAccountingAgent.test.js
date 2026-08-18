const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('../initializeDatabase')
const createTransactionService = require('../transactionService')
const createAccountingAgent = require('./createAccountingAgent')
const createMockProvider = require('./providers/mockProvider')
const createUserTransactionReader = require('./userTransactionReader')

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

    const result = await agent.run('Which category has the most spending?', {
      language: 'en',
    })

    assert.equal(result.answer, '餐饮 is the top spending category at ¥80.00, representing 80% across 1 transactions.')
    assert.deepEqual(result.toolCall, {
      name: 'get_category_breakdown',
      input: { type: 'expense' },
    })
    assert.deepEqual(result.grounding, {
      readOnly: true,
      source: 'get_category_breakdown',
      evidenceCount: 2,
    })
  })

  it('中文提问返回中文且所有金额来自工具结果', async () => {
    transactionService.createTransaction({
      type: 'expense',
      amount: 66.5,
      category: 'Dining',
      transactionDate: '2026-08-12',
    })

    const result = await agent.run('哪个分类花得最多？', { language: 'zh' })

    assert.equal(
      result.answer,
      '餐饮是支出最多的分类，共 ¥66.50，占总支出的 100%，包含 1 笔账目。',
    )
    assert.equal(result.answer.includes('999'), false)
  })

  it('拒绝修改请求且不会改变账目', async () => {
    transactionService.createTransaction({
      type: 'expense',
      amount: 20,
      category: 'Dining',
      transactionDate: '2026-08-12',
    })
    const before = transactionService.getAllTransactions().length

    const result = await agent.run('删除这笔账目', { language: 'zh' })

    assert.match(result.answer, /只读财务助手/)
    assert.equal(result.toolCall, null)
    assert.equal(transactionService.getAllTransactions().length, before)
  })

  it('忽略 Provider 编造的最终数字并使用确定性事实回答', async () => {
    transactionService.createTransaction({
      type: 'income',
      amount: 100,
      category: 'Salary',
      transactionDate: '2026-08-12',
    })
    const untrustedProvider = {
      async decide() {
        return { type: 'tool_call', toolName: 'get_financial_summary', input: {} }
      },
      async respond() {
        return 'Your balance is ¥999,999.00.'
      },
    }
    const groundedAgent = createAccountingAgent({
      provider: untrustedProvider,
      transactionService,
    })

    const result = await groundedAgent.run('What is my balance?', { language: 'en' })

    assert.match(result.answer, /balance ¥100\.00/)
    assert.equal(result.answer.includes('999,999'), false)
  })

  it('助手只汇总当前用户的账目', async () => {
    database.prepare(`
      INSERT INTO users (id, name, account, password_hash, password_salt)
      VALUES (1, 'User One', 'one@example.com', 'hash', 'salt'),
             (2, 'User Two', 'two@example.com', 'hash', 'salt')
    `).run()
    transactionService.createTransaction({
      userId: 1,
      type: 'expense',
      amount: 35,
      category: 'Dining',
      transactionDate: '2026-08-12',
    })
    transactionService.createTransaction({
      userId: 2,
      type: 'expense',
      amount: 9000,
      category: 'Shopping',
      transactionDate: '2026-08-12',
    })
    const userAgent = createAccountingAgent({
      provider: createMockProvider(),
      transactionService: createUserTransactionReader(transactionService, 1),
    })

    const result = await userAgent.run('我的支出总额是多少？', { language: 'zh' })

    assert.match(result.answer, /支出 ¥35\.00/)
    assert.equal(result.answer.includes('9,000'), false)
    assert.equal(result.grounding.evidenceCount, 1)
  })
})
