function createUserTransactionReader(transactionService, userId) {
  if (!transactionService) throw new TypeError('transactionService is required')
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError('userId must be a positive integer')
  }

  const withUser = (filters = {}) => ({ ...filters, userId })

  return Object.freeze({
    findTransactions: (filters = {}) =>
      transactionService.findTransactions(withUser(filters)),
    getFinancialSummary: (filters = {}) =>
      transactionService.getFinancialSummary(withUser(filters)),
    getCategoryBreakdown: (filters = {}) =>
      transactionService.getCategoryBreakdown(withUser(filters)),
  })
}

module.exports = createUserTransactionReader
