const filterProperties = {
  type: {
    type: 'string',
    enum: ['income', 'expense'],
    description: 'Transaction type: income or expense',
  },
  category: {
    type: 'string',
    minLength: 1,
    description: 'Transaction category, such as Dining, Transport, Salary, or Side Income',
  },
  startDate: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: 'Start date in YYYY-MM-DD format',
  },
  endDate: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: 'End date in YYYY-MM-DD format',
  },
}

function createInputSchema({ includeLimit = false } = {}) {
  const properties = { ...filterProperties }

  if (includeLimit) {
    properties.limit = {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'Maximum entries to return; default and maximum are 100',
    }
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
  }
}

function monthSchema() {
  return {
    type: 'object',
    properties: {
      month: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}$',
        description: 'Month in YYYY-MM format; defaults to the current month',
      },
    },
    additionalProperties: false,
  }
}

function previousMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function createTransactionTools(transactionService, { now = () => new Date() } = {}) {
  const resolveMonth = (input = {}) => input.month || getCurrentMonth(now())

  return [
    {
      name: 'list_transactions',
      readOnly: true,
      description:
        'List transactions by type, category, and date range. Use limit to return recent entries.',
      inputSchema: createInputSchema({ includeLimit: true }),
      async execute(input = {}) {
        return transactionService.findTransactions(input)
      },
    },
    {
      name: 'get_financial_summary',
      readOnly: true,
      description:
        'Calculate total income, expenses, balance, and transaction count for the selected filters.',
      inputSchema: createInputSchema(),
      async execute(input = {}) {
        return transactionService.getFinancialSummary(input)
      },
    },
    {
      name: 'get_category_breakdown',
      readOnly: true,
      description:
        'Summarize amounts, transaction counts, and percentages by category for a date range, sorted by amount descending. Defaults to expenses.',
      inputSchema: createInputSchema(),
      async execute(input = {}) {
        return transactionService.getCategoryBreakdown(input)
      },
    },
    {
      name: 'get_monthly_overview',
      readOnly: true,
      description:
        'Return an authoritative monthly summary and expense category breakdown. Use for monthly summaries and practical suggestions.',
      inputSchema: monthSchema(),
      async execute(input = {}) {
        const period = getMonthRange(resolveMonth(input))
        const filters = { startDate: period.startDate, endDate: period.endDate }
        return {
          period,
          summary: await transactionService.getFinancialSummary(filters),
          categories: await transactionService.getCategoryBreakdown({
            ...filters,
            type: 'expense',
          }),
        }
      },
    },
    {
      name: 'compare_months',
      readOnly: true,
      description:
        'Compare authoritative income, expenses, balance, and transaction counts between a selected month and the previous month.',
      inputSchema: monthSchema(),
      async execute(input = {}) {
        const currentPeriod = getMonthRange(resolveMonth(input))
        const previousPeriod = getMonthRange(previousMonth(currentPeriod.month))
        const currentSummary = await transactionService.getFinancialSummary({
          startDate: currentPeriod.startDate,
          endDate: currentPeriod.endDate,
        })
        const previousSummary = await transactionService.getFinancialSummary({
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
        })
        return {
          current: { period: currentPeriod, summary: currentSummary },
          previous: { period: previousPeriod, summary: previousSummary },
          change: {
            income: currentSummary.totalIncome - previousSummary.totalIncome,
            expense: currentSummary.totalExpense - previousSummary.totalExpense,
            balance: currentSummary.balance - previousSummary.balance,
          },
        }
      },
    },
  ]
}

module.exports = createTransactionTools
const { getCurrentMonth, getMonthRange } = require('../../reportingPeriod')
