function readOptionalValue(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue || null
}

function loadAgentConfig(environment = process.env) {
  const providerName =
    readOptionalValue(environment.AGENT_PROVIDER)?.toLowerCase() || 'mock'

  return {
    providerName,
    providers: {
      deepseek: {
        apiKey: readOptionalValue(environment.DEEPSEEK_API_KEY),
        model: readOptionalValue(environment.DEEPSEEK_MODEL),
      },
    },
  }
}

module.exports = loadAgentConfig
