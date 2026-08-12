const cors = require('cors')
const express = require('express')
const {
  createTransaction,
  deleteTransaction,
  getAllTransactions,
  updateTransaction,
} = require('./transactionService')

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
  response.json(getAllTransactions())
})

app.post('/api/transactions', (request, response) => {
  const { type, amount, category, transactionDate, description } = request.body

  if (!type || !amount || !category || !transactionDate) {
    return response.status(400).json({
      message: '类型、金额、分类和日期不能为空',
    })
  }

  const transaction = createTransaction({
    type,
    amount,
    category,
    transactionDate,
    description,
  })

  response.status(201).json({
    message: '账目保存成功',
    transaction,
  })
})

app.put('/api/transactions/:id', (request, response) => {
  const transactionId = Number(request.params.id)
  const { type, amount, category, transactionDate, description } = request.body

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return response.status(400).json({
      message: '账目 ID 必须是正整数',
    })
  }

  if (!type || amount === '' || amount == null || !category || !transactionDate) {
    return response.status(400).json({
      message: '类型、金额、分类和日期不能为空',
    })
  }

  const amountNumber = Number(amount)

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return response.status(400).json({
      message: '金额必须大于 0',
    })
  }

  const transaction = updateTransaction(transactionId, {
    type,
    amount: amountNumber,
    category,
    transactionDate,
    description,
  })

  if (!transaction) {
    return response.status(404).json({
      message: '账目不存在',
    })
  }

  response.json({
    message: '账目修改成功',
    transaction,
  })
})

app.delete('/api/transactions/:id', (request, response) => {
  const transactionId = Number(request.params.id)

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return response.status(400).json({
      message: '账目 ID 必须是正整数',
    })
  }

  const wasDeleted = deleteTransaction(transactionId)

  if (!wasDeleted) {
    return response.status(404).json({
      message: '账目不存在',
    })
  }

  response.json({
    message: '账目删除成功',
  })
})

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`)
})
