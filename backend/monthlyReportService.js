const { getMonthRange } = require('./reportingPeriod')

function round(value) {
  return Number(value.toFixed(2))
}

function previousMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function compareMetric(current, previous) {
  const difference = round(current - previous)
  return {
    current,
    previous,
    difference,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable',
    percentageChange: previous === 0
      ? null
      : round((difference / Math.abs(previous)) * 100),
  }
}

function createMonthlyReportService(transactionService) {
  function periodFilters(userId, period) {
    return {
      userId,
      startDate: period.startDate,
      endDate: period.endDate,
    }
  }

  function getMonthlyReport(userId, month) {
    const period = getMonthRange(month)
    const priorPeriod = getMonthRange(previousMonth(period.month))
    const currentFilters = periodFilters(userId, period)
    const priorFilters = periodFilters(userId, priorPeriod)
    const summary = transactionService.getFinancialSummary(currentFilters)
    const priorSummary = transactionService.getFinancialSummary(priorFilters)
    const days = transactionService.getDailyBreakdown(currentFilters)
    const categories = transactionService.getCategoryBreakdown({
      ...currentFilters,
      type: 'expense',
    })
    const priorCategories = transactionService.getCategoryBreakdown({
      ...priorFilters,
      type: 'expense',
    })
    const expenses = transactionService.getAllTransactions({
      ...currentFilters,
      type: 'expense',
    })
    const expenseDays = days.filter((day) => day.expense > 0)
    const highestSpendingDay = expenseDays.reduce(
      (highest, day) => (!highest || day.expense > highest.expense ? day : highest),
      null,
    )
    const largestExpense = expenses.reduce(
      (largest, transaction) =>
        (!largest || transaction.amount > largest.amount ? transaction : largest),
      null,
    )
    const priorCategoryAmounts = new Map(
      priorCategories.map((category) => [category.category, category.amount]),
    )
    const currentCategoryAmounts = new Map(
      categories.map((category) => [category.category, category.amount]),
    )
    const categoryNames = new Set([
      ...currentCategoryAmounts.keys(),
      ...priorCategoryAmounts.keys(),
    ])
    const categoryChanges = [...categoryNames]
      .map((category) => ({
        category,
        ...compareMetric(
          currentCategoryAmounts.get(category) || 0,
          priorCategoryAmounts.get(category) || 0,
        ),
      }))
      .sort((first, second) =>
        Math.abs(second.difference) - Math.abs(first.difference) ||
        first.category.localeCompare(second.category),
      )

    return {
      period,
      dataLevel: summary.transactionCount === 0
        ? 'empty'
        : summary.transactionCount < 3
          ? 'basic'
          : 'complete',
      summary: {
        ...summary,
        savingsRate: summary.totalIncome === 0
          ? null
          : round((summary.balance / summary.totalIncome) * 100),
      },
      activity: {
        activeDays: days.length,
        spendingDays: expenseDays.length,
        averagePerSpendingDay: expenseDays.length === 0
          ? 0
          : round(summary.totalExpense / expenseDays.length),
        highestSpendingDay,
      },
      topCategory: categories[0] || null,
      largestExpense,
      comparison: {
        period: priorPeriod,
        hasPreviousData: priorSummary.transactionCount > 0,
        expense: compareMetric(summary.totalExpense, priorSummary.totalExpense),
        income: compareMetric(summary.totalIncome, priorSummary.totalIncome),
        balance: compareMetric(summary.balance, priorSummary.balance),
      },
      largestCategoryChange: categoryChanges[0] || null,
      categoryChanges,
    }
  }

  return { getMonthlyReport }
}

module.exports = createMonthlyReportService
