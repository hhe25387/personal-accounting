class CategoryConflictError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CategoryConflictError'
  }
}

function formatCategory(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    isDefault: row.is_default === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }
}

function normalizeType(type, { required = true } = {}) {
  if (!required && (type === undefined || type === '')) {
    return undefined
  }

  if (!['income', 'expense'].includes(type)) {
    throw new TypeError('Category type must be income or expense')
  }

  return type
}

function normalizeName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('Category name is required')
  }

  const normalizedName = name.trim()

  if (normalizedName.length > 40) {
    throw new TypeError('Category name cannot exceed 40 characters')
  }

  return normalizedName
}

function createCategoryService(database) {
  function getCategories(type, userId) {
    const normalizedType = normalizeType(type, { required: false })
    const conditions = ['is_active = 1']
    const parameters = []
    if (normalizedType) {
      conditions.push('type = ?')
      parameters.push(normalizedType)
    }
    if (userId !== undefined) {
      conditions.push('(is_default = 1 OR user_id = ?)')
      parameters.push(userId)
    }
    const rows = database
      .prepare(`
        SELECT *
        FROM categories
        WHERE ${conditions.join(' AND ')}
        ORDER BY type ASC, is_default DESC, id ASC
      `)
      .all(...parameters)

    return rows.map(formatCategory)
  }

  function createCategory({ type, name, userId } = {}) {
    const normalizedType = normalizeType(type)
    const normalizedName = normalizeName(name)
    if (
      userId !== undefined &&
      (!Number.isInteger(userId) || userId <= 0)
    ) {
      throw new TypeError('userId  must be a positive integer')
    }
    const existingCategory = database
      .prepare(`
        SELECT id
        FROM categories
        WHERE type = ?
          AND name = ? COLLATE NOCASE
          AND is_active = 1
          AND ${userId === undefined ? 'user_id IS NULL' : '(is_default = 1 OR user_id = ?)'}
      `)
      .get(
        normalizedType,
        normalizedName,
        ...(userId === undefined ? [] : [userId]),
      )

    if (existingCategory) {
      throw new CategoryConflictError('This category already exists')
    }

    const result = database
      .prepare(`
        INSERT INTO categories (user_id, type, name, is_default, is_active)
        VALUES (?, ?, ?, 0, 1)
      `)
      .run(userId || null, normalizedType, normalizedName)

    return formatCategory(
      database
        .prepare('SELECT * FROM categories WHERE id = ?')
        .get(result.lastInsertRowid),
    )
  }

  function hideCategory(categoryId, userId) {
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new TypeError('Category ID  must be a positive integer')
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new TypeError('userId  must be a positive integer')
    }
    const result = database
      .prepare(`
        UPDATE categories
        SET is_active = 0
        WHERE id = ? AND user_id = ? AND is_default = 0
      `)
      .run(categoryId, userId)
    return result.changes > 0
  }

  return {
    createCategory,
    getCategories,
    hideCategory,
  }
}

module.exports = {
  CategoryConflictError,
  createCategoryService,
}
