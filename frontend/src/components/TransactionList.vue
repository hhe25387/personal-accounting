<script setup>
defineProps({
  transactions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['edit', 'delete'])

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

        <div class="transaction-actions">
          <span
            class="transaction-amount"
            :class="`transaction-amount--${transaction.type}`"
          >
            {{ formatAmount(transaction) }}
          </span>

          <button
            type="button"
            class="edit-button"
            data-test="edit-transaction"
            :aria-label="`编辑${transaction.category}账目`"
            @click="emit('edit', transaction)"
          >
            编辑
          </button>

          <button
            type="button"
            class="delete-button"
            data-test="delete-transaction"
            :aria-label="`删除${transaction.category}账目`"
            @click="emit('delete', transaction.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
