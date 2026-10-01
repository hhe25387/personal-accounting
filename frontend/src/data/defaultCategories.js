const categoryNames = {
  expense: ['Dining', 'Transport', 'Shopping', 'Housing', 'Entertainment', 'Healthcare', 'Education', 'Utilities', 'Other Expense'],
  income: ['Salary', 'Bonus', 'Side Income', 'Investment Income', 'Gift Money', 'Refund', 'Other Income'],
}

export const defaultCategories = Object.entries(categoryNames).flatMap(
  ([type, names]) =>
    names.map((name, index) => ({
      id: `fallback-${type}-${index}`,
      type,
      name,
      isDefault: true,
    })),
)
