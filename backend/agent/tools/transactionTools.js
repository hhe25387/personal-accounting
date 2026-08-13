const filterProperties = {
  type: {
    type: 'string',
    enum: ['income', 'expense'],
    description: '账目类型：income 表示收入，expense 表示支出',
  },
  category: {
    type: 'string',
    minLength: 1,
    description: '账目分类，例如餐饮、交通、工资或兼职',
  },
  startDate: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: '查询开始日期，格式为 YYYY-MM-DD',
  },
  endDate: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: '查询结束日期，格式为 YYYY-MM-DD',
  },
}

function createInputSchema({ includeLimit = false } = {}) {
  const properties = { ...filterProperties }

  if (includeLimit) {
    properties.limit = {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: '最多返回多少条账目，默认 100，最大 100',
    }
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
  }
}

function createTransactionTools(transactionService) {
  return [
    {
      name: 'list_transactions',
      description:
        '按账目类型、分类和日期范围查询账目明细，也可用 limit 查询最近几笔账目。',
      inputSchema: createInputSchema({ includeLimit: true }),
      async execute(input = {}) {
        return transactionService.findTransactions(input)
      },
    },
    {
      name: 'get_financial_summary',
      description:
        '计算指定类型、分类或日期范围内的总收入、总支出、余额和账目笔数。',
      inputSchema: createInputSchema(),
      async execute(input = {}) {
        return transactionService.getFinancialSummary(input)
      },
    },
    {
      name: 'get_category_breakdown',
      description:
        '按分类统计指定日期范围内的金额、账目笔数和占比，并按金额从高到低排列；默认分析支出。',
      inputSchema: createInputSchema(),
      async execute(input = {}) {
        return transactionService.getCategoryBreakdown(input)
      },
    },
  ]
}

module.exports = createTransactionTools
