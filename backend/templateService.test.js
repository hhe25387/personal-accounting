const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const {
  MAX_TEMPLATES_PER_USER,
  TemplateLimitError,
  createTemplateService,
} = require('./templateService')

describe('templateService', () => {
  let database
  let service
  let userOne
  let userTwo

  beforeEach(() => {
    database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    initializeDatabase(database)
    const insertUser = database.prepare(`
      INSERT INTO users (name, account, password_hash, password_salt)
      VALUES (?, ?, 'hash', 'salt')
    `)
    userOne = Number(insertUser.run('用户一', 'one@example.com').lastInsertRowid)
    userTwo = Number(insertUser.run('用户二', 'two@example.com').lastInsertRowid)
    service = createTemplateService(database)
  })

  afterEach(() => database.close())

  it('为当前用户创建和读取可选金额模板', () => {
    const fixed = service.createTemplate(userOne, {
      name: '工作午餐',
      type: 'expense',
      amount: 28.5,
      category: 'Dining',
      description: '园区午餐',
      isPinned: true,
    })
    const flexible = service.createTemplate(userOne, {
      name: '打车',
      type: 'expense',
      amount: '',
      category: 'Transport',
    })

    assert.equal(fixed.amount, 28.5)
    assert.equal(fixed.isPinned, true)
    assert.equal(flexible.amount, null)
    assert.deepEqual(service.getTemplates(userOne).map((item) => item.name), [
      '工作午餐',
      '打车',
    ])
  })

  it('模板严格隔离用户且其他用户不能修改、使用或删除', () => {
    const template = service.createTemplate(userOne, {
      name: '工资',
      type: 'income',
      category: 'Salary',
    })

    assert.deepEqual(service.getTemplates(userTwo), [])
    assert.equal(service.updateTemplate(template.id, userTwo, { ...template }), null)
    assert.equal(service.markTemplateUsed(template.id, userTwo), null)
    assert.equal(service.deleteTemplate(template.id, userTwo), false)
    assert.equal(service.getTemplates(userOne).length, 1)
  })

  it('记录使用次数并按常用程度重新排序', () => {
    const first = service.createTemplate(userOne, {
      name: '午餐', type: 'expense', category: 'Dining',
    })
    const second = service.createTemplate(userOne, {
      name: '地铁', type: 'expense', category: 'Transport',
    })

    const used = service.markTemplateUsed(first.id, userOne)

    assert.equal(used.useCount, 1)
    assert.equal(service.getTemplates(userOne)[0].id, first.id)
    assert.equal(service.getTemplates(userOne)[1].id, second.id)
  })

  it('更新和删除自己的模板', () => {
    const template = service.createTemplate(userOne, {
      name: '旧名称', type: 'expense', category: 'Shopping',
    })
    const updated = service.updateTemplate(template.id, userOne, {
      name: '日用品',
      type: 'expense',
      amount: 60,
      category: 'Shopping',
      description: '补货',
      isPinned: true,
    })

    assert.equal(updated.name, '日用品')
    assert.equal(updated.amount, 60)
    assert.equal(service.deleteTemplate(template.id, userOne), true)
    assert.deepEqual(service.getTemplates(userOne), [])
  })

  it('校验内容并限制每位用户最多十二个模板', () => {
    assert.throws(
      () => service.createTemplate(userOne, { name: '', type: 'expense', category: 'Dining' }),
      TypeError,
    )
    for (let index = 0; index < MAX_TEMPLATES_PER_USER; index += 1) {
      service.createTemplate(userOne, {
        name: `模板${index + 1}`,
        type: 'expense',
        category: 'Dining',
      })
    }
    assert.throws(
      () => service.createTemplate(userOne, {
        name: '超出限制', type: 'expense', category: 'Dining',
      }),
      TemplateLimitError,
    )
  })

  it('只允许当前用户可用且类型匹配的分类', () => {
    database.prepare(`
      INSERT INTO categories (user_id, type, name, is_default, is_active)
      VALUES (?, 'expense', 'Pets', 0, 1),
             (?, 'expense', 'Private One', 0, 1)
    `).run(userOne, userTwo)

    const template = service.createTemplate(userOne, {
      name: '宠物用品',
      type: 'expense',
      category: 'pets',
    })
    assert.equal(template.category, 'Pets')

    assert.throws(
      () => service.createTemplate(userOne, {
        name: '不存在', type: 'expense', category: 'Missing',
      }),
      /Category is unavailable/,
    )
    assert.throws(
      () => service.createTemplate(userOne, {
        name: '类型不符', type: 'expense', category: 'Salary',
      }),
      /Category is unavailable/,
    )
    assert.throws(
      () => service.createTemplate(userOne, {
        name: '他人分类', type: 'expense', category: 'Private One',
      }),
      /Category is unavailable/,
    )
  })
})
