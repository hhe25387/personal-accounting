const { randomUUID } = require('node:crypto')

const { getMonthRange } = require('./reportingPeriod')

const supportedPersonas = new Set(['bestie', 'savage', 'parent', 'royal'])
const supportedTones = new Set(['gentle', 'medium', 'strong'])
const excludedCategories = new Set([
  'Dining',
  'Housing',
  'Healthcare',
  'Education',
  'Utilities',
])
const necessaryDescriptionPattern =
  /meal|breakfast|lunch|dinner|groceries|rent|mortgage|medical|medicine|tuition|water|electricity|gas/i

function normalizeProfile(profile = {}) {
  const persona = supportedPersonas.has(profile.persona)
    ? profile.persona
    : 'bestie'
  const toneIntensity = supportedTones.has(profile.toneIntensity)
    ? profile.toneIntensity
    : 'medium'
  const preferredTitle =
    typeof profile.preferredTitle === 'string' &&
    profile.preferredTitle.trim()
      ? profile.preferredTitle.trim().slice(0, 10)
      : 'Your Highness'

  return { persona, toneIntensity, preferredTitle }
}

function personaName(persona) {
  return {
    bestie: 'Supportive Companion',
    savage: 'Straight-talking Guide',
    parent: 'Caring Mentor',
    royal: 'Royal Steward',
  }[persona]
}

function createHomeCopy(profile, facts, variant) {
  const topCategory = facts.topCategory
  const hasSpending = facts.summary.totalExpense > 0
  const copies = {
    bestie: hasSpending
      ? [
          `No need to grade yourself yet. Keep tracking ${topCategory || 'each expense'} and the picture will become clearer.`,
          `This month is taking shape. It may be worth watching ${topCategory || 'your spending'} a little more closely.`,
        ]
      : ['A new month has started. One easy entry is enough for today.'],
    savage: hasSpending
      ? [
          `Bills do not disappear on their own. You have spent ¥${facts.summary.totalExpense.toFixed(2)} this month—at least now you can see it.`,
          `${topCategory || 'Spending'} stands out right now. Do not wait until month end to act surprised.`,
        ]
      : ['The ledger is suspiciously quiet. Hopefully your memory is not being selective.'],
    parent: hasSpending
      ? [
          `Spend on what you need. Your monthly balance is ¥${facts.summary.balance.toFixed(2)}, so remember to leave something for later.`,
          `${topCategory || 'Daily living'} is recorded. Take care of today without forgetting tomorrow.`,
        ]
      : ['Take the new month slowly. Spend where needed and simply keep it recorded.'],
    royal: hasSpending
      ? [
          `${profile.preferredTitle}, the treasury is being arranged. ${topCategory || 'Daily spending'} currently deserves the most attention.`,
          `${profile.preferredTitle}, the ledger is ready. This month’s balance is ¥${facts.summary.balance.toFixed(2)}.`,
        ]
      : [`${profile.preferredTitle}, your ledger is ready for the new month.`],
  }
  return copies[profile.persona][variant % copies[profile.persona].length]
}

function createTransactionCopy(profile, transaction, evidence) {
  const amount = Number(transaction.amount).toFixed(2)
  const messages = {
    bestie: `This ¥${amount} ${transaction.category} expense stands out from your usual spending. Add a note so it is easier to understand later?`,
    savage: `¥${amount} is not a casual little purchase. This ${transaction.category} expense is well above your usual—do not leave future you guessing.`,
    parent: `This ${transaction.category} expense is much higher than usual. Buy what you need, while leaving room for what comes next.`,
    royal: `${profile.preferredTitle}, this ¥${amount} purchase has entered the ledger. Taste is welcome, though the treasury also deserves a graceful plan.`,
  }

  return {
    message: messages[profile.persona],
    evidence:
      evidence.typical > 0
        ? `This entry is ¥${amount}; recent entries in this category are usually around ¥${evidence.typical.toFixed(2)}.`
        : `This entry is ¥${amount}, which meets the large-expense threshold.`,
    suggestion: 'Add a note about the purchase so it is easier to evaluate at month end.',
  }
}

