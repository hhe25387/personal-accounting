function createAgentService({ provider, tools }) {
  if (!provider || typeof provider.decide !== 'function') {
    throw new TypeError('provider 必须提供 decide 方法')
  }

  if (typeof provider.respond !== 'function') {
    throw new TypeError('provider 必须提供 respond 方法')
  }

  const toolMap = new Map()

  for (const tool of tools) {
    if (toolMap.has(tool.name)) {
      throw new Error(`工具名称重复：${tool.name}`)
    }

    toolMap.set(tool.name, tool)
  }

  const toolDefinitions = tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }))

  async function run(message) {
    if (typeof message !== 'string' || message.trim() === '') {
      throw new TypeError('用户消息不能为空')
    }

    const decision = await provider.decide({
      message: message.trim(),
      tools: toolDefinitions,
    })

    if (decision.type === 'answer') {
      return {
        answer: decision.answer,
        toolCall: null,
      }
    }

    if (decision.type !== 'tool_call') {
      throw new Error(`Provider 返回了未知决定类型：${decision.type}`)
    }

    const tool = toolMap.get(decision.toolName)

    if (!tool) {
      throw new Error(`Provider 请求了未知工具：${decision.toolName}`)
    }

    const input = decision.input || {}
    const result = await tool.execute(input)
    const answer = await provider.respond({
      message: message.trim(),
      toolCall: {
        name: decision.toolName,
        input,
      },
      toolResult: result,
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
