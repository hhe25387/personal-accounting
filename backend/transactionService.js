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
  'keyword',
  'startDate',
  'endDate',
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
  'userId',
])

function validateDate(date, fieldName) {
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError(`${fieldName}  must use YYYY-MM-DD format`)
  }
}

function normalizeFilters(filters = {}) {
  for (const filterName of Object.keys(filters)) {
    if (!allowedFilterNames.has(filterName)) {
      throw new TypeError(`Unsupported filter: ${filterName}`)
    }
  }

  if (
    filters.type !== undefined &&
    !['income', 'expense'].includes(filters.type)
  ) {
    throw new TypeError('type must be income or expense')
  }

  if (
    filters.category !== undefined &&
    (typeof filters.category !== 'string' || filters.category.trim() === '')
  ) {
    throw new TypeError('category must be a non-empty string')
  }

  if (
    filters.keyword !== undefined &&
    (typeof filters.keyword !== 'string' ||
      filters.keyword.trim() === '' ||
      filters.keyword.trim().length > 80)
  ) {
    throw new TypeError('keyword must be 1 to 80 characters')
  }

  validateDate(filters.startDate, 'startDate')
  validateDate(filters.endDate, 'endDate')

  if (
    filters.userId !== undefined &&
    (!Number.isInteger(filters.userId) || filters.userId <= 0)
  ) {
    throw new TypeError('userId  must be a positive integer')
  }

  if (
    filters.sortBy !== undefined &&
    !['date', 'amount'].includes(filters.sortBy)
  ) {
    throw new TypeError('sortBy must be date or amount')
  }

  if (
    filters.sortOrder !== undefined &&
    !['asc', 'desc'].includes(filters.sortOrder)
  ) {
    throw new TypeError('sortOrder must be asc or desc')
  }

  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  ) {
    throw new TypeError('startDate cannot be after endDate')
  }

  const limit = filters.limit === undefined ? 100 : Number(filters.limit)

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('limit must be an integer from 1 to 100')
  }

  const offset = filters.offset === undefined ? 0 : Number(filters.offset)
  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError('offset must be an integer greater than or equal to 0')
  }

  return {
    ...filters,
    category: filters.category?.trim(),
    keyword: filters.keyword?.trim(),
    limit,
    offset,
    sortBy: filters.sortBy || 'date',
    sortOrder: filters.sortOrder || 'desc',
  }
}

function buildWhereClause(filters) {
  const conditions = []
  const parameters = []

  if (filters.userId) {
    conditions.push('user_id = ?')
    parameters.push(filters.userId)
  }

  if (filters.type) {
    conditions.push('type = ?')
    parameters.push(filters.type)
  }

  if (filters.category) {
    conditions.push('category = ?')
    parameters.push(filters.category)
  }

  if (filters.keyword) {
    const escapedKeyword = filters.keyword.replace(/[\\%_]/g, '\\$&')
    conditions.push(
      `(category LIKE ? ESCAPE '\\' OR COALESCE(description, '') LIKE ? ESCAPE '\\')`,
    )
    parameters.push(`%${escapedKeyword}%`, `%${escapedKeyword}%`)
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

function buildOrderClause(filters) {
  const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC'
  if (filters.sortBy === 'amount') {
    return `ORDER BY amount_cents ${direction}, transaction_date DESC, id DESC`
  }
  return `ORDER BY transaction_date ${direction}, id ${direction}`
}

function createTransactionService(database) {
  function getTransactionById(transactionId, userId) {
    const ownershipClause = userId ? ' AND user_id = ?' : ''
    const parameters = userId ? [transactionId, userId] : [transactionId]
    const row = database
      .prepare(`SELECT * FROM transactions WHERE id = ?${ownershipClause}`)
      .get(...parameters)

    return row ? formatTransaction(row) : null
  }

  function getAllTransactions(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const order = buildOrderClause(normalizedFilters)
    const rows = database
      .prepare(`
        SELECT *
        FROM transactions
        ${where.sql}
        ${order}
      `)
      .all(...where.parameters)

    return rows.map(formatTransaction)
  }

  function createTransaction(transaction) {
    const amountCents = Math.round(Number(transaction.amount) * 100)
    const result = database
      .prepare(`
        INSERT INTO transactions (
          user_id,
          type,
          amount_cents,
          category,
          transaction_date,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        transaction.userId || null,
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

  function updateTransaction(transactionId, transaction, userId) {
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
        WHERE id = ?${userId ? ' AND user_id = ?' : ''}
      `)
      .run(
        transaction.type,
        amountCents,
        transaction.category,
        transaction.transactionDate,
        transaction.description || null,
        transactionId,
        ...(userId ? [userId] : []),
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

  function deleteTransaction(transactionId, userId) {
    const ownershipClause = userId ? ' AND user_id = ?' : ''
    const parameters = userId ? [transactionId, userId] : [transactionId]
    const result = database
      .prepare(`DELETE FROM transactions WHERE id = ?${ownershipClause}`)
      .run(...parameters)

    return result.changes > 0
  }

  function findTransactions(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const order = buildOrderClause(normalizedFilters)
    const rows = database
      .prepare(`
        SELECT *
        FROM transactions
        ${where.sql}
        ${order}
        LIMIT ?
      `)
      .all(...where.parameters, normalizedFilters.limit)

    return rows.map(formatTransaction)
  }

  function getTransactionPage(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const order = buildOrderClause(normalizedFilters)
    const transactions = database
      .prepare(`
        SELECT *
        FROM transactions
        ${where.sql}
        ${order}
        LIMIT ? OFFSET ?
      `)
      .all(
        ...where.parameters,
        normalizedFilters.limit,
        normalizedFilters.offset,
      )
      .map(formatTransaction)
    const total = database
      .prepare(`SELECT COUNT(*) AS count FROM transactions ${where.sql}`)
      .get(...where.parameters).count

    return {
      transactions,
      pagination: {
        total,
        limit: normalizedFilters.limit,
        offset: normalizedFilters.offset,
        hasMore: normalizedFilters.offset + transactions.length < total,
      },
    }
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

  function getDailyBreakdown(filters = {}) {
    const normalizedFilters = normalizeFilters(filters)
    const where = buildWhereClause(normalizedFilters)
    const rows = database
      .prepare(`
        SELECT
          transaction_date,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents END), 0)
            AS income_cents,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0)
            AS expense_cents,
          COUNT(*) AS transaction_count
        FROM transactions
        ${where.sql}
        GROUP BY transaction_date
        ORDER BY transaction_date ASC
      `)
      .all(...where.parameters)

    return rows.map((row) => ({
      date: row.transaction_date,
      income: row.income_cents / 100,
      expense: row.expense_cents / 100,
      transactionCount: row.transaction_count,
    }))
  }

  return {
    createTransaction,
    deleteTransaction,
    findTransactions,
    getCategoryBreakdown,
    getDailyBreakdown,
    getAllTransactions,
    getFinancialSummary,
    getTransactionPage,
    getTransactionById,
    updateTransaction,
  }
}

module.exports = createTransactionService
