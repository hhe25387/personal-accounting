<script setup>
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const { language, locale, t } = useI18n()

const props = defineProps({
  transactions: {
    type: Array,
    required: true,
  },
  summary: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const incomeTotal = computed(() => {
  if (props.summary) return Number(props.summary.totalIncome)
  return props.transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
})

const expenseTotal = computed(() => {
  if (props.summary) return Number(props.summary.totalExpense)
  return props.transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
})

const balance = computed(() => {
  if (props.summary) return Number(props.summary.balance)
  return incomeTotal.value - expenseTotal.value
})

function formatCurrency(amount) {
  return `¥${amount.toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
</script>

<template>
  <section class="summary-area" :aria-label="t('Monthly summary')">
    <div class="summary-caption">
      <span>{{ summary?.month || t('Current month') }}</span>
      <span v-if="summary">{{ language === 'zh' ? `本月共 ${summary.transactionCount} 笔` : `This month: ${summary.transactionCount} entries` }}</span>
      <span v-else-if="loading">{{ t('Loading this month…') }}</span>
      <span v-else-if="error" class="summary-error">{{ t(error) }}</span>
    </div>

    <div class="summary-grid">
    <article class="summary-card summary-card--income">
      <span>{{ t('Monthly income') }}</span>
      <strong data-test="income-total">
        {{ loading ? '—' : formatCurrency(incomeTotal) }}
      </strong>
    </article>

    <article class="summary-card summary-card--expense">
      <span>{{ t('Monthly expenses') }}</span>
      <strong data-test="expense-total">
        {{ loading ? '—' : formatCurrency(expenseTotal) }}
      </strong>
    </article>

    <article class="summary-card">
      <span>{{ t('Monthly balance') }}</span>
      <strong data-test="balance-total">
        {{ loading ? '—' : formatCurrency(balance) }}
      </strong>
    </article>
    </div>
  </section>
</template>
