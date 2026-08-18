const loadEnvironment = require('./config/loadEnvironment')

loadEnvironment()

const cors = require('cors')
const express = require('express')
const {
  AuthConflictError,
  InvalidCredentialsError,
  createAuthService,
} = require('./authService')
const createAccountingAgent = require('./agent/createAccountingAgent')
const createUserTransactionReader = require('./agent/userTransactionReader')
const createProvider = require('./agent/providers/createProvider')
const {
  CategoryConflictError,
  createCategoryService,
} = require('./categoryService')
const createBudgetService = require('./budgetService')
const loadAgentConfig = require('./config/agentConfig')
const database = require('./database')
const createInsightService = require('./insightService')
const createPersonalityService = require('./personalityService')
const createPreferenceService = require('./preferenceService')
const { getMonthRange } = require('./reportingPeriod')
const createTransactionService = require('./transactionService')
const {
  TemplateLimitError,
  createTemplateService,
} = require('./templateService')

const agentConfig = loadAgentConfig()
const authService = createAuthService(database)
const categoryService = createCategoryService(database)
const transactionService = createTransactionService(database)
const budgetService = createBudgetService(database, transactionService)
const templateService = createTemplateService(database)
const insightService = createInsightService(database)
const personalityService = createPersonalityService({
  database,
  transactionService,
  insightService,
})
const preferenceService = createPreferenceService(database)
const { createCategory, getCategories, hideCategory } = categoryService
const {
  createTransaction,
  deleteTransaction,
  getAllTransactions,
  getCategoryBreakdown,
  getDailyBreakdown,
  getFinancialSummary,
  getTransactionPage,
  updateTransaction,
} = transactionService
const {
  createHomeMessage,
  createTransactionComment,
  saveFeedback,
} = personalityService

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      const allowedOrigins = new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_ORIGIN,
      ])
      callback(null, !origin || allowedOrigins.has(origin))
    },
  }),
)
app.use(express.json())

function readSessionToken(request) {
  const cookies = request.headers.cookie?.split(';') || []
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith('accounting_session='))
  return sessionCookie ? decodeURIComponent(sessionCookie.split('=').slice(1).join('=')) : null
}

function setSessionCookie(response, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `accounting_session=${encodeURIComponent(session.token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`,
  )
}

function clearSessionCookie(response) {
  response.setHeader(
    'Set-Cookie',
    'accounting_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
  )
}

function handleAuthError(error, response) {
  if (error instanceof TypeError) {
    response.status(400).json({ message: error.message })
    return true
  }
  if (error instanceof AuthConflictError) {
    response.status(409).json({ message: error.message })
    return true
  }
  if (error instanceof InvalidCredentialsError) {
    response.status(401).json({ message: error.message })
    return true
  }
  return false
}

app.post('/api/auth/register', async (request, response) => {
  try {
    const result = await authService.register(request.body)
    setSessionCookie(response, result.session)
    response.status(201).json({ message: 'Account created', user: result.user })
  } catch (error) {
    if (handleAuthError(error, response)) return
    console.error('Registration failed:', error)
    response.status(500).json({ message: 'Could not create the account right now' })
  }
})

app.post('/api/auth/login', async (request, response) => {
  try {
    const result = await authService.login(request.body)
    setSessionCookie(response, result.session)
    response.json({ message: 'Signed in', user: result.user })
  } catch (error) {
    if (handleAuthError(error, response)) return
    console.error('Sign-in failed:', error)
    response.status(500).json({ message: 'Could not sign in right now' })
  }
})

app.get('/api/auth/me', (request, response) => {
  const user = authService.getUserBySession(readSessionToken(request))
  if (!user) return response.status(401).json({ message: 'Not signed in' })
  response.json({ user })
})

app.post('/api/auth/logout', (request, response) => {
  authService.logout(readSessionToken(request))
  clearSessionCookie(response)
  response.json({ message: 'Signed out' })
})

