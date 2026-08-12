const database = require('./database')

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

module.exports = {
  createTransaction,
  deleteTransaction,
  getAllTransactions,
  updateTransaction,
}
