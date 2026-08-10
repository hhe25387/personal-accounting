<script setup>
defineProps({
  transactions: {
    type: Array,
    required: true,
  },
})

function formatAmount(transaction) {
  const sign = transaction.type === 'income' ? '+' : '-'
  return `${sign}$${Number(transaction.amount).toFixed(2)}`
}
</script>

<template>
  <section class="panel transaction-list">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">TRANSACTIONS</p>
        <h2>账目记录</h2>
      </div>

      <span>{{ transactions.length }} 笔</span>
    </div>

    <p v-if="transactions.length === 0" class="empty-state">
      目前还没有账目
    </p>

    <ul v-else>
      <li
        v-for="transaction in transactions"
        :key="transaction.id"
        data-test="transaction-row"
        class="transaction-row"
      >
        <div>
          <strong>{{ transaction.category }}</strong>

          <p>
            {{ transaction.transactionDate }}
            ·
            {{ transaction.description || '无备注' }}
          </p>
        </div>

        <span
          class="transaction-amount"
          :class="`transaction-amount--${transaction.type}`"
        >
          {{ formatAmount(transaction) }}
        </span>
      </li>
    </ul>
  </section>
</template>