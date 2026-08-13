const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createTransactionTools = require('./transactionTools')

function createFakeService() {
  const calls = []

  return {
    calls,
    findTransactions(filters) {
      calls.push(['findTransactions', filters])
      return [{ id: 1, category: '餐饮' }]
    },
    getFinancialSummary(filters) {
      calls.push(['getFinancialSummary', filters])
      return { totalIncome: 100, totalExpense: 25, balance: 75 }
    },
    getCategoryBreakdown(filters) {
      calls.push(['getCategoryBreakdown', filters])
      return [{ category: '餐饮', amount: 25, percentage: 100 }]
    },
  }
}

describe('transactionTools', () => {
  it('提供三个名称唯一的只读工具', () => {
    const tools = createTransactionTools(createFakeService())

    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        'list_transactions',
        'get_financial_summary',
        'get_category_breakdown',
      ],
    )
    assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length)
    assert.equal(tools.every((tool) => typeof tool.execute === 'function'), true)
  })

  it('工具 Schema 禁止未知字段并限制查询数量', () => {
    const tools = createTransactionTools(createFakeService())
    const listTool = tools.find((tool) => tool.name === 'list_transactions')

    assert.equal(listTool.inputSchema.additionalProperties, false)
    assert.deepEqual(listTool.inputSchema.properties.type.enum, [
      'income',
      'expense',
    ])
    assert.equal(listTool.inputSchema.properties.limit.maximum, 100)
  })

  it('list_transactions 调用明细查询函数', async () => {
    const service = createFakeService()
    const tools = createTransactionTools(service)
    const tool = tools.find((item) => item.name === 'list_transactions')
    const input = { type: 'expense', category: '餐饮', limit: 5 }

    const result = await tool.execute(input)

    assert.deepEqual(service.calls, [['findTransactions', input]])
    assert.deepEqual(result, [{ id: 1, category: '餐饮' }])
  })

  it('get_financial_summary 调用汇总函数', async () => {
    const service = createFakeService()
    const tools = createTransactionTools(service)
    const tool = tools.find((item) => item.name === 'get_financial_summary')
    const input = { startDate: '2026-08-01', endDate: '2026-08-31' }

    const result = await tool.execute(input)

    assert.deepEqual(service.calls, [['getFinancialSummary', input]])
    assert.equal(result.balance, 75)
  })

  it('get_category_breakdown 调用分类统计函数', async () => {
    const service = createFakeService()
    const tools = createTransactionTools(service)
    const tool = tools.find((item) => item.name === 'get_category_breakdown')
    const input = { type: 'expense' }

    const result = await tool.execute(input)

    assert.deepEqual(service.calls, [['getCategoryBreakdown', input]])
    assert.equal(result[0].category, '餐饮')
  })
})
