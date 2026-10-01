function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`
}

function createMockProvider() {
  async function decide({ message, context = {} }) {
    const language = context.language === 'zh' ? 'zh' : 'en'

    if (/(?:delete|remove|edit|add|record)(?:\s+(?:a|the|my))?\s+(?:transaction|entry)|change\s+(?:a|the|my)\s+(?:transaction|entry)|删除|移除|修改|编辑|新增|添加|记一笔|保存(?:账目|记录)/i.test(message)) {
      return { type: 'answer', answer: language === 'zh' ? '只读模式' : 'Read-only mode' }
    }

    if (/last month|compare|comparison|change|trend|上个月|上月|相比|比较|变化|趋势/i.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'compare_months',
        input: {},
      }
    }

    if (/category|where.*most|top spending|percentage|分类|哪.*(?:花|支出).*多|占比/i.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'get_category_breakdown',
        input: { type: 'expense' },
      }
    }

    if (/recent|transaction|entries|details|最近|账目|交易|明细|记录/i.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'list_transactions',
        input: { limit: 5 },
      }
    }

    if (/this month|monthly|summary|advice|suggest|save money|本月|这个月|月度|总结|建议|省钱|怎么做/i.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'get_monthly_overview',
        input: {},
      }
    }

    if (/income|expense|balance|total|收入|支出|结余|余额|总额|汇总/i.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'get_financial_summary',
        input: {},
      }
    }

    return {
      type: 'answer',
      answer: language === 'zh'
        ? '我可以查询最近账目、收支总额、主要支出分类和月度变化。'
        : 'I can show recent transactions, totals, top spending categories, and monthly changes.',
    }
  }

  async function respond({ toolCall, toolResult }) {
    if (toolCall.name === 'get_financial_summary') {
      return [
        `Total income: ${formatMoney(toolResult.totalIncome)}`,
        `Total expenses: ${formatMoney(toolResult.totalExpense)}`,
        `Current balance: ${formatMoney(toolResult.balance)}`,
        `${toolResult.transactionCount} transactions`,
      ].join(', ')
    }

    if (toolCall.name === 'get_category_breakdown') {
      if (toolResult.length === 0) {
        return 'There are no expenses to analyze yet.'
      }

      const largestCategory = toolResult[0]
      return `${largestCategory.category} is the top spending category at ${formatMoney(
        largestCategory.amount,
      )}, representing ${largestCategory.percentage}%.`
    }

    if (toolCall.name === 'list_transactions') {
      if (toolResult.length === 0) {
        return 'There are no transactions yet.'
      }

      return `Found ${toolResult.length} recent transactions: ${toolResult
        .map(
          (transaction) =>
            `${transaction.transactionDate} ${transaction.category} ${formatMoney(
              transaction.amount,
            )}`,
        )
        .join('; ')}.`
    }

    throw new Error(`Mock Provider cannot process tool result: ${toolCall.name}`)
  }

  return {
    decide,
    respond,
  }
}

module.exports = createMockProvider
