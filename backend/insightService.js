function createInsightService(database) {
  function getReadiness(userId) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new TypeError('userId  must be a positive integer')
    }

    const row = database
      .prepare(`
        SELECT
          COUNT(*) AS transaction_count,
          COUNT(DISTINCT transaction_date) AS active_days
        FROM transactions
        WHERE user_id = ?
      `)
      .get(userId)
    const transactionCount = row.transaction_count
    const activeDays = row.active_days

    let stage = 'established'
    if (transactionCount < 5) stage = 'new'
    else if (transactionCount < 15 || activeDays < 7) stage = 'learning'

    const details = {
      new: {
        label: 'Getting started',
        message: 'Keep tracking for now; there is not enough data for spending insights yet.',
      },
      learning: {
        label: 'Learning your habits',
        message: 'Insights appear only when the evidence is clear, avoiding premature judgments.',
      },
      established: {
        label: 'Personal baseline ready',
        message: 'Insights use your history to identify changes worth noticing.',
      },
    }[stage]

    return {
      stage,
      ...details,
      transactionCount,
      activeDays,
      hasEnoughData: stage === 'established',
      nextMilestone:
        stage === 'new'
          ? { transactionCount: 5, activeDays: 0 }
          : stage === 'learning'
            ? { transactionCount: 15, activeDays: 7 }
            : null,
    }
  }

  return { getReadiness }
}

module.exports = createInsightService