app.get('/api/health', (request, response) => {
  response.json({
    message: 'Backend is running',
  })
})

function requireAuthentication(request, response, next) {
  const user = authService.getUserBySession(readSessionToken(request))
  if (!user) return response.status(401).json({ message: 'Please sign in first' })
  request.user = user
  next()
}

app.use(
  [
    '/api/transactions',
    '/api/statistics',
    '/api/personality',
    '/api/preferences',
    '/api/insights',
    '/api/assistant',
    '/api/categories',
    '/api/account',
    '/api/templates',
    '/api/budgets',
  ],
  requireAuthentication,
)

function handleTemplateError(error, response) {
  if (error instanceof TypeError) {
    response.status(400).json({ message: error.message })
    return true
  }
  if (error instanceof TemplateLimitError) {
    response.status(409).json({ message: error.message })
    return true
  }
  return false
}

app.get('/api/templates', (request, response) => {
  try {
    response.json({ templates: templateService.getTemplates(request.user.id) })
  } catch (error) {
    if (handleTemplateError(error, response)) return
    console.error('Could not load templates:', error)
    response.status(500).json({ message: 'Could not load templates right now' })
  }
})

app.post('/api/templates', (request, response) => {
  try {
    const template = templateService.createTemplate(request.user.id, request.body)
    response.status(201).json({ message: 'Template saved', template })
  } catch (error) {
    if (handleTemplateError(error, response)) return
    console.error('Failed to save template:', error)
    response.status(500).json({ message: 'Could not save the template right now' })
  }
})

app.put('/api/templates/:id', (request, response) => {
  try {
    const template = templateService.updateTemplate(
      Number(request.params.id),
      request.user.id,
      request.body,
    )
    if (!template) return response.status(404).json({ message: 'Template not found' })
    response.json({ message: 'Template updated', template })
  } catch (error) {
    if (handleTemplateError(error, response)) return
    console.error('Failed to update template:', error)
    response.status(500).json({ message: 'Could not update the template right now' })
  }
})

app.delete('/api/templates/:id', (request, response) => {
  try {
    const wasDeleted = templateService.deleteTemplate(
      Number(request.params.id),
      request.user.id,
    )
    if (!wasDeleted) return response.status(404).json({ message: 'Template not found' })
    response.json({ message: 'Template deleted' })
  } catch (error) {
    if (handleTemplateError(error, response)) return
    console.error('Failed to delete template:', error)
    response.status(500).json({ message: 'Could not delete the template right now' })
  }
})

app.post('/api/templates/:id/use', (request, response) => {
  try {
    const template = templateService.markTemplateUsed(
      Number(request.params.id),
      request.user.id,
    )
    if (!template) return response.status(404).json({ message: 'Template not found' })
    response.json({ template })
  } catch (error) {
    if (handleTemplateError(error, response)) return
    console.error('Failed to update template usage:', error)
    response.status(500).json({ message: 'Could not update template usage right now' })
  }
})

app.patch('/api/account/profile', (request, response) => {
  try {
    const user = authService.updateProfile(request.user.id, request.body)
    response.json({ message: 'Profile updated', user })
  } catch (error) {
    if (handleAuthError(error, response)) return
    console.error('Failed to update profile:', error)
    response.status(500).json({ message: 'Could not update the profile right now' })
  }
})

app.put('/api/account/password', async (request, response) => {
  try {
    await authService.changePassword(request.user.id, request.body)
    clearSessionCookie(response)
    response.json({ message: 'Password changed. Please sign in again.' })
  } catch (error) {
    if (handleAuthError(error, response)) return
    console.error('Failed to change password:', error)
    response.status(500).json({ message: 'Could not change the password right now' })
  }
})

app.get('/api/insights/readiness', (request, response) => {
  response.json(insightService.getReadiness(request.user.id))
})

