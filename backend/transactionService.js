function formatTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount_cents / 100,
    category: row.category,
    transactionDate: row.transaction_date,
    description: row.description,
    createdAt: row.created_at,
  }
}

const allowedFilterNames = new Set([
  'type',
  'category',
  'startDate',
  'endDate',
  'limit',
])

function validateDate(date, fieldName) {
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError(`${fieldName} 必须使用 YYYY-MM-DD 格式`)
  }
}

function normalizeFilters(filters = {}) {
  for (const filterName of Object.keys(filters)) {
    if (!allowedFilterNames.has(filterName)) {
      throw new TypeError(`不支持筛选字段：${filterName}`)
    }
  }

  if (
    filters.type !== undefined &&
    !['income', 'expense'].includes(filters.type)
  ) {
    throw new TypeError('type 必须是 income 或 expense')
  }

  if (
    filters.category !== undefined &&
    (typeof filters.category !== 'string' || filters.category.trim() === '')
  ) {
    throw new TypeError('category 必须是非空字符串')
  }

  validateDate(filters.startDate, 'startDate')
  validateDate(filters.endDate, 'endDate')

  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  ) {
    throw new TypeError('startDate 不能晚于 endDate')
  }

  const limit = filters.limit === undefined ? 100 : Number(filters.limit)

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('limit 必须是 1 到 100 之间的整数')
  }

  return {
    ...filters,
    category: filters.category?.trim(),
    limit,
  }
}

function buildWhereClause(filters) {
  const conditions = []
  const parameters = []

  if (filters.type) {
    conditions.push('type = ?')
    parameters.push(filters.type)
  }

  if (filters.category) {
    conditions.push('category = ?')
    parameters.push(filters.category)
  }

  if (filters.startDate) {
    conditions.push('transaction_date >= ?')
    parameters.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('transaction_date <= ?')
    parameters.push(filters.endDate)
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    parameters,
  }
}

function createTransactionService(database) {
  function getAllTransactions() {
    const rows = database
      .prepare(`
        SELECT *
        FROM transactions
        ORDER BY transaction_date DESC, id DESC
      `)
      .all()

    return rows.map(formatTransaction)
  }

  function createTransaction(transaction) {
    const amountCents = Math.round(Number(transaction.amount) * 100)
    const result = database
      .prepare(`
        INSERT INTO transactions (
          type,
          amount_cents,
          category,
          transaction_date,
          description
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        transaction.type,
        amountCents,
        transaction.category,
        transaction.transactionDate,
        transaction.description || null,
      )

    return {
      id: Number(result.lastInsertRowid),
      ...transaction,
      amount: Number(transaction.amount),
    }
  }

  function updateTransaction(transactionId, transaction) {
    const amountCents = Math.round(Number(transaction.amount) * 100)
    const result = database
      .prepare(`
        UPDATE transactions
        SET
          type = ?,
          amount_cents = ?,
          category = ?,
          transaction_date = ?,
          description = ?
        WHERE id = ?
      `)
      .run(
        transaction.type,
        amountCents,
        transaction.category,
        transaction.transactionDate,
        transaction.description || null,
        transactionId,
      )

    if (result.changes === 0) {
      return null
    }

    return {
      id: transactionId,
      ...transaction,
      amount: Number(transaction.amount),
    }
  }

  function deleteTransaction(transactionId) {
    const result = database
      .prepare('DELETE FROM transactions WHERE id = ?')
      .run(transactionId)

    return result.changes > 0
  }

  function findTransactions(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const rows = database
      .prepare(`
        SELECT *
        FROM transactions
        ${where.sql}
        ORDER BY transaction_date DESC, id DESC
        LIMIT ?
      `)
      .all(...where.parameters, normalizedFilters.limit)

    return rows.map(formatTransaction)
  }

  function getFinancialSummary(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const row = database
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents END), 0)
            AS total_income_cents,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0)
            AS total_expense_cents,
          COUNT(*) AS transaction_count
        FROM transactions
        ${where.sql}
      `)
      .get(...where.parameters)

    const totalIncome = row.total_income_cents / 100
    const totalExpense = row.total_expense_cents / 100

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: row.transaction_count,
    }
  }

  function getCategoryBreakdown(filters = {}) {
    const normalizedFilters = normalizeFilters({
      ...filters,
      type: filters.type || 'expense',
    })
    const where = buildWhereClause(normalizedFilters)
    const rows = database
      .prepare(`
        SELECT
          category,
          SUM(amount_cents) AS total_amount_cents,
          COUNT(*) AS transaction_count
        FROM transactions
        ${where.sql}
        GROUP BY category
        ORDER BY total_amount_cents DESC, category ASC
      `)
      .all(...where.parameters)
    const grandTotalCents = rows.reduce(
      (total, row) => total + row.total_amount_cents,
      0,
    )

    return rows.map((row) => ({
      category: row.category,
      amount: row.total_amount_cents / 100,
      transactionCount: row.transaction_count,
      percentage:
        grandTotalCents === 0
          ? 0
          : Number(
              ((row.total_amount_cents / grandTotalCents) * 100).toFixed(2),
            ),
    }))
  }

  return {
    createTransaction,
    deleteTransaction,
    findTransactions,
    getCategoryBreakdown,
    getAllTransactions,
    getFinancialSummary,
    updateTransaction,
  }
}

module.exports = createTransactionService
