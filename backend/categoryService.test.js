const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const {
  CategoryConflictError,
  createCategoryService,
} = require('./categoryService')
const defaultCategories = require('./defaultCategories')
const initializeDatabase = require('./initializeDatabase')

describe('categoryService', () => {
  let database
  let categoryService

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    categoryService = createCategoryService(database)
  })

  afterEach(() => {
    database.close()
  })

  it('读取所有预设分类', () => {
    const categories = categoryService.getCategories()

    assert.equal(
      categories.length,
      defaultCategories.income.length + defaultCategories.expense.length,
    )
    assert.ok(categories.every((category) => category.isDefault))
  })

  it('按收入或支出类型筛选分类', () => {
    const incomeCategories = categoryService.getCategories('income')

    assert.deepEqual(
      incomeCategories.map((category) => category.name),
      defaultCategories.income,
    )
  })

  it('去除首尾空格并新增自定义分类', () => {
    const category = categoryService.createCategory({
      type: 'income',
      name: '  奖学金  ',
    })

    assert.equal(category.type, 'income')
    assert.equal(category.name, '奖学金')
    assert.equal(category.isDefault, false)
    assert.ok(category.id > 0)
  })

  it('允许收入和支出使用相同分类名称', () => {
    categoryService.createCategory({ type: 'income', name: '其他' })
    categoryService.createCategory({ type: 'expense', name: '其他' })

    assert.equal(
      categoryService
        .getCategories()
        .filter((category) => category.name === '其他').length,
      2,
    )
  })

  it('拒绝空名称、错误类型和过长名称', () => {
    assert.throws(
      () => categoryService.createCategory({ type: 'income', name: '  ' }),
      /Category name is required/,
    )
    assert.throws(
      () => categoryService.createCategory({ type: 'saving', name: '存款' }),
      /Category type must be income or expense/,
    )
    assert.throws(
      () =>
        categoryService.createCategory({
          type: 'income',
          name: 'a'.repeat(41),
        }),
      /Category name cannot exceed 40 characters/,
    )
  })

  it('拒绝同类型下大小写不同的重复分类', () => {
    categoryService.createCategory({ type: 'income', name: 'Side Job' })

    assert.throws(
      () =>
        categoryService.createCategory({
          type: 'income',
          name: 'side job',
        }),
      CategoryConflictError,
    )
  })

  it('拒绝错误的读取筛选类型', () => {
    assert.throws(
      () => categoryService.getCategories('saving'),
      /Category type must be income or expense/,
    )
  })

  it('按用户隔离自定义分类并允许不同用户使用同名分类', () => {
    database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES
        ('用户一', 'one@example.com', 'hash', 'salt'),
        ('用户二', 'two@example.com', 'hash', 'salt')
    `).run()

    const first = categoryService.createCategory({
      type: 'expense', name: '宠物', userId: 1,
    })
    categoryService.createCategory({
      type: 'expense', name: '宠物', userId: 2,
    })

    assert.equal(
      categoryService
        .getCategories('expense', 1)
        .filter((category) => category.name === '宠物').length,
      1,
    )
    assert.equal(categoryService.hideCategory(first.id, 2), false)
    assert.equal(categoryService.hideCategory(first.id, 1), true)
    assert.equal(
      categoryService
        .getCategories('expense', 1)
        .some((category) => category.name === '宠物'),
      false,
    )
  })

  it('不能隐藏系统预设分类', () => {
    database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES ('用户一', 'one@example.com', 'hash', 'salt')
    `).run()
    const defaultCategory = categoryService
      .getCategories('expense', 1)
      .find((category) => category.isDefault)

    assert.equal(categoryService.hideCategory(defaultCategory.id, 1), false)
  })
})
