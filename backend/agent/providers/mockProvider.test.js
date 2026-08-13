const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createMockProvider = require('./mockProvider')

describe('mockProvider', () => {
  it('分类问题选择分类统计工具', async () => {
    const provider = createMockProvider()

    assert.deepEqual(await provider.decide({ message: '哪个板块花得最多？' }), {
      type: 'tool_call',
      toolName: 'get_category_breakdown',
      input: { type: 'expense' },
    })
  })

  it('根据分类结果生成固定回答', async () => {
    const provider = createMockProvider()
    const answer = await provider.respond({
      toolCall: { name: 'get_category_breakdown' },
      toolResult: [
        { category: '餐饮', amount: 120.5, percentage: 60.25 },
      ],
    })

    assert.equal(answer, '餐饮是支出最多的分类，共 $120.50，占 60.25%。')
  })
})
