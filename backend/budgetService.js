const { getMonthRange } = require('./reportingPeriod')

function validateUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError('userId must be a positive integer')
  }
}

function normalizeAmount(value, fieldName, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TypeError(`${fieldName} must be greater than 0`)
  }
  if (amount > 1_000_000_000) {
    throw new TypeError(`${fieldName} is too large`)
  }
  return Math.round(amount * 100)
}

function budgetProgress(limit, spent) {
  const percentage = limit > 0
    ? Number(((spent / limit) * 100).toFixed(2))
    : 0
  return {
    limit,
    spent,
    remaining: limit - spent,
    percentage,
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'safe',
  }
}

function createBudgetService(database, transactionService) {
  function normalizeCategories(userId, categories = []) {
    if (!Array.isArray(categories)) throw new TypeError('categories must be an array')
    if (categories.length > 50) throw new TypeError('A budget can contain at most 50 categories')

    const seen = new Set()
    return categories.map((item, index) => {
      const category = typeof item?.category === 'string' ? item.category.trim() : ''
      if (!category || category.length > 40) {
        throw new TypeError(`categories[${index}].category is invalid`)
      }
      const key = category.toLocaleLowerCase('en-US')
      if (seen.has(key)) throw new TypeError(`Category budget is duplicated: ${category}`)
      seen.add(key)

      const exists = database.prepare(`
        SELECT id FROM categories
        WHERE type = 'expense'
          AND name = ? COLLATE NOCASE
          AND is_active = 1
          AND (is_default = 1 OR user_id = ?)
      `).get(category, userId)
      if (!exists) throw new TypeError(`Expense category is unavailable: ${category}`)

      return {
        category,
        amountCents: normalizeAmount(item.amount, `categories[${index}].amount`),
      }
    })
  }

  function getBudget(userId, month) {
    validateUserId(userId)
    const period = getMonthRange(month)
    const monthlyRow = database.prepare(`
      SELECT total_amount_cents FROM monthly_budgets
      WHERE user_id = ? AND month = ?
    `).get(userId, period.month)
    const categoryRows = database.prepare(`
      SELECT category, amount_cents FROM category_budgets
      WHERE user_id = ? AND month = ?
      ORDER BY id ASC
    `).all(userId, period.month)

    if (!monthlyRow) {
      return {
        ...period,
        configured: false,
        total: null,
        categories: [],
      }
    }

    const filters = {
      userId,
      startDate: period.startDate,
      endDate: period.endDate,
    }
    const summary = transactionService.getFinancialSummary(filters)
    const spendingByCategory = new Map(
      transactionService
        .getCategoryBreakdown({ ...filters, type: 'expense' })
        .map((item) => [item.category.toLocaleLowerCase('en-US'), item.amount]),
    )

    return {
      ...period,
      configured: true,
      total: monthlyRow.total_amount_cents === null
        ? null
        : budgetProgress(monthlyRow.total_amount_cents / 100, summary.totalExpense),
      categories: categoryRows.map((row) =>
        ({
          category: row.category,
          ...budgetProgress(
            row.amount_cents / 100,
            spendingByCategory.get(row.category.toLocaleLowerCase('en-US')) || 0,
          ),
        })),
    }
  }

  function saveBudget(userId, month, input = {}) {
    validateUserId(userId)
    const period = getMonthRange(month)
    const totalAmountCents = normalizeAmount(input.totalAmount, 'totalAmount', {
      optional: true,
    })
    const categories = normalizeCategories(userId, input.categories || [])
    if (totalAmountCents === null && categories.length === 0) {
      throw new TypeError('Set a total budget or at least one category budget')
    }

    database.transaction(() => {
      database.prepare(`
        INSERT INTO monthly_budgets (user_id, month, total_amount_cents)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, month) DO UPDATE SET
          total_amount_cents = excluded.total_amount_cents,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, period.month, totalAmountCents)
      database.prepare(
        'DELETE FROM category_budgets WHERE user_id = ? AND month = ?',
      ).run(userId, period.month)
      const insert = database.prepare(`
        INSERT INTO category_budgets (user_id, month, category, amount_cents)
        VALUES (?, ?, ?, ?)
      `)
      for (const category of categories) {
        insert.run(userId, period.month, category.category, category.amountCents)
      }
    })()

    return getBudget(userId, period.month)
  }

  function deleteBudget(userId, month) {
    validateUserId(userId)
    const period = getMonthRange(month)
    return database.transaction(() => {
      database.prepare(
        'DELETE FROM category_budgets WHERE user_id = ? AND month = ?',
      ).run(userId, period.month)
      return database.prepare(
        'DELETE FROM monthly_budgets WHERE user_id = ? AND month = ?',
      ).run(userId, period.month).changes > 0
    })()
  }

  return { deleteBudget, getBudget, saveBudget }
}

module.exports = createBudgetService
