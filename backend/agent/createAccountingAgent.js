const createAgentService = require('./agentService')
const createGroundedResponse = require('./groundedResponse')
const createTransactionTools = require('./tools/transactionTools')

function createAccountingAgent({ provider, transactionService, now }) {
  const tools = createTransactionTools(transactionService, { now })

  if (tools.some((tool) => tool.readOnly !== true)) {
    throw new Error('Accounting Agent accepts read-only tools only')
  }

  return createAgentService({
    provider,
    tools,
    responseFormatter: createGroundedResponse,
  })
}

module.exports = createAccountingAgent
