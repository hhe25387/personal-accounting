const defaultCategories = require('./defaultCategories')

const legacyDefaultCategories = {
  expense: [
    ['\u9910\u996e', 'Dining'],
    ['\u4ea4\u901a', 'Transport'],
    ['\u8d2d\u7269', 'Shopping'],
    ['\u4f4f\u623f', 'Housing'],
    ['\u5a31\u4e50', 'Entertainment'],
    ['\u533b\u7597', 'Healthcare'],
    ['\u6559\u80b2', 'Education'],
    ['\u6c34\u7535\u7f51\u7edc', 'Utilities'],
    ['\u5176\u4ed6\u652f\u51fa', 'Other Expense'],
  ],
  income: [
    ['\u5de5\u8d44', 'Salary'],
    ['\u5956\u91d1', 'Bonus'],
    ['\u517c\u804c', 'Side Income'],
    ['\u6295\u8d44\u6536\u76ca', 'Investment Income'],
    ['\u7ea2\u5305', 'Gift Money'],
    ['\u9000\u6b3e', 'Refund'],
    ['\u5176\u4ed6\u6536\u5165', 'Other Income'],
  ],
}

function initializeDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      category TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personality_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      persona TEXT NOT NULL,
      scene TEXT NOT NULL,
      feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike')),
      tone_intensity TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
      account TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('standard', 'personality')),
      persona TEXT CHECK (persona IN ('bestie', 'savage', 'parent', 'royal')),
      tone_intensity TEXT CHECK (tone_intensity IN ('gentle', 'medium', 'strong')),
      proactivity TEXT CHECK (proactivity IN ('quiet', 'moderate', 'active')),
      focus TEXT,
      preferred_title TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transaction_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 20),
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents > 0),
      category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 40),
      description TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
      use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
      total_amount_cents INTEGER CHECK (total_amount_cents IS NULL OR total_amount_cents > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, month),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
      category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 40),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, month, category COLLATE NOCASE),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token
      ON auth_sessions(token_hash);
  `)

  const transactionColumns = database
    .prepare('PRAGMA table_info(transactions)')
    .all()
    .map((column) => column.name)

  if (!transactionColumns.includes('user_id')) {
    database.exec(`
      ALTER TABLE transactions
      ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `)
  }

  const categoryColumns = database
    .prepare('PRAGMA table_info(categories)')
    .all()
    .map((column) => column.name)

  if (
    !categoryColumns.includes('user_id') ||
    !categoryColumns.includes('is_active')
  ) {
    database.exec(`
      ALTER TABLE categories RENAME TO categories_legacy;

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO categories (
        id, user_id, type, name, is_default, is_active, created_at
      )
      SELECT
        id,
        NULL,
        type,
        name,
        is_default,
        CASE WHEN is_default = 1 THEN 1 ELSE 0 END,
        created_at
      FROM categories_legacy;

      DROP TABLE categories_legacy;
    `)
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date
      ON transactions(user_id, transaction_date);

    CREATE INDEX IF NOT EXISTS idx_transaction_templates_user_order
      ON transaction_templates(user_id, is_pinned, use_count, last_used_at);

    CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_month
      ON monthly_budgets(user_id, month);

    CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month
      ON category_budgets(user_id, month);

    DROP INDEX IF EXISTS idx_categories_global_name;
    DROP INDEX IF EXISTS idx_categories_user_name;

    CREATE UNIQUE INDEX idx_categories_global_name
      ON categories(type, name COLLATE NOCASE)
      WHERE user_id IS NULL AND is_active = 1;

    CREATE UNIQUE INDEX idx_categories_user_name
      ON categories(user_id, type, name COLLATE NOCASE)
      WHERE user_id IS NOT NULL AND is_active = 1;
  `)

  const findGlobalCategory = database.prepare(`
    SELECT id FROM categories
    WHERE user_id IS NULL AND type = ? AND name = ? COLLATE NOCASE
  `)
  const updateGlobalCategory = database.prepare(`
    UPDATE categories SET name = ? WHERE id = ?
  `)
  const deleteGlobalCategory = database.prepare(`
    DELETE FROM categories WHERE id = ?
  `)
  const updateTransactionCategory = database.prepare(`
    UPDATE transactions SET category = ? WHERE category = ?
  `)
  const updateTemplateCategory = database.prepare(`
    UPDATE transaction_templates SET category = ? WHERE category = ?
  `)
  const migrateLegacyCategoryNames = database.transaction(() => {
    for (const [type, categoryPairs] of Object.entries(legacyDefaultCategories)) {
      for (const [legacyName, englishName] of categoryPairs) {
        const legacyCategory = findGlobalCategory.get(type, legacyName)
        const englishCategory = findGlobalCategory.get(type, englishName)
        if (legacyCategory) {
          if (englishCategory) deleteGlobalCategory.run(legacyCategory.id)
          else updateGlobalCategory.run(englishName, legacyCategory.id)
        }
        updateTransactionCategory.run(englishName, legacyName)
        updateTemplateCategory.run(englishName, legacyName)
      }
    }
  })

  migrateLegacyCategoryNames()

  const insertDefaultCategory = database.prepare(`
    INSERT OR IGNORE INTO categories (
      user_id, type, name, is_default, is_active
    )
    VALUES (NULL, ?, ?, 1, 1)
  `)

  const seedDefaultCategories = database.transaction(() => {
    for (const [type, categories] of Object.entries(defaultCategories)) {
      for (const name of categories) {
        insertDefaultCategory.run(type, name)
      }
    }
  })

  seedDefaultCategories()
}

module.exports = initializeDatabase
