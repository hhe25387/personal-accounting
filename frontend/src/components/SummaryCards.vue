<script setup>
import { computed } from 'vue'

const props = defineProps({
  transactions: {
    type: Array,
    required: true,
  },
})

const incomeTotal = computed(() => {
  return props.transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
})

const expenseTotal = computed(() => {
  return props.transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
})

const balance = computed(() => {
  return incomeTotal.value - expenseTotal.value
})

function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`
}
</script>

<template>
  <section class="summary-grid" aria-label="账目汇总">
    <article class="summary-card summary-card--income">
      <span>总收入</span>
      <strong data-test="income-total">
        {{ formatCurrency(incomeTotal) }}
      </strong>
    </article>

    <article class="summary-card summary-card--expense">
      <span>总支出</span>
      <strong data-test="expense-total">
        {{ formatCurrency(expenseTotal) }}
      </strong>
    </article>

    <article class="summary-card">
      <span>当前结余</span>
      <strong data-test="balance-total">
        {{ formatCurrency(balance) }}
      </strong>
    </article>
  </section>
</template>