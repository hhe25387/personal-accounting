const createMockProvider = require('./mockProvider')

const providerFactories = {
  mock: () => createMockProvider(),
  deepseek: () => {
    throw new Error(
      'DeepSeek Provider 尚未接入，请先将 AGENT_PROVIDER 设置为 mock',
    )
  },
}

function createProvider(config) {
  if (!config || typeof config.providerName !== 'string') {
    throw new Error('Agent Provider 配置无效')
  }

  const createSelectedProvider = providerFactories[config.providerName]

  if (!createSelectedProvider) {
    throw new Error(`不支持的 Agent Provider：${config.providerName}`)
  }

  return createSelectedProvider(config.providers?.[config.providerName] || {})
}

module.exports = createProvider
