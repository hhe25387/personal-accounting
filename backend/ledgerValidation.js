const MAX_TRANSACTION_AMOUNT = 1_000_000_000
const MAX_TRANSACTION_NOTE_LENGTH = 500

function normalizeUserId(userId, { optional = false } = {}) {
  if (optional && (userId === undefined || userId === null)) return null
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError('userId must be a positive integer')
  }
  return userId
}

function normalizeEntryType(type, fieldName = 'Type') {
  if (!['income', 'expense'].includes(type)) {
    throw new TypeError(`${fieldName} must be income or expense`)
  }
  return type
}

function normalizeAmount(
  value,
  { fieldName = 'Amount', maximum = MAX_TRANSACTION_AMOUNT, optional = false } = {},
) {
  if (optional && (value === undefined || value === null || value === '')) {
    return { amount: null, amountCents: null }
  }

  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TypeError(`${fieldName} must be greater than 0`)
  }
  if (amount > maximum) {
    throw new TypeError(`${fieldName} is too large`)
  }

  const amountCents = Math.round(amount * 100)
  if (amountCents < 1) {
    throw new TypeError(`${fieldName} must be at least 0.01`)
  }

  return { amount: amountCents / 100, amountCents }
}

function normalizeTransactionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Transaction date must use YYYY-MM-DD format')
  }

  const [year, month, day] = value.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new TypeError('Transaction date must be a valid calendar date')
  }
  return value
}

function normalizeDescription(value, maximum = MAX_TRANSACTION_NOTE_LENGTH) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new TypeError('Transaction note must be text')
  }
  const description = value.trim()
  if (description.length > maximum) {
    throw new TypeError(`Transaction note cannot exceed ${maximum} characters`)
  }
  return description
}

function resolveAvailableCategory(database, { category, type, userId }) {
  const normalizedType = normalizeEntryType(type)
  const normalizedUserId = normalizeUserId(userId)
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''
  if (!normalizedCategory || normalizedCategory.length > 40) {
    throw new TypeError('Category must be 1 to 40 characters')
  }

  const row = database.prepare(`
    SELECT name FROM categories
    WHERE type = ?
      AND name = ? COLLATE NOCASE
      AND is_active = 1
      AND (is_default = 1 OR user_id = ?)
  `).get(normalizedType, normalizedCategory, normalizedUserId)

  if (!row) {
    throw new TypeError(`Category is unavailable for this ${normalizedType}`)
  }
  return row.name
}

function normalizeTransactionInput(database, input = {}) {
  const type = normalizeEntryType(input.type)
  const userId = normalizeUserId(input.userId, { optional: true })
  const money = normalizeAmount(input.amount)
  const category = userId === null
    ? normalizeLegacyCategory(input.category)
    : resolveAvailableCategory(database, { category: input.category, type, userId })

  return {
    userId,
    type,
    ...money,
    category,
    transactionDate: normalizeTransactionDate(input.transactionDate),
    description: normalizeDescription(input.description),
  }
}

function normalizeLegacyCategory(category) {
  const normalized = typeof category === 'string' ? category.trim() : ''
  if (!normalized || normalized.length > 40) {
    throw new TypeError('Category must be 1 to 40 characters')
  }
  return normalized
}

module.exports = {
  MAX_TRANSACTION_AMOUNT,
  MAX_TRANSACTION_NOTE_LENGTH,
  normalizeAmount,
  normalizeEntryType,
  normalizeTransactionDate,
  normalizeTransactionInput,
  normalizeUserId,
  resolveAvailableCategory,
}
