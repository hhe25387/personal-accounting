const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const Database = require('better-sqlite3')

const initializeDatabase = require('./initializeDatabase')
const createPreferenceService = require('./preferenceService')

describe('preferenceService', () => {
  let database
  let preferences

  beforeEach(() => {
    database = new Database(':memory:')
    initializeDatabase(database)
    database
      .prepare(`
        INSERT INTO users (name, account, password_hash, password_salt)
        VALUES ('小禾', 'he@example.com', 'hash', 'salt')
      `)
      .run()
    preferences = createPreferenceService(database)
  })
  afterEach(() => database.close())

  it('首次读取没有设置的用户返回 null', () => {
    assert.equal(preferences.getPreferences(1), null)
  })

  it('保存并更新人格偏好', () => {
    const saved = preferences.savePreferences(1, {
      mode: 'personality',
      profile: {
        persona: 'royal', toneIntensity: 'gentle', proactivity: 'moderate',
        focus: 'saving', preferredTitle: 'Princess',
      },
    })
    assert.equal(saved.profile.preferredTitle, 'Princess')
    assert.equal(saved.savedProfile.preferredTitle, 'Princess')

    const updated = preferences.savePreferences(1, { mode: 'standard', profile: null })
    assert.equal(updated.mode, 'standard')
    assert.equal(updated.profile, null)
    assert.equal(updated.savedProfile.persona, 'royal')
    assert.equal(updated.savedProfile.preferredTitle, 'Princess')
  })

  it('拒绝不受支持的人格配置', () => {
    assert.throws(
      () => preferences.savePreferences(1, {
        mode: 'personality',
        profile: {
          persona: 'opponent', toneIntensity: 'medium',
          proactivity: 'moderate', focus: 'saving',
        },
      }),
      /valid companion personality/,
    )
  })
})
