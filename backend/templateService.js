const MAX_TEMPLATES_PER_USER = 12

class TemplateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TemplateLimitError'
  }
}

function normalizePositiveInteger(value, fieldName) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new TypeError(`${fieldName}  must be a positive integer`)
  }
  return number
}

function normalizeTemplateInput(input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 20) {
    throw new TypeError('Template name must be 1 to 20 characters')
  }
  if (!['income', 'expense'].includes(input.type)) {
    throw new TypeError('Template type must be income or expense')
  }

  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (!category || category.length > 40) {
    throw new TypeError('Template category must be 1 to 40 characters')
  }

  const description =
    typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > 100) {
    throw new TypeError('Template note cannot exceed 100 characters')
  }

  let amountCents = null
  if (input.amount !== undefined && input.amount !== null && input.amount !== '') {
    const amount = Number(input.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999) {
      throw new TypeError('Template amount must be greater than 0')
    }
    amountCents = Math.round(amount * 100)
  }

  return {
    name,
    type: input.type,
    category,
    description: description || null,
    amountCents,
    isPinned: input.isPinned === true || input.isPinned === 1 ? 1 : 0,
  }
}

function formatTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amount: row.amount_cents === null ? null : row.amount_cents / 100,
    category: row.category,
    description: row.description || '',
    isPinned: row.is_pinned === 1,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function createTemplateService(database) {
  const findOwnedTemplate = database.prepare(`
    SELECT * FROM transaction_templates WHERE id = ? AND user_id = ?
  `)

  function getTemplates(userId) {
    const normalizedUserId = normalizePositiveInteger(userId, 'userId')
    return database
      .prepare(`
        SELECT *
        FROM transaction_templates
        WHERE user_id = ?
        ORDER BY is_pinned DESC, use_count DESC,
          CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END,
          last_used_at DESC, updated_at DESC, id DESC
      `)
      .all(normalizedUserId)
      .map(formatTemplate)
  }

  function createTemplate(userId, input) {
    const normalizedUserId = normalizePositiveInteger(userId, 'userId')
    const template = normalizeTemplateInput(input)
    const count = database
      .prepare('SELECT COUNT(*) AS count FROM transaction_templates WHERE user_id = ?')
      .get(normalizedUserId).count
    if (count >= MAX_TEMPLATES_PER_USER) {
      throw new TemplateLimitError(`Each user can save up to ${MAX_TEMPLATES_PER_USER} templates`)
    }

    const result = database
      .prepare(`
        INSERT INTO transaction_templates (
          user_id, name, type, amount_cents, category, description, is_pinned
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        normalizedUserId,
        template.name,
        template.type,
        template.amountCents,
        template.category,
        template.description,
        template.isPinned,
      )
    return formatTemplate(
      findOwnedTemplate.get(Number(result.lastInsertRowid), normalizedUserId),
    )
  }

  function updateTemplate(templateId, userId, input) {
    const normalizedTemplateId = normalizePositiveInteger(templateId, 'Template ID')
    const normalizedUserId = normalizePositiveInteger(userId, 'userId')
    const template = normalizeTemplateInput(input)
    const result = database
      .prepare(`
        UPDATE transaction_templates
        SET name = ?, type = ?, amount_cents = ?, category = ?,
          description = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
      .run(
        template.name,
        template.type,
        template.amountCents,
        template.category,
        template.description,
        template.isPinned,
        normalizedTemplateId,
        normalizedUserId,
      )
    return result.changes
      ? formatTemplate(findOwnedTemplate.get(normalizedTemplateId, normalizedUserId))
      : null
  }

  function deleteTemplate(templateId, userId) {
    const result = database
      .prepare('DELETE FROM transaction_templates WHERE id = ? AND user_id = ?')
      .run(
        normalizePositiveInteger(templateId, 'Template ID'),
        normalizePositiveInteger(userId, 'userId'),
      )
    return result.changes > 0
  }

  function markTemplateUsed(templateId, userId) {
    const normalizedTemplateId = normalizePositiveInteger(templateId, 'Template ID')
    const normalizedUserId = normalizePositiveInteger(userId, 'userId')
    const result = database
      .prepare(`
        UPDATE transaction_templates
        SET use_count = use_count + 1,
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `)
      .run(normalizedTemplateId, normalizedUserId)
    return result.changes
      ? formatTemplate(findOwnedTemplate.get(normalizedTemplateId, normalizedUserId))
      : null
  }

  return {
    createTemplate,
    deleteTemplate,
    getTemplates,
    markTemplateUsed,
    updateTemplate,
  }
}

module.exports = {
  MAX_TEMPLATES_PER_USER,
  TemplateLimitError,
  createTemplateService,
}
