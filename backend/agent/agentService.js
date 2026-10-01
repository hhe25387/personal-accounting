function validateToolInput(input, schema, toolName) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolName} input must be an object`)
  }

  const properties = schema?.properties || {}
  if (schema?.additionalProperties === false) {
    const unknown = Object.keys(input).find((key) => !properties[key])
    if (unknown) throw new TypeError(`${toolName} does not accept input: ${unknown}`)
  }

  for (const [key, value] of Object.entries(input)) {
    const rule = properties[key]
    if (!rule) continue
    if (rule.type === 'string' && typeof value !== 'string') {
      throw new TypeError(`${toolName}.${key} must be a string`)
    }
    if (rule.type === 'integer' && !Number.isInteger(value)) {
      throw new TypeError(`${toolName}.${key} must be an integer`)
    }
    if (rule.enum && !rule.enum.includes(value)) {
      throw new TypeError(`${toolName}.${key} has an unsupported value`)
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      throw new TypeError(`${toolName}.${key} has an invalid format`)
    }
    if (rule.minLength && value.length < rule.minLength) {
      throw new TypeError(`${toolName}.${key} is too short`)
    }
    if (rule.minimum !== undefined && value < rule.minimum) {
      throw new TypeError(`${toolName}.${key} is below the minimum`)
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      throw new TypeError(`${toolName}.${key} exceeds the maximum`)
    }
  }
}

function normalizeFormattedResponse(formatted) {
  if (typeof formatted === 'string') return { answer: formatted }
  if (!formatted || typeof formatted.answer !== 'string' || !formatted.answer.trim()) {
    throw new TypeError('responseFormatter must return an answer')
  }
  return formatted
}

function createAgentService({ provider, tools, responseFormatter = null }) {
  if (!provider || typeof provider.decide !== 'function') {
    throw new TypeError('provider must implement decide')
  }

  if (typeof provider.respond !== 'function') {
    throw new TypeError('provider must implement respond')
  }

  const toolMap = new Map()

  for (const tool of tools) {
    if (toolMap.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`)
    }

    toolMap.set(tool.name, tool)
  }

  const toolDefinitions = tools.map(({ name, description, inputSchema, readOnly }) => ({
    name,
    description,
    inputSchema,
    readOnly: Boolean(readOnly),
  }))

  async function run(message, context = {}) {
    if (typeof message !== 'string' || message.trim() === '') {
      throw new TypeError('User message is required')
    }

    const decision = await provider.decide({
      message: message.trim(),
      tools: toolDefinitions,
      context,
    })

    if (decision.type === 'answer') {
      if (responseFormatter?.directAnswer) {
        const formatted = normalizeFormattedResponse(
          responseFormatter.directAnswer({
            message: message.trim(),
            providerAnswer: decision.answer,
            ...context,
          }),
        )
        return {
          ...formatted,
          toolCall: null,
        }
      }
      return {
        answer: decision.answer,
        toolCall: null,
      }
    }

    if (decision.type !== 'tool_call') {
      throw new Error(`Provider returned an unknown decision type: ${decision.type}`)
    }

    const tool = toolMap.get(decision.toolName)

    if (!tool) {
      throw new Error(`Provider requested an unknown tool: ${decision.toolName}`)
    }

    const input = decision.input || {}
    validateToolInput(input, tool.inputSchema, decision.toolName)
    const result = await tool.execute(input)

    if (responseFormatter) {
      const formatted = normalizeFormattedResponse(
        await responseFormatter({
          message: message.trim(),
          toolCall: { name: decision.toolName, input },
          toolResult: result,
          ...context,
        }),
      )
      return {
        ...formatted,
        toolCall: {
          name: decision.toolName,
          input,
        },
      }
    }

    const answer = await provider.respond({
      message: message.trim(),
      toolCall: {
        name: decision.toolName,
        input,
      },
      toolResult: result,
      context,
    })

    return {
      answer,
      toolCall: {
        name: decision.toolName,
        input,
      },
    }
  }

  return { run }
}

module.exports = createAgentService
