const categoryTranslations = {
  Dining: '餐饮',
  Transport: '交通',
  Shopping: '购物',
  Housing: '住房',
  Entertainment: '娱乐',
  Healthcare: '医疗',
  Education: '教育',
  Utilities: '生活缴费',
  'Other Expense': '其他支出',
  Salary: '工资',
  Bonus: '奖金',
  'Side Income': '副业收入',
  'Investment Income': '投资收入',
  'Gift Money': '礼金',
  Refund: '退款',
  'Other Income': '其他收入',
}

function isChinese(language) {
  return language === 'zh'
}

function formatMoney(value, language) {
  return `¥${Number(value).toLocaleString(isChinese(language) ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatCategory(category, language) {
  return isChinese(language) ? categoryTranslations[category] || category : category
}

function formatSummary(summary, language) {
  if (isChinese(language)) {
    return `收入 ${formatMoney(summary.totalIncome, language)}，支出 ${formatMoney(summary.totalExpense, language)}，结余 ${formatMoney(summary.balance, language)}，共 ${summary.transactionCount} 笔账目。`
  }
  return `Income ${formatMoney(summary.totalIncome, language)}, expenses ${formatMoney(summary.totalExpense, language)}, balance ${formatMoney(summary.balance, language)}, across ${summary.transactionCount} transactions.`
}

function formatDifference(value, language) {
  const amount = formatMoney(Math.abs(value), language)
  if (isChinese(language)) {
    if (value > 0) return `增加 ${amount}`
    if (value < 0) return `减少 ${amount}`
    return '没有变化'
  }
  if (value > 0) return `increased by ${amount}`
  if (value < 0) return `decreased by ${amount}`
  return 'did not change'
}

function countEvidence(toolName, result) {
  if (toolName === 'list_transactions') return result.length
  if (toolName === 'get_category_breakdown') {
    return result.reduce((total, item) => total + item.transactionCount, 0)
  }
  if (toolName === 'get_financial_summary') return result.transactionCount
  if (toolName === 'get_monthly_overview') return result.summary.transactionCount
  if (toolName === 'compare_months') {
    return result.current.summary.transactionCount + result.previous.summary.transactionCount
  }
  return 0
}

function directAnswer({ message, language }) {
  const requestsMutation = /(?:delete|remove|edit|add|record)(?:\s+(?:a|the|my))?\s+(?:transaction|entry)|change\s+(?:a|the|my)\s+(?:transaction|entry)|删除|移除|修改|编辑|新增|添加|记一笔|保存(?:账目|记录)/i.test(message)
  if (requestsMutation) {
    return isChinese(language)
      ? '我目前是只读财务助手，不能新增、修改或删除账目。你可以前往账目页面手动操作。'
      : 'I am currently a read-only financial assistant and cannot add, edit, or delete transactions. Please use the Transactions page for changes.'
  }
  return isChinese(language)
    ? '我可以基于你的账本查询最近账目、收支总额、主要支出分类、本月总结，以及与上月的变化。所有数字都来自当前账户的只读查询。'
    : 'I can analyze recent transactions, totals, top spending categories, this month’s summary, and changes from last month. Every figure comes from a read-only query of your current account.'
}

function formatToolResponse({ message, toolCall, toolResult, language }) {
  let answer

  if (toolCall.name === 'get_financial_summary') {
    answer = isChinese(language)
      ? `根据账本记录：${formatSummary(toolResult, language)}`
      : `Based on your ledger: ${formatSummary(toolResult, language)}`
  }

  if (toolCall.name === 'get_category_breakdown') {
    if (!toolResult.length) {
      answer = isChinese(language)
        ? '当前范围内没有支出可供分析。'
        : 'There are no expenses to analyze in this period.'
    } else {
      const top = toolResult[0]
      answer = isChinese(language)
        ? `${formatCategory(top.category, language)}是支出最多的分类，共 ${formatMoney(top.amount, language)}，占总支出的 ${top.percentage}%，包含 ${top.transactionCount} 笔账目。`
        : `${formatCategory(top.category, language)} is the top spending category at ${formatMoney(top.amount, language)}, representing ${top.percentage}% across ${top.transactionCount} transactions.`
    }
  }

  if (toolCall.name === 'list_transactions') {
    if (!toolResult.length) {
      answer = isChinese(language) ? '当前范围内没有账目。' : 'There are no transactions in this period.'
    } else {
      const entries = toolResult.map((transaction) => {
        const type = transaction.type === 'income'
          ? (isChinese(language) ? '收入' : 'income')
          : (isChinese(language) ? '支出' : 'expense')
        return `${transaction.transactionDate} · ${formatCategory(transaction.category, language)} · ${type} ${formatMoney(transaction.amount, language)}`
      })
      answer = isChinese(language)
        ? `最近 ${toolResult.length} 笔账目：${entries.join('；')}。`
        : `${toolResult.length} recent transactions: ${entries.join('; ')}.`
    }
  }

  if (toolCall.name === 'get_monthly_overview') {
    const top = toolResult.categories[0]
    const wantsAdvice = /advice|save|suggest|省钱|建议|怎么做/i.test(message)
    const summaryText = formatSummary(toolResult.summary, language)
    const topText = top
      ? (isChinese(language)
        ? `最大支出分类是${formatCategory(top.category, language)}，共 ${formatMoney(top.amount, language)}，占 ${top.percentage}%。`
        : `The largest expense category was ${formatCategory(top.category, language)} at ${formatMoney(top.amount, language)} (${top.percentage}%).`)
      : (isChinese(language) ? '本月还没有支出分类数据。' : 'There is no expense category data for this month.')
    const adviceText = wantsAdvice && top
      ? (isChinese(language)
        ? `一个可执行的做法：先检查${formatCategory(top.category, language)}中金额最高或重复出现的项目，选择一项下月减少；我不会替你修改账目或预算。`
        : `One practical next step: review the largest or recurring items in ${formatCategory(top.category, language)} and choose one to reduce next month; I will not change your transactions or budget.`)
      : ''
    answer = isChinese(language)
      ? `${toolResult.period.month} 月总结：${summaryText}${topText}${adviceText}`
      : `${toolResult.period.month} summary: ${summaryText} ${topText}${adviceText ? ` ${adviceText}` : ''}`
  }

  if (toolCall.name === 'compare_months') {
    const current = toolResult.current
    const previous = toolResult.previous
    answer = isChinese(language)
      ? `${current.period.month} 与 ${previous.period.month} 相比：支出${formatDifference(toolResult.change.expense, language)}，收入${formatDifference(toolResult.change.income, language)}。本月${formatSummary(current.summary, language)}`
      : `Compared with ${previous.period.month}, expenses ${formatDifference(toolResult.change.expense, language)} and income ${formatDifference(toolResult.change.income, language)} in ${current.period.month}. This month: ${formatSummary(current.summary, language)}`
  }

  if (!answer) throw new Error(`No grounded formatter for tool: ${toolCall.name}`)

  return {
    answer,
    grounding: {
      readOnly: true,
      source: toolCall.name,
      evidenceCount: countEvidence(toolCall.name, toolResult),
    },
  }
}

formatToolResponse.directAnswer = directAnswer

module.exports = formatToolResponse