app.get('/api/preferences', (request, response) => {
  response.json({
    preferences: preferenceService.getPreferences(request.user.id),
  })
})

app.put('/api/preferences', (request, response) => {
  try {
    const preferences = preferenceService.savePreferences(
      request.user.id,
      request.body,
    )
    response.json({ message: 'Preferences saved', preferences })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Could not save user preferences:', error)
    response.status(500).json({ message: 'Could not save preferences right now' })
  }
})

app.get('/api/transactions', (request, response) => {
  try {
    const filters = { ...request.query, userId: request.user.id }
    response.json(
      request.query.limit !== undefined || request.query.offset !== undefined
        ? getTransactionPage(filters)
        : getAllTransactions(filters),
    )
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to filter transactions:', error)
    response.status(500).json({ message: 'Could not load transactions right now' })
  }
})

app.get('/api/statistics/summary', (request, response) => {
  try {
    const period = getMonthRange(request.query.month || undefined)
    const summary = getFinancialSummary({
      userId: request.user.id,
      startDate: period.startDate,
      endDate: period.endDate,
    })

    response.json({ ...period, ...summary })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to load monthly summary:', error)
    response.status(500).json({ message: 'Could not load the monthly summary right now' })
  }
})

app.get('/api/statistics/daily', (request, response) => {
  try {
    const period = getMonthRange(request.query.month || undefined)
    const days = getDailyBreakdown({
      userId: request.user.id,
      startDate: period.startDate,
      endDate: period.endDate,
    })

    response.json({ ...period, days })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to load daily trends:', error)
    response.status(500).json({ message: 'Could not load daily trends right now' })
  }
})

app.get('/api/statistics/categories', (request, response) => {
  try {
    const period = getMonthRange(request.query.month || undefined)
    const type = request.query.type || 'expense'
    const categories = getCategoryBreakdown({
      userId: request.user.id,
      type,
      startDate: period.startDate,
      endDate: period.endDate,
    })

    response.json({ ...period, type, categories })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to load category breakdown:', error)
    response.status(500).json({ message: 'Could not load category breakdown right now' })
  }
})

app.get('/api/budgets', (request, response) => {
  try {
    response.json(budgetService.getBudget(request.user.id, request.query.month))
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to load budget:', error)
    response.status(500).json({ message: 'Could not load the budget right now' })
  }
})

app.put('/api/budgets/:month', (request, response) => {
  try {
    const budget = budgetService.saveBudget(
      request.user.id,
      request.params.month,
      request.body,
    )
    response.json({ message: 'Budget saved', budget })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to save budget:', error)
    response.status(500).json({ message: 'Could not save the budget right now' })
  }
})

app.delete('/api/budgets/:month', (request, response) => {
  try {
    const wasDeleted = budgetService.deleteBudget(
      request.user.id,
      request.params.month,
    )
    if (!wasDeleted) return response.status(404).json({ message: 'Budget not found' })
    response.json({ message: 'Budget removed' })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to remove budget:', error)
    response.status(500).json({ message: 'Could not remove the budget right now' })
  }
})

app.get('/api/categories', (request, response) => {
  try {
    response.json(getCategories(request.query.type, request.user.id))
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to load categories:', error)
    response.status(500).json({ message: 'Could not load categories right now' })
  }
})

