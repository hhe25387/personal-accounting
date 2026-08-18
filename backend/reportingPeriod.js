function getCurrentMonth(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function getMonthRange(month = getCurrentMonth()) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new TypeError('month must use YYYY-MM format')
  }

  const [year, monthNumber] = month.split('-').map(Number)

  if (monthNumber < 1 || monthNumber > 12) {
    throw new TypeError('month must be a valid month')
  }

  const lastDay = new Date(year, monthNumber, 0).getDate()

  return {
    month,
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

module.exports = { getCurrentMonth, getMonthRange }
