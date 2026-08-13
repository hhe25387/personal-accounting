function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`
}

function createMockProvider() {
  async function decide({ message }) {
    if (/分类|板块|哪.*最多|占比/.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'get_category_breakdown',
        input: { type: 'expense' },
      }
    }

    if (/最近|账目|记录|明细/.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'list_transactions',
        input: { limit: 5 },
      }
    }

    if (/收入|支出|余额|汇总|一共|总共/.test(message)) {
      return {
        type: 'tool_call',
        toolName: 'get_financial_summary',
        input: {},
      }
    }

    return {
      type: 'answer',
      answer:
        '这是本地 Mock Agent。目前可以查询最近账目、收支汇总和支出分类占比。',
    }
  }

  async function respond({ toolCall, toolResult }) {
    if (toolCall.name === 'get_financial_summary') {
      return [
        `总收入 ${formatMoney(toolResult.totalIncome)}`,
        `总支出 ${formatMoney(toolResult.totalExpense)}`,
        `当前余额 ${formatMoney(toolResult.balance)}`,
        `共 ${toolResult.transactionCount} 笔账目。`,
      ].join('，')
    }

    if (toolCall.name === 'get_category_breakdown') {
      if (toolResult.length === 0) {
        return '目前没有可分析的支出记录。'
      }

      const largestCategory = toolResult[0]
      return `${largestCategory.category}是支出最多的分类，共 ${formatMoney(
        largestCategory.amount,
      )}，占 ${largestCategory.percentage}%。`
    }

    if (toolCall.name === 'list_transactions') {
      if (toolResult.length === 0) {
        return '目前还没有账目记录。'
      }

      return `找到了 ${toolResult.length} 笔最近账目：${toolResult
        .map(
          (transaction) =>
            `${transaction.transactionDate} ${transaction.category} ${formatMoney(
              transaction.amount,
            )}`,
        )
        .join('；')}。`
    }

    throw new Error(`Mock Provider 无法处理工具结果：${toolCall.name}`)
  }

  return {
    decide,
    respond,
  }
}

module.exports = createMockProvider
