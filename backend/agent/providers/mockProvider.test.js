const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createMockProvider = require('./mockProvider')

describe('mockProvider', () => {
  it('分类问题选择分类统计工具', async () => {
    const provider = createMockProvider()

    assert.deepEqual(await provider.decide({ message: 'Which category has the most spending?' }), {
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

    assert.equal(answer, '餐饮 is the top spending category at $120.50, representing 60.25%.')
  })

  it('识别中文分类、月度比较和总结建议问题', async () => {
    const provider = createMockProvider()

    assert.equal(
      (await provider.decide({ message: '哪个分类支出最多？', context: { language: 'zh' } })).toolName,
      'get_category_breakdown',
    )
    assert.equal(
      (await provider.decide({ message: '这个月和上个月相比怎么样？', context: { language: 'zh' } })).toolName,
      'compare_months',
    )
    assert.equal(
      (await provider.decide({ message: '总结本月并给我省钱建议', context: { language: 'zh' } })).toolName,
      'get_monthly_overview',
    )
  })
})