function createPersonalityService({ database, transactionService, insightService }) {
  function createHomeMessage({ profile, month, userId } = {}) {
    const normalizedProfile = normalizeProfile(profile)
    const period = getMonthRange(month)
    const summary = transactionService.getFinancialSummary({
      userId,
      startDate: period.startDate,
      endDate: period.endDate,
    })
    const categories = transactionService.getCategoryBreakdown({
      userId,
      type: 'expense',
      startDate: period.startDate,
      endDate: period.endDate,
    })
    const topCategory = categories[0]?.category || null
    const variant = Number(period.endDate.slice(-2)) + summary.transactionCount

    return {
      messageId: randomUUID(),
      scene: 'home_open',
      persona: normalizedProfile.persona,
      personaName: personaName(normalizedProfile.persona),
      message: createHomeCopy(
        normalizedProfile,
        { summary, topCategory },
        variant,
      ),
      evidence:
        summary.transactionCount > 0
          ? `This month has ${summary.transactionCount} entries and ¥${summary.totalExpense.toFixed(2)} in expenses. ${topCategory ? `The top spending category is ${topCategory}.` : 'There are no expense categories yet.'}`
          : 'There are no transactions for this month yet.',
      suggestion:
        summary.transactionCount > 0
          ? 'Keep tracking consistently, then use the month-end trend to decide whether to adjust.'
          : 'Start with today’s first income or expense.',
      generatedAt: new Date().toISOString(),
    }
  }

  function createTransactionComment({ transactionId, profile, userId } = {}) {
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      throw new TypeError('transactionId must be a positive integer')
    }

    const transaction = transactionService.getTransactionById(transactionId, userId)
    if (!transaction) return null
    if (transaction.type !== 'expense') return { shouldComment: false }
    const readiness = insightService?.getReadiness(userId)
    if (readiness?.stage === 'new') {
      return { shouldComment: false, reason: 'cold_start', readiness }
    }
    if (
      excludedCategories.has(transaction.category) ||
      necessaryDescriptionPattern.test(transaction.description || '')
    ) {
      return { shouldComment: false }
    }

    const previous = transactionService
      .findTransactions({
        category: transaction.category,
        limit: 100,
        userId,
      })
      .filter((item) => item.id !== transactionId && item.type === 'expense')
    if (previous.length < 3) {
      return { shouldComment: false, reason: 'insufficient_category_data' }
    }
    const sortedAmounts = previous.map((item) => item.amount).sort((a, b) => a - b)
    const middle = Math.floor(sortedAmounts.length / 2)
    const typical = sortedAmounts.length % 2
      ? sortedAmounts[middle]
      : (sortedAmounts[middle - 1] + sortedAmounts[middle]) / 2
    const multiplier = readiness?.stage === 'learning' ? 3 : 2
    const threshold = Math.max(500, typical * multiplier)

    if (transaction.amount < threshold) return { shouldComment: false }

    const normalizedProfile = normalizeProfile(profile)
    const copy = createTransactionCopy(normalizedProfile, transaction, {
      typical,
    })

    return {
      shouldComment: true,
      messageId: randomUUID(),
      scene: 'unusual_expense',
      persona: normalizedProfile.persona,
      personaName: personaName(normalizedProfile.persona),
      transactionId,
      anomaly: 'high_amount',
      readinessStage: readiness?.stage || 'established',
      ...copy,
      generatedAt: new Date().toISOString(),
    }
  }

  function saveFeedback({
    messageId,
    persona,
    scene,
    feedback,
    toneIntensity,
  } = {}) {
    if (typeof messageId !== 'string' || !messageId.trim()) {
      throw new TypeError('messageId is required')
    }
    if (!supportedPersonas.has(persona)) {
      throw new TypeError('persona is not supported')
    }
    if (!['home_open', 'unusual_expense', 'monthly_review'].includes(scene)) {
      throw new TypeError('scene is not supported')
    }
    if (!['like', 'dislike'].includes(feedback)) {
      throw new TypeError('feedback must be like or dislike')
    }

    const result = database
      .prepare(`
        INSERT INTO personality_feedback (
          message_id, persona, scene, feedback, tone_intensity
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        messageId.trim(),
        persona,
        scene,
        feedback,
        supportedTones.has(toneIntensity) ? toneIntensity : null,
      )

    return { id: Number(result.lastInsertRowid), feedback }
  }

  return { createHomeMessage, createTransactionComment, saveFeedback }
}

module.exports = createPersonalityService
