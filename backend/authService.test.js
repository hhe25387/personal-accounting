const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const { AuthConflictError, InvalidCredentialsError, createAuthService } = require('./authService')
const initializeDatabase = require('./initializeDatabase')

describe('authService', () => {
  let database
  let auth

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    auth = createAuthService(database)
  })
  afterEach(() => database.close())

  it('注册用户时哈希密码并建立会话', async () => {
    const result = await auth.register({ name: '小禾', account: 'HE@example.com', password: 'abc12345' })
    const stored = database.prepare('SELECT * FROM users').get()

    assert.equal(result.user.account, 'he@example.com')
    assert.notEqual(stored.password_hash, 'abc12345')
    assert.equal(auth.getUserBySession(result.session.token).name, '小禾')
  })

  it('允许正确密码登录并拒绝错误密码', async () => {
    await auth.register({ name: '小禾', account: 'he@example.com', password: 'abc12345' })
    const result = await auth.login({ account: 'he@example.com', password: 'abc12345' })
    assert.equal(result.user.name, '小禾')
    await assert.rejects(
      auth.login({ account: 'he@example.com', password: 'wrong-password' }),
      InvalidCredentialsError,
    )
  })

  it('拒绝重复账号并支持注销会话', async () => {
    const result = await auth.register({ name: '小禾', account: 'he@example.com', password: 'abc12345' })
    await assert.rejects(
      auth.register({ name: '另一个人', account: 'HE@example.com', password: 'abc12345' }),
      AuthConflictError,
    )
    assert.equal(auth.logout(result.session.token), true)
    assert.equal(auth.getUserBySession(result.session.token), null)
  })

  it('允许用户修改昵称并立即反映到当前会话', async () => {
    const result = await auth.register({ name: '小禾', account: 'he@example.com', password: 'abc12345' })
    const updated = auth.updateProfile(result.user.id, { name: '  小禾同学  ' })

    assert.equal(updated.name, '小禾同学')
    assert.equal(auth.getUserBySession(result.session.token).name, '小禾同学')
    assert.throws(
      () => auth.updateProfile(result.user.id, { name: '' }),
      /Display name must be 1 to 40 characters/,
    )
  })

  it('修改密码时校验旧密码、更新哈希并清除全部旧会话', async () => {
    const registered = await auth.register({ name: '小禾', account: 'he@example.com', password: 'abc12345' })
    const secondSession = await auth.login({ account: 'he@example.com', password: 'abc12345' })

    await assert.rejects(
      auth.changePassword(registered.user.id, {
        currentPassword: 'wrong123',
        newPassword: 'new12345',
      }),
      /Current password is incorrect/,
    )
    await auth.changePassword(registered.user.id, {
      currentPassword: 'abc12345',
      newPassword: 'new12345',
    })

    assert.equal(auth.getUserBySession(registered.session.token), null)
    assert.equal(auth.getUserBySession(secondSession.session.token), null)
    await assert.rejects(
      auth.login({ account: 'he@example.com', password: 'abc12345' }),
      InvalidCredentialsError,
    )
    const login = await auth.login({ account: 'he@example.com', password: 'new12345' })
    assert.equal(login.user.name, '小禾')
  })
})
