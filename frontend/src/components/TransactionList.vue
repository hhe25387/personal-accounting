<script setup>
import { useI18n } from '@/i18n'

const { language, locale, t, tc } = useI18n()
defineProps({
  transactions: {
    type: Array,
    required: true,
  },
  emptyMessage: {
    type: String,
    default: 'No transactions yet',
  },
  title: {
    type: String,
    default: 'Transactions',
  },
  totalCount: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['edit', 'delete'])

function formatAmount(transaction) {
  const sign = transaction.type === 'income' ? '+' : '-'
  return `${sign}¥${Number(transaction.amount).toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
</script>

<template>
  <section class="panel transaction-list">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">{{ t('Transactions').toLocaleUpperCase(locale) }}</p>
        <h2>{{ t(title) }}</h2>
      </div>

      <div class="panel-heading-actions">
        <slot name="heading-actions" />
        <span>
          {{ language === 'zh' ? (totalCount !== null && totalCount > transactions.length ? `显示 ${transactions.length} / ${totalCount} 笔` : `${transactions.length} 笔账目`) : (totalCount !== null && totalCount > transactions.length ? `Showing ${transactions.length} of ${totalCount}` : `${transactions.length} transactions`) }}
        </span>
      </div>
    </div>

    <p v-if="transactions.length === 0" class="empty-state">{{ emptyMessage }}</p>

    <ul v-else>
      <li
        v-for="transaction in transactions"
        :key="transaction.id"
        data-test="transaction-row"
        class="transaction-row"
      >
        <div>
          <strong>{{ tc(transaction.category) }}</strong>

          <p>
            {{ transaction.transactionDate }}
            ·
            {{ transaction.description || t('No note') }}
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
            :aria-label="`Edit ${transaction.category} transaction`"
            @click="emit('edit', transaction)"
          >
            {{ t('Edit') }}
          </button>

          <button
            type="button"
            class="delete-button"
            data-test="delete-transaction"
            :aria-label="`Delete ${transaction.category} transaction`"
            @click="emit('delete', transaction.id)"
          >
            {{ t('Delete') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel-heading-actions{display:flex;align-items:flex-end;gap:14px}.panel-heading-actions>span{padding-bottom:4px;color:#727c75;white-space:nowrap}@media(max-width:620px){.panel-heading{align-items:flex-start}.panel-heading-actions{align-items:flex-end;flex-direction:column-reverse;gap:6px}}
</style>
