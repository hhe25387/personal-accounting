const assert = require('node:assert/strict')
const { after, before, describe, it } = require('node:test')

process.env.AGENT_PROVIDER = 'mock'
process.env.DATABASE_PATH = ':memory:'
process.env.NODE_ENV = 'test'

const database = require('./database')
const { startServer } = require('./server')

let server
let apiBaseUrl
let accountSequence = 0

async function apiRequest(path, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}
  if (cookie) headers.Cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  return { response, result }
}

async function registerUser(name = 'HTTP Test User') {
  accountSequence += 1
  const { response, result } = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: {
      name,
      account: `http-test-${accountSequence}@example.com`,
      password: 'testing123',
    },
  })
  assert.equal(response.status, 201)
  return {
    cookie: response.headers.get('set-cookie').split(';')[0],
    user: result.user,
  }
}

before(async () => {
  server = startServer(0)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  apiBaseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  database.close()
})

describe('transaction HTTP validation', () => {
  it('拒绝非法账目且不写入数据库', async () => {
    const { cookie } = await registerUser()
    const validPayload = {
      type: 'expense',
      amount: 28.5,
      category: 'Dining',
      transactionDate: '2026-08-18',
      description: 'Lunch',
    }
    const valid = await apiRequest('/api/transactions', {
      method: 'POST', cookie, body: validPayload,
    })
    assert.equal(valid.response.status, 201)

    const invalidPayloads = [
      { ...validPayload, type: 'other' },
      { ...validPayload, amount: -1 },
      { ...validPayload, amount: 0.001 },
      { ...validPayload, transactionDate: '2026-02-30' },
      { ...validPayload, category: 'Missing' },
      { ...validPayload, category: 'Salary' },
      { ...validPayload, description: 'x'.repeat(501) },
    ]
    for (const payload of invalidPayloads) {
      const rejected = await apiRequest('/api/transactions', {
        method: 'POST', cookie, body: payload,
      })
      assert.equal(rejected.response.status, 400)
      assert.equal(typeof rejected.result.message, 'string')
    }

    const list = await apiRequest('/api/transactions', { cookie })
    assert.equal(list.response.status, 200)
    assert.equal(list.result.length, 1)
    assert.equal(list.result[0].category, 'Dining')
  })

  it('编辑校验失败时保留原账目', async () => {
    const { cookie } = await registerUser()
    const created = await apiRequest('/api/transactions', {
      method: 'POST', cookie,
      body: {
        type: 'expense', amount: 20, category: 'Transport',
        transactionDate: '2026-08-18', description: 'Bus',
      },
    })
    const rejected = await apiRequest(`/api/transactions/${created.result.transaction.id}`, {
      method: 'PUT', cookie,
      body: {
        type: 'expense', amount: 999, category: 'Missing',
        transactionDate: '2026-08-18', description: 'Invalid update',
      },
    })
    assert.equal(rejected.response.status, 400)

    const list = await apiRequest('/api/transactions', { cookie })
    assert.equal(list.result.length, 1)
    assert.equal(list.result[0].amount, 20)
    assert.equal(list.result[0].category, 'Transport')
  })

  it('不同登录用户不能读取彼此的账目', async () => {
    const first = await registerUser('First Ledger')
    const second = await registerUser('Second Ledger')
    const created = await apiRequest('/api/transactions', {
      method: 'POST', cookie: first.cookie,
      body: {
        type: 'income', amount: 500, category: 'Salary',
        transactionDate: '2026-08-18', description: 'Private income',
      },
    })
    assert.equal(created.response.status, 201)

    const firstList = await apiRequest('/api/transactions', { cookie: first.cookie })
    const secondList = await apiRequest('/api/transactions', { cookie: second.cookie })
    assert.equal(firstList.result.length, 1)
    assert.deepEqual(secondList.result, [])
  })
})

describe('template HTTP validation', () => {
  it('只保存当前用户可用且类型匹配的分类', async () => {
    const { cookie } = await registerUser()
    const valid = await apiRequest('/api/templates', {
      method: 'POST', cookie,
      body: { name: 'Lunch', type: 'expense', category: 'dining' },
    })
    assert.equal(valid.response.status, 201)
    assert.equal(valid.result.template.category, 'Dining')

    for (const payload of [
      { name: 'Missing', type: 'expense', category: 'Missing' },
      { name: 'Wrong type', type: 'expense', category: 'Salary' },
    ]) {
      const rejected = await apiRequest('/api/templates', {
        method: 'POST', cookie, body: payload,
      })
      assert.equal(rejected.response.status, 400)
    }

    const templates = await apiRequest('/api/templates', { cookie })
    assert.equal(templates.result.templates.length, 1)
    assert.equal(templates.result.templates[0].category, 'Dining')
  })

  it('拒绝使用其他用户的自定义分类', async () => {
    const first = await registerUser('First User')
    const second = await registerUser('Second User')
    const custom = await apiRequest('/api/categories', {
      method: 'POST', cookie: second.cookie,
      body: { type: 'expense', name: 'Private Category' },
    })
    assert.equal(custom.response.status, 201)

    const rejected = await apiRequest('/api/templates', {
      method: 'POST', cookie: first.cookie,
      body: {
        name: 'Private', type: 'expense', category: 'Private Category',
      },
    })
    assert.equal(rejected.response.status, 400)
  })
})

describe('monthly report HTTP API', () => {
  it('只汇总当前用户的月度账目并拒绝非法月份', async () => {
    const first = await registerUser('Monthly Report User')
    const second = await registerUser('Other Monthly User')
    const created = await apiRequest('/api/transactions', {
      method: 'POST', cookie: first.cookie,
      body: {
        type: 'expense', amount: 88, category: 'Dining',
        transactionDate: '2026-08-18', description: 'Monthly report meal',
      },
    })
    assert.equal(created.response.status, 201)

    const report = await apiRequest('/api/reports/monthly?month=2026-08', {
      cookie: first.cookie,
    })
    assert.equal(report.response.status, 200)
    assert.equal(report.result.summary.totalExpense, 88)
    assert.equal(report.result.topCategory.category, 'Dining')

    const otherReport = await apiRequest('/api/reports/monthly?month=2026-08', {
      cookie: second.cookie,
    })
    assert.equal(otherReport.response.status, 200)
    assert.equal(otherReport.result.dataLevel, 'empty')
    assert.equal(otherReport.result.summary.totalExpense, 0)

    const invalid = await apiRequest('/api/reports/monthly?month=2026-13', {
      cookie: first.cookie,
    })
    assert.equal(invalid.response.status, 400)
  })
})
