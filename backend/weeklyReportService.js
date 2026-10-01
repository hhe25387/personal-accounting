const { getWeekRange } = require('./reportingPeriod')

function round(value) {
  return Number(value.toFixed(2))
}

function shiftDate(value, days) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function compareExpense(current, previous) {
  const difference = round(current - previous)
  return {
    current,
    previous,
    difference,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable',
    percentageChange: previous === 0
      ? null
      : round((difference / previous) * 100),
  }
}

function createWeeklyReportService(transactionService) {
  function getWeeklyReport(userId, date) {
    const period = getWeekRange(date)
    const previousPeriod = getWeekRange(shiftDate(period.anchorDate, -7))
    const currentFilters = {
      userId,
      startDate: period.startDate,
      endDate: period.throughDate,
    }
    const previousFilters = {
      userId,
      startDate: previousPeriod.startDate,
      endDate: previousPeriod.throughDate,
    }
    const summary = transactionService.getFinancialSummary(currentFilters)
    const previousSummary = transactionService.getFinancialSummary(previousFilters)
    const days = transactionService.getDailyBreakdown(currentFilters)
    const categories = transactionService.getCategoryBreakdown({
      ...currentFilters,
      type: 'expense',
    })
    const expenses = transactionService.getAllTransactions({
      ...currentFilters,
      type: 'expense',
    })
    const largestExpense = expenses.reduce(
      (largest, transaction) =>
        (!largest || transaction.amount > largest.amount ? transaction : largest),
      null,
    )

    return {
      period,
      dataLevel: summary.transactionCount === 0
        ? 'empty'
        : summary.transactionCount < 3
          ? 'basic'
          : 'complete',
      summary,
      comparison: {
        period: previousPeriod,
        hasPreviousData: previousSummary.transactionCount > 0,
        hasPreviousExpenseData: previousSummary.totalExpense > 0,
        expense: compareExpense(summary.totalExpense, previousSummary.totalExpense),
      },
      topCategories: categories.slice(0, 3),
      largestExpense,
      days,
    }
  }

  return { getWeeklyReport }
}

module.exports = createWeeklyReportService
