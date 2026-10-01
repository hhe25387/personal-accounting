const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createUserTransactionReader = require('./userTransactionReader')

describe('userTransactionReader', () => {
  it('强制使用当前用户 ID 并覆盖任何外部注入值', () => {
    const calls = []
    const service = {
      findTransactions(filters) {
        calls.push(['find', filters])
        return []
      },
      getFinancialSummary(filters) {
        calls.push(['summary', filters])
        return {}
      },
      getCategoryBreakdown(filters) {
        calls.push(['categories', filters])
        return []
      },
    }
    const reader = createUserTransactionReader(service, 7)

    reader.findTransactions({ userId: 999, limit: 5 })
    reader.getFinancialSummary({ userId: 999 })
    reader.getCategoryBreakdown({ userId: 999, type: 'expense' })

    assert.deepEqual(calls, [
      ['find', { userId: 7, limit: 5 }],
      ['summary', { userId: 7 }],
      ['categories', { userId: 7, type: 'expense' }],
    ])
    assert.equal(Object.isFrozen(reader), true)
  })
})
