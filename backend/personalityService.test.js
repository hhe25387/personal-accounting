const assert = require('node:assert/strict')
const { afterEach, beforeEach, test } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createPersonalityService = require('./personalityService')
const createTransactionService = require('./transactionService')

let database
let transactions
let personality

beforeEach(() => {
  database = new Database(':memory:')
  initializeDatabase(database)
  transactions = createTransactionService(database)
  personality = createPersonalityService({ database, transactionService: transactions })
})

afterEach(() => database.close())

test('首页消息使用当前账目事实和所选人格', () => {
  transactions.createTransaction({
    type: 'expense', amount: 88, category: '餐饮', transactionDate: '2026-08-02',
  })

  const result = personality.createHomeMessage({
    month: '2026-08',
    profile: { persona: 'royal', preferredTitle: 'Princess' },
  })

  assert.equal(result.persona, 'royal')
  assert.equal(result.scene, 'home_open')
  assert.match(result.message, /Princess/)
  assert.match(result.evidence, /1 entries/)
})

test('明显高于平时的非必要消费会触发点评', () => {
  for (const amount of [100, 110, 120]) {
    transactions.createTransaction({
      type: 'expense', amount, category: '购物', transactionDate: '2026-08-02',
    })
  }
  const latest = transactions.createTransaction({
    type: 'expense', amount: 600, category: '购物', transactionDate: '2026-08-03',
  })

  const result = personality.createTransactionComment({
    transactionId: latest.id,
    profile: { persona: 'savage', toneIntensity: 'strong' },
  })

  assert.equal(result.shouldComment, true)
  assert.equal(result.anomaly, 'high_amount')
  assert.match(result.message, /600/)
})

test('生活必需消费不触发点评', () => {
  const meal = transactions.createTransaction({
    type: 'expense', amount: 800, category: 'Dining', transactionDate: '2026-08-03',
    description: '晚餐',
  })

  assert.deepEqual(
    personality.createTransactionComment({ transactionId: meal.id }),
    { shouldComment: false },
  )
})

test('初次认识阶段不评价消费', () => {
  const coldStartPersonality = createPersonalityService({
    database,
    transactionService: transactions,
    insightService: {
      getReadiness: () => ({ stage: 'new', transactionCount: 1 }),
    },
  })
  const shopping = transactions.createTransaction({
    type: 'expense', amount: 2000, category: '购物', transactionDate: '2026-08-03',
  })

  const result = coldStartPersonality.createTransactionComment({
    transactionId: shopping.id,
    profile: { persona: 'savage' },
  })

  assert.equal(result.shouldComment, false)
  assert.equal(result.reason, 'cold_start')
})

test('赞踩反馈会保存到数据库', () => {
  const saved = personality.saveFeedback({
    messageId: 'message-1', persona: 'bestie', scene: 'home_open',
    feedback: 'like', toneIntensity: 'medium',
  })
  const row = database.prepare('SELECT * FROM personality_feedback').get()

  assert.equal(saved.feedback, 'like')
  assert.equal(row.message_id, 'message-1')
  assert.equal(row.feedback, 'like')
})
