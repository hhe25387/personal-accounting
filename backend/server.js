const cors = require('cors')
const express = require('express')
const database = require('./database')

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (request, response) => {
  response.json({
    message: '后端运行成功',
  })
})

app.get('/api/transactions', (request, response) => {
  const rows = database
    .prepare(`
      SELECT *
      FROM transactions
      ORDER BY transaction_date DESC, id DESC
    `)
    .all()

  const transactions = rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount_cents / 100,
    category: row.category,
    transactionDate: row.transaction_date,
    description: row.description,
    createdAt: row.created_at,
  }))

  response.json(transactions)
})

app.post('/api/transactions', (request, response) => {
  const { type, amount, category, transactionDate, description } = request.body

  if (!type || !amount || !category || !transactionDate) {
    return response.status(400).json({
      message: '类型、金额、分类和日期不能为空',
    })
  }

  const amountCents = Math.round(Number(amount) * 100)

  const insertTransaction = database.prepare(`
    INSERT INTO transactions (
      type,
      amount_cents,
      category,
      transaction_date,
      description
    )
    VALUES (?, ?, ?, ?, ?)
  `)

  const result = insertTransaction.run(
    type,
    amountCents,
    category,
    transactionDate,
    description || null,
  )

  response.status(201).json({
    message: '账目保存成功',
    transaction: {
      id: result.lastInsertRowid,
      type,
      amount,
      category,
      transactionDate,
      description,
    },
  })
})

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`)
})