app.post('/api/categories', (request, response) => {
  try {
    const category = createCategory({
      ...request.body,
      userId: request.user.id,
    })

    response.status(201).json({
      message: 'Category created',
      category,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    if (error instanceof CategoryConflictError) {
      return response.status(409).json({ message: error.message })
    }

    console.error('Failed to create category:', error)
    response.status(500).json({ message: 'Could not create the category right now' })
  }
})

app.delete('/api/categories/:id', (request, response) => {
  try {
    const categoryId = Number(request.params.id)
    const wasHidden = hideCategory(categoryId, request.user.id)
    if (!wasHidden) {
      return response.status(404).json({
        message: 'Category not found, belongs to another user, or is a system category',
      })
    }
    response.json({ message: 'Category hidden; previous transactions are unchanged' })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to hide category:', error)
    response.status(500).json({ message: 'Could not hide the category right now' })
  }
})

app.post('/api/personality/home-message', (request, response) => {
  try {
    response.json(
      createHomeMessage({ ...request.body, userId: request.user.id }),
    )
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to create daily insight:', error)
    response.status(500).json({ message: 'Today’s insight is unavailable' })
  }
})

app.post('/api/personality/transaction-comment', (request, response) => {
  try {
    const comment = createTransactionComment({
      ...request.body,
      userId: request.user.id,
    })

    if (!comment) {
      return response.status(404).json({ message: 'Transaction not found' })
    }

    response.json(comment)
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to create spending insight:', error)
    response.status(500).json({ message: 'Spending insight is unavailable' })
  }
})

app.post('/api/personality/feedback', (request, response) => {
  try {
    const feedback = saveFeedback(request.body)
    response.status(201).json({ message: 'Feedback received', feedback })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }

    console.error('Failed to save insight feedback:', error)
    response.status(500).json({ message: 'Could not save feedback right now' })
  }
})

app.post('/api/assistant', async (request, response) => {
  const { message, language } = request.body

  if (typeof message !== 'string' || message.trim() === '') {
    return response.status(400).json({
      message: 'Message is required',
    })
  }

  try {
    const userTransactionService = createUserTransactionReader(
      transactionService,
      request.user.id,
    )
    const accountingAgent = createAccountingAgent({
      provider: createProvider(agentConfig),
      transactionService: userTransactionService,
    })
    const responseLanguage = ['en', 'zh'].includes(language)
      ? language
      : (/\p{Script=Han}/u.test(message) ? 'zh' : 'en')
    const result = await accountingAgent.run(message, {
      language: responseLanguage,
    })
    response.json(result)
  } catch (error) {
    console.error('Assistant request failed:', error)
    response.status(500).json({
      message: 'The assistant cannot process this request right now',
    })
  }
})

app.post('/api/transactions', (request, response) => {
  try {
    const transaction = createTransaction({
      ...request.body,
      userId: request.user.id,
    })
    response.status(201).json({
      message: 'Transaction saved',
      transaction,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to save transaction:', error)
    response.status(500).json({ message: 'Could not save the transaction right now' })
  }
})

app.put('/api/transactions/:id', (request, response) => {
  const transactionId = Number(request.params.id)
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return response.status(400).json({
      message: 'Transactions ID  must be a positive integer',
    })
  }

  try {
    const transaction = updateTransaction(
      transactionId,
      request.body,
      request.user.id,
    )
    if (!transaction) {
      return response.status(404).json({ message: 'Transaction not found' })
    }
    response.json({
      message: 'Transaction updated',
      transaction,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ message: error.message })
    }
    console.error('Failed to update transaction:', error)
    response.status(500).json({ message: 'Could not update the transaction right now' })
  }
})

app.delete('/api/transactions/:id', (request, response) => {
  const transactionId = Number(request.params.id)

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return response.status(400).json({
      message: 'Transactions ID  must be a positive integer',
    })
  }

  const wasDeleted = deleteTransaction(transactionId, request.user.id)

  if (!wasDeleted) {
    return response.status(404).json({
      message: 'Transaction not found',
    })
  }

  response.json({
    message: 'Transaction deleted',
  })
})

function startServer(port = PORT) {
  const server = app.listen(port, () => {
    const address = server.address()
    const activePort = typeof address === 'object' ? address.port : port
    console.log(`Backend server is running at http://localhost:${activePort}`)
    console.log(`Financial assistant is using ${agentConfig.providerName} Provider`)
  })
  return server
}

if (require.main === module) startServer()

module.exports = { app, startServer }
