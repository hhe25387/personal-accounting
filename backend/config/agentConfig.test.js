const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const loadAgentConfig = require('./agentConfig')

describe('agentConfig', () => {
  it('没有配置时默认使用 Mock Provider', () => {
    assert.deepEqual(loadAgentConfig({}), {
      providerName: 'mock',
      providers: {
        deepseek: {
          apiKey: null,
          model: null,
        },
      },
    })
  })

  it('整理 Provider 名称和 DeepSeek 配置', () => {
    assert.deepEqual(
      loadAgentConfig({
        AGENT_PROVIDER: '  DeepSeek ',
        DEEPSEEK_API_KEY: ' secret-key ',
        DEEPSEEK_MODEL: ' deepseek-chat ',
      }),
      {
        providerName: 'deepseek',
        providers: {
          deepseek: {
            apiKey: 'secret-key',
            model: 'deepseek-chat',
          },
        },
      },
    )
  })
})
