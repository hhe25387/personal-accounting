const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const defaultCategories = require('./defaultCategories')
const initializeDatabase = require('./initializeDatabase')

describe('initializeDatabase', () => {
  let database

  beforeEach(() => {
    database = new Database(':memory:')
  })

  afterEach(() => {
    database.close()
  })

  it('创建账目、分类、认证和人格反馈表', () => {
    initializeDatabase(database)

    const tableNames = database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'transactions',
            'categories',
            'personality_feedback',
            'users',
            'auth_sessions',
            'user_preferences',
            'transaction_templates',
            'monthly_budgets',
            'category_budgets'
          )
        ORDER BY name
      `)
      .all()
      .map((row) => row.name)

    assert.deepEqual(tableNames, [
      'auth_sessions',
      'categories',
      'category_budgets',
      'monthly_budgets',
      'personality_feedback',
      'transaction_templates',
      'transactions',
      'user_preferences',
      'users',
    ])
  })

  it('写入收入和支出的预设分类', () => {
    initializeDatabase(database)

    const categories = database
      .prepare(`
        SELECT type, name, is_default AS isDefault
        FROM categories
        ORDER BY id
      `)
      .all()

    assert.equal(
      categories.length,
      defaultCategories.income.length + defaultCategories.expense.length,
    )
    assert.deepEqual(
      categories
        .filter((category) => category.type === 'income')
        .map((category) => category.name),
      defaultCategories.income,
    )
    assert.ok(categories.every((category) => category.isDefault === 1))
  })

  it('重复初始化不会重复插入预设分类', () => {
    initializeDatabase(database)
    initializeDatabase(database)

    const { categoryCount } = database
      .prepare('SELECT COUNT(*) AS categoryCount FROM categories')
      .get()

    assert.equal(
      categoryCount,
      defaultCategories.income.length + defaultCategories.expense.length,
    )
  })

  it('拒绝错误类型和同类型的重复分类', () => {
    initializeDatabase(database)

    assert.throws(
      () =>
        database
          .prepare('INSERT INTO categories (type, name) VALUES (?, ?)')
          .run('saving', '存款'),
      /CHECK constraint failed/,
    )
    assert.throws(
      () =>
        database
          .prepare('INSERT INTO categories (type, name) VALUES (?, ?)')
          .run('income', 'Salary'),
      /UNIQUE constraint failed/,
    )
  })

  it('迁移旧分类表并隐藏无法确认归属的旧自定义分类', () => {
    database.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, name)
      );
      INSERT INTO categories (type, name, is_default)
      VALUES ('expense', '餐饮', 1), ('expense', '旧的私人分类', 0);
    `)

    initializeDatabase(database)

    const columns = database
      .prepare('PRAGMA table_info(categories)')
      .all()
      .map((column) => column.name)
    const legacyCategory = database
      .prepare("SELECT * FROM categories WHERE name = '旧的私人分类'")
      .get()

    assert.ok(columns.includes('user_id'))
    assert.ok(columns.includes('is_active'))
    assert.equal(legacyCategory.is_active, 0)
  })

  it('将旧版中文默认分类及其账目和模板迁移为英文', () => {
    initializeDatabase(database)
    const userId = Number(
      database
        .prepare(`
          INSERT INTO users (name, account, password_hash, password_salt)
          VALUES ('User', 'migration@example.com', 'hash', 'salt')
        `)
        .run().lastInsertRowid,
    )
    database
      .prepare(`
        INSERT INTO categories (user_id, type, name, is_default, is_active)
        VALUES (NULL, 'expense', '餐饮', 1, 1)
      `)
      .run()
    database
      .prepare(`
        INSERT INTO transactions (user_id, type, amount_cents, category, transaction_date)
        VALUES (?, 'expense', 1200, '餐饮', '2026-08-01')
      `)
      .run(userId)
    database
      .prepare(`
        INSERT INTO transaction_templates (user_id, name, type, category)
        VALUES (?, 'Lunch', 'expense', '餐饮')
      `)
      .run(userId)

    initializeDatabase(database)

    assert.equal(
      database.prepare("SELECT category FROM transactions WHERE user_id = ?").get(userId).category,
      'Dining',
    )
    assert.equal(
      database.prepare("SELECT category FROM transaction_templates WHERE user_id = ?").get(userId).category,
      'Dining',
    )
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM categories WHERE name = '餐饮'").get().count,
      0,
    )
  })
})
