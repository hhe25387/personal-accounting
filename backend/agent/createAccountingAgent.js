const createAgentService = require('./agentService')
const createTransactionTools = require('./tools/transactionTools')

function createAccountingAgent({ provider, transactionService }) {
  const tools = createTransactionTools(transactionService)

  return createAgentService({
    provider,
    tools,
  })
}

module.exports = createAccountingAgent
