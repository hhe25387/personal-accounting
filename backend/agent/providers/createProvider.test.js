const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const createProvider = require('./createProvider')

describe('createProvider', () => {
  it('根据配置创建 Mock Provider', () => {
    const provider = createProvider({
      providerName: 'mock',
      providers: {},
    })

    assert.equal(typeof provider.decide, 'function')
    assert.equal(typeof provider.respond, 'function')
  })

  it('拒绝未知 Provider', () => {
    assert.throws(
      () =>
        createProvider({
          providerName: 'unknown',
          providers: {},
        }),
      /不支持的 Agent Provider：unknown/,
    )
  })

  it('选择尚未接入的 DeepSeek 时给出明确提示', () => {
    assert.throws(
      () =>
        createProvider({
          providerName: 'deepseek',
          providers: {
            deepseek: {
              apiKey: 'secret-key',
              model: 'deepseek-chat',
            },
          },
        }),
      /DeepSeek Provider 尚未接入/,
    )
  })
})
