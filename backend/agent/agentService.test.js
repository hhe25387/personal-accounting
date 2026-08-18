const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createAgentService = require('./agentService')

function createTool(name, result) {
  const calls = []

  return {
    calls,
    name,
    description: `${name} 测试工具`,
    inputSchema: { type: 'object', properties: {} },
    async execute(input) {
      calls.push(input)
      return result
    },
  }
}

describe('agentService', () => {
  it('允许 Provider 不调用工具直接回答', async () => {
    const provider = {
      async decide() {
        return { type: 'answer', answer: '直接回答' }
      },
      async respond() {
        throw new Error('不应该调用 respond')
      },
    }
    const agent = createAgentService({ provider, tools: [] })

    assert.deepEqual(await agent.run('你好'), {
      answer: '直接回答',
      toolCall: null,
    })
  })

  it('执行 Provider 选择的工具并生成最终回答', async () => {
    const tool = createTool('get_financial_summary', { balance: 75 })
    const provider = {
      async decide({ message, tools }) {
        assert.equal(message, '余额是多少？')
        assert.equal(tools[0].name, 'get_financial_summary')
        assert.equal(tools[0].execute, undefined)

        return {
          type: 'tool_call',
          toolName: 'get_financial_summary',
          input: { startDate: '2026-08-01' },
        }
      },
      async respond({ toolResult }) {
        return `余额是 ${toolResult.balance}`
      },
    }
    const agent = createAgentService({ provider, tools: [tool] })

    assert.deepEqual(await agent.run('余额是多少？'), {
      answer: '余额是 75',
      toolCall: {
        name: 'get_financial_summary',
        input: { startDate: '2026-08-01' },
      },
    })
    assert.deepEqual(tool.calls, [{ startDate: '2026-08-01' }])
  })

  it('拒绝 Provider 请求unknown tool', async () => {
    const provider = {
      async decide() {
        return { type: 'tool_call', toolName: 'delete_everything', input: {} }
      },
      async respond() {
        return '不应该执行'
      },
    }
    const agent = createAgentService({ provider, tools: [] })

    await assert.rejects(() => agent.run('删除全部数据'), /unknown tool/)
  })

  it('拒绝空消息和重复工具名称', async () => {
    const provider = {
      async decide() {
        return { type: 'answer', answer: 'ok' }
      },
      async respond() {
        return 'ok'
      },
    }
    const duplicateTools = [createTool('same', []), createTool('same', [])]

    assert.throws(
      () => createAgentService({ provider, tools: duplicateTools }),
      /Duplicate tool name/,
    )

    const agent = createAgentService({ provider, tools: [] })
    await assert.rejects(() => agent.run('   '), /User message is required/)
  })

  it('在执行前拒绝 Provider 注入未知过滤条件', async () => {
    const tool = {
      ...createTool('list_transactions', []),
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
        additionalProperties: false,
      },
    }
    const provider = {
      async decide() {
        return {
          type: 'tool_call',
          toolName: 'list_transactions',
          input: { userId: 999 },
        }
      },
      async respond() {
        return '不应执行'
      },
    }
    const agent = createAgentService({ provider, tools: [tool] })

    await assert.rejects(() => agent.run('查看其他用户'), /does not accept input: userId/)
    assert.deepEqual(tool.calls, [])
  })
})
