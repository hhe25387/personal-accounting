const {
  createHash,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

class AuthConflictError extends Error {}
class InvalidCredentialsError extends Error {}

function normalizeName(name) {
  const normalized = typeof name === 'string' ? name.trim() : ''
  if (!normalized || normalized.length > 40) {
    throw new TypeError('Display name must be 1 to 40 characters')
  }
  return normalized
}

function normalizeAccount(account) {
  if (typeof account !== 'string' || !account.trim()) {
    throw new TypeError('Enter your email or phone number')
  }
  const normalized = account.trim().toLowerCase()
  const isEmail = /^\S+@\S+\.\S+$/.test(normalized)
  const isPhone = /^\+?[0-9]{6,20}$/.test(normalized)
  if (!isEmail && !isPhone) throw new TypeError('Enter a valid email or phone number')
  return normalized
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new TypeError('Password must be at least 8 characters')
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new TypeError('Password must include letters and numbers')
  }
}

function publicUser(row) {
  return { id: row.id, name: row.name, account: row.account }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function createAuthService(database) {
  async function hashPassword(password, salt) {
    const result = await scrypt(password, salt, 64)
    return Buffer.from(result).toString('hex')
  }

  async function verifyPassword(row, password, message = 'Incorrect account or password') {
    if (typeof password !== 'string' || !password) {
      throw new InvalidCredentialsError(message)
    }
    const candidate = Buffer.from(await hashPassword(password, row.password_salt), 'hex')
    const expected = Buffer.from(row.password_hash, 'hex')
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      throw new InvalidCredentialsError(message)
    }
  }

  async function register({ name, account, password } = {}) {
    const normalizedName = normalizeName(name)
    const normalizedAccount = normalizeAccount(account)
    validatePassword(password)
    const existing = database
      .prepare('SELECT id FROM users WHERE account = ?')
      .get(normalizedAccount)
    if (existing) throw new AuthConflictError('This account is already registered')

    const salt = randomBytes(16).toString('hex')
    const passwordHash = await hashPassword(password, salt)
    const result = database
      .prepare(`
        INSERT INTO users (name, account, password_hash, password_salt)
        VALUES (?, ?, ?, ?)
      `)
      .run(normalizedName, normalizedAccount, passwordHash, salt)

    const user = { id: Number(result.lastInsertRowid), name: normalizedName, account: normalizedAccount }
    return { user, session: createSession(user.id) }
  }

  async function login({ account, password } = {}) {
    const normalizedAccount = normalizeAccount(account)
    const row = database.prepare('SELECT * FROM users WHERE account = ?').get(normalizedAccount)
    if (!row) throw new InvalidCredentialsError('Incorrect account or password')
    await verifyPassword(row, password)
    return { user: publicUser(row), session: createSession(row.id) }
  }

  function updateProfile(userId, { name } = {}) {
    const normalizedName = normalizeName(name)
    const result = database
      .prepare('UPDATE users SET name = ? WHERE id = ?')
      .run(normalizedName, userId)
    if (!result.changes) return null
    return publicUser(database.prepare('SELECT * FROM users WHERE id = ?').get(userId))
  }

  async function changePassword(userId, { currentPassword, newPassword } = {}) {
    const row = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!row) throw new InvalidCredentialsError('Account not found or session expired')
    await verifyPassword(row, currentPassword, 'Current password is incorrect')
    validatePassword(newPassword)
    if (currentPassword === newPassword) {
      throw new TypeError('New password must differ from the current password')
    }

    const salt = randomBytes(16).toString('hex')
    const passwordHash = await hashPassword(newPassword, salt)
    database.transaction(() => {
      database
        .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .run(passwordHash, salt, userId)
      database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId)
    })()
  }

  function createSession(userId) {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    database
      .prepare('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(userId, hashToken(token), expiresAt)
    return { token, expiresAt }
  }

  function getUserBySession(token) {
    if (!token) return null
    const row = database
      .prepare(`
        SELECT users.id, users.name, users.account
        FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
      `)
      .get(hashToken(token), new Date().toISOString())
    return row ? publicUser(row) : null
  }

  function logout(token) {
    if (!token) return false
    return database
      .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .run(hashToken(token)).changes > 0
  }

  return {
    changePassword,
    getUserBySession,
    login,
    logout,
    register,
    updateProfile,
  }
}

module.exports = {
  AuthConflictError,
  InvalidCredentialsError,
  createAuthService,
}
