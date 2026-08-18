const createMockProvider = require('./mockProvider')

const providerFactories = {
  mock: () => createMockProvider(),
  deepseek: () => {
    throw new Error(
      'DeepSeek Provider is not connected yet. Set AGENT_PROVIDER to mock.',
    )
  },
}

function createProvider(config) {
  if (!config || typeof config.providerName !== 'string') {
    throw new Error('Invalid Agent Provider configuration')
  }

  const createSelectedProvider = providerFactories[config.providerName]

  if (!createSelectedProvider) {
    throw new Error(`Unsupported Agent Provider: ${config.providerName}`)
  }

  return createSelectedProvider(config.providers?.[config.providerName] || {})
}

module.exports = createProvider
