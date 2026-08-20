function getCurrentMonth(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('date must use YYYY-MM-DD format')
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new TypeError('date must be a valid calendar date')
  }
  return date
}

function getWeekRange(date = formatLocalDate(new Date())) {
  const anchor = parseDate(date)
  const weekday = anchor.getDay() || 7
  const start = new Date(anchor)
  start.setDate(anchor.getDate() - weekday + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    anchorDate: date,
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    throughDate: date,
  }
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

module.exports = { getCurrentMonth, getMonthRange, getWeekRange }
