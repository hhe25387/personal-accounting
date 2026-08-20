<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { language, useI18n } from '@/i18n'

const { t, tc } = useI18n()

const props = defineProps({
  editingTransaction: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
  categoriesLoading: { type: Boolean, default: false },
  categoriesError: { type: String, default: '' },
  categoryCreating: { type: Boolean, default: false },
  categoryCreateError: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  savedRevision: { type: Number, default: 0 },
  feedbackMessage: { type: String, default: '' },
  feedbackTone: { type: String, default: 'success' },
  prefillAmount: { type: Number, default: 0 },
  prefillRevision: { type: Number, default: 0 },
  prefillTemplate: { type: Object, default: null },
  prefillTemplateRevision: { type: Number, default: 0 },
  budget: { type: Object, default: null },
})

const emit = defineEmits([
  'submit',
  'cancel',
  'create-category',
  'clear-category-error',
  'clear-feedback',
  'draft-change',
])

const selectedType = ref('expense')
const amount = ref('')
const transactionDate = ref(today())
const description = ref('')
const selectedByType = ref({ expense: '', income: '' })
const showMoreCategories = ref(false)
const isAddingCategory = ref(false)
const newCategoryName = ref('')
const pendingCategoryName = ref('')
const validationMessage = ref('')
const amountInput = ref(null)

const selectedCategory = computed({
  get: () => selectedByType.value[selectedType.value],
  set: (category) => {
    selectedByType.value[selectedType.value] = category
  },
})

const availableCategories = computed(() =>
  props.categories.filter((category) => category.type === selectedType.value),
)
const commonCategories = computed(() => availableCategories.value.slice(0, 4))
const moreCategories = computed(() => availableCategories.value.slice(4))
const budgetProjection = computed(() => {
  const entryAmount = Number(amount.value)
  if (
    selectedType.value !== 'expense' ||
    !Number.isFinite(entryAmount) ||
    entryAmount <= 0 ||
    !props.budget?.configured
  ) return []

  const limits = []
  if (props.budget.total) {
    limits.push(projectBudgetItem(t('Total budget'), props.budget.total, entryAmount))
  }

  const categoryBudget = props.budget.categories?.find(
    (item) => item.category.toLocaleLowerCase('en-US') === selectedCategory.value.toLocaleLowerCase('en-US'),
  )
  if (categoryBudget) {
    limits.push(projectBudgetItem(tc(categoryBudget.category), categoryBudget, entryAmount))
  }
  return limits
})

function projectBudgetItem(label, budgetItem, entryAmount) {
  const projectedSpent = budgetItem.spent + entryAmount
  const percentage = Number(((projectedSpent / budgetItem.limit) * 100).toFixed(1))
  return {
    label,
    limit: budgetItem.limit,
    projectedSpent,
    remaining: budgetItem.limit - projectedSpent,
    percentage,
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'safe',
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat(language.value === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

function projectionStatus(status) {
  return t(status === 'exceeded' ? 'Over budget' : status === 'warning' ? 'Approaching limit' : 'On track')
}

function today() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function selectType(type) {
  if (selectedType.value === type) return
  selectedType.value = type
  showMoreCategories.value = false
  closeCategoryCreator()
  validationMessage.value = ''
  emit('clear-feedback')
}

function selectCategory(category) {
  selectedCategory.value = category
  validationMessage.value = ''
}

function openCategoryCreator() {
  emit('clear-category-error')
  isAddingCategory.value = true
  newCategoryName.value = ''
  pendingCategoryName.value = ''
}

function closeCategoryCreator() {
  isAddingCategory.value = false
  newCategoryName.value = ''
  pendingCategoryName.value = ''
}

function cancelCategoryCreation() {
  emit('clear-category-error')
  closeCategoryCreator()
}

function requestCategoryCreation() {
  const normalizedName = newCategoryName.value.trim()
  if (!normalizedName || props.categoryCreating) return

  pendingCategoryName.value = normalizedName
  emit('create-category', { type: selectedType.value, name: normalizedName })
}

function cancelEditing() {
  emit('cancel')
}

function submitTransaction() {
  emit('clear-feedback')
  validationMessage.value = ''

  if (!amount.value || Number(amount.value) <= 0) {
    validationMessage.value = t('Enter an amount greater than 0')
    amountInput.value?.focus()
    return
  }
  if (!selectedCategory.value) {
    validationMessage.value = t('Select a category')
    return
  }
  if (!transactionDate.value) {
    validationMessage.value = t('Select a date')
    return
  }

  emit('submit', {
    type: selectedType.value,
    amount: Number(amount.value),
    category: selectedCategory.value,
    transactionDate: transactionDate.value,
    description: description.value,
  })
}

function focusAmountWithShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    amountInput.value?.focus()
    amountInput.value?.select()
  }
}

watch(
  () => props.categories,
  (categories) => {
    for (const type of ['expense', 'income']) {
      const typeCategories = categories.filter((category) => category.type === type)
      const currentStillExists = typeCategories.some(
        (category) => category.name === selectedByType.value[type],
      )
      if (!currentStillExists && typeCategories.length > 0) {
        selectedByType.value[type] = typeCategories[0].name
      }
    }

    if (pendingCategoryName.value) {
      const created = categories.find(
        (category) =>
          category.type === selectedType.value &&
          category.name === pendingCategoryName.value,
      )
      if (created) {
        selectedCategory.value = created.name
        closeCategoryCreator()
      }
    }
  },
  { deep: true, immediate: true },
)

watch(
  () => props.editingTransaction,
  (transaction) => {
    if (!transaction) return
    selectedType.value = transaction.type
    selectedCategory.value = transaction.category
    amount.value = transaction.amount
    transactionDate.value = transaction.transactionDate
    description.value = transaction.description || ''
    validationMessage.value = ''
  },
  { immediate: true },
)

watch(
  () => props.savedRevision,
  () => {
    amount.value = ''
    description.value = ''
    transactionDate.value = today()
    validationMessage.value = ''
    closeCategoryCreator()
    requestAnimationFrame(() => amountInput.value?.focus())
  },
)

watch(
  () => props.prefillRevision,
  () => {
    if (!props.prefillAmount || props.editingTransaction) return
    selectedType.value = 'expense'
    amount.value = props.prefillAmount
    validationMessage.value = ''
    requestAnimationFrame(() => amountInput.value?.focus())
  },
)

watch(
  () => props.prefillTemplateRevision,
  () => {
    const template = props.prefillTemplate
    if (!template || props.editingTransaction) return
    selectedType.value = template.type
    selectedByType.value[template.type] = template.category
    amount.value = template.amount ?? ''
    description.value = template.description || ''
    transactionDate.value = today()
    showMoreCategories.value = !props.categories
      .filter((category) => category.type === template.type)
      .slice(0, 4)
      .some((category) => category.name === template.category)
    validationMessage.value = ''
    closeCategoryCreator()
    requestAnimationFrame(() => amountInput.value?.focus())
  },
)

watch(
  [selectedType, amount, selectedCategory, transactionDate],
  () => emit('draft-change', {
    type: selectedType.value,
    amount: Number(amount.value) || 0,
    category: selectedCategory.value,
    transactionDate: transactionDate.value,
  }),
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('keydown', focusAmountWithShortcut)
  amountInput.value?.focus()
})
onUnmounted(() => document.removeEventListener('keydown', focusAmountWithShortcut))
</script>

<template>
  <section class="panel transaction-form" :data-entry-type="selectedType">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">{{ t(editingTransaction ? 'EDIT ENTRY' : 'QUICK ENTRY') }}</p>
        <h2>{{ t(editingTransaction ? 'Edit Entry' : 'Quick Entry') }}</h2>
      </div>
      <div class="panel-heading__actions">
        <slot name="tools" />
        <span class="shortcut" :title="t('Focus amount field')">⌘ K</span>
      </div>
    </div>

    <form @submit.prevent="submitTransaction">
      <div class="entry-type-toggle" :aria-label="t('Entry type')">
        <button
          type="button"
          data-test="expense-button"
          :class="{ 'is-active': selectedType === 'expense' }"
          :aria-pressed="selectedType === 'expense'"
          @click="selectType('expense')"
        >
          {{ t('Expense') }}
        </button>
        <button
          type="button"
          data-test="income-button"
          :class="{ 'is-active': selectedType === 'income' }"
          :aria-pressed="selectedType === 'income'"
          @click="selectType('income')"
        >
          {{ t('Income') }}
        </button>
      </div>

      <label for="amount">{{ t(selectedType === 'expense' ? 'How much did you spend?' : 'How much did you receive?') }}</label>
      <div class="amount-field">
        <span>{{ selectedType === 'expense' ? '− ¥' : '+ ¥' }}</span>
        <input
          id="amount"
          ref="amountInput"
          v-model.number="amount"
          type="number"
          min="0.01"
          step="0.01"
          inputmode="decimal"
          placeholder="0.00"
          :disabled="saving"
        />
      </div>

      <div class="category-label-row">
        <label>{{ t(selectedType === 'expense' ? 'What was it for?' : 'Where did it come from?') }}</label>
        <span v-if="categoriesLoading">{{ t('Loading…') }}</span>
      </div>

      <div v-if="availableCategories.length" class="category-chip-grid">
        <button
          v-for="category in commonCategories"
          :key="category.id"
          type="button"
          class="category-chip"
          :class="{ 'is-selected': selectedCategory === category.name }"
          :aria-pressed="selectedCategory === category.name"
          @click="selectCategory(category.name)"
        >
          {{ tc(category.name) }}
        </button>

        <button
          v-if="moreCategories.length"
          type="button"
          class="category-chip category-chip--more"
          :aria-expanded="showMoreCategories"
          @click="showMoreCategories = !showMoreCategories"
        >
          {{ t(showMoreCategories ? 'Show less' : 'More') }}
        </button>
      </div>

      <div v-if="showMoreCategories" class="category-chip-grid category-chip-grid--more">
        <button
          v-for="category in moreCategories"
          :key="category.id"
          type="button"
          class="category-chip"
          :class="{ 'is-selected': selectedCategory === category.name }"
          :aria-pressed="selectedCategory === category.name"
          @click="selectCategory(category.name)"
        >
          {{ tc(category.name) }}
        </button>
      </div>

      <select id="category" v-model="selectedCategory" class="visually-hidden" tabindex="-1" aria-hidden="true" :disabled="categoriesLoading || Boolean(categoriesError)">
        <option value="">{{ t('Select a category') }}</option>
        <option v-for="category in availableCategories" :key="category.id" :value="category.name">{{ tc(category.name) }}</option>
      </select>

      <p v-if="categoriesError" class="field-error" role="alert">{{ t(categoriesError) }}</p>
      <p v-else-if="!categoriesLoading && !availableCategories.length" class="field-error" role="status">{{ t('No categories are available') }}</p>

      <button
        v-if="!isAddingCategory && !categoriesError"
        type="button"
        class="add-category-button"
        data-test="open-category-creator"
        :disabled="categoriesLoading"
        @click="openCategoryCreator"
      >
        + {{ t('Add') }} {{ t(selectedType === 'income' ? 'income source' : 'expense category') }}
      </button>

      <div v-if="isAddingCategory" class="category-creator">
        <label for="new-category-name">{{ t('New') }} {{ t(selectedType === 'income' ? 'income source' : 'expense category') }}</label>
        <div class="category-creator-controls">
          <input id="new-category-name" v-model="newCategoryName" type="text" maxlength="40" :placeholder="t('e.g. Scholarship')" :disabled="categoryCreating" @keydown.enter.prevent="requestCategoryCreation" />
          <button type="button" class="primary-button" data-test="create-category" :disabled="categoryCreating || !newCategoryName.trim()" @click="requestCategoryCreation">{{ t(categoryCreating ? 'Adding…' : 'Add') }}</button>
          <button type="button" class="secondary-button" :disabled="categoryCreating" @click="cancelCategoryCreation">{{ t('Cancel') }}</button>
        </div>
        <p v-if="categoryCreateError" class="field-error" role="alert">{{ t(categoryCreateError) }}</p>
      </div>

      <div class="entry-secondary-grid">
        <div>
          <label for="transaction-date">{{ t('Date') }}</label>
          <input id="transaction-date" v-model="transactionDate" type="date" :disabled="saving" />
        </div>
        <div>
          <label for="description">{{ t('Note (optional)') }}</label>
          <input id="description" v-model="description" type="text" :placeholder="t('e.g. Dinner with friends')" :disabled="saving" />
        </div>
      </div>

      <section v-if="budgetProjection.length" class="budget-impact" aria-live="polite">
        <header>
          <div>
            <p>{{ t('AFTER THIS ENTRY') }}</p>
            <h3>{{ t('Estimated budget impact') }}</h3>
          </div>
          <span>{{ t('Preview only') }}</span>
        </header>
        <div
          v-for="item in budgetProjection"
          :key="item.label"
          class="budget-impact-row"
          :data-status="item.status"
        >
          <div class="budget-impact-label">
            <strong>{{ item.label }}</strong>
            <span>{{ formatMoney(item.projectedSpent) }} / {{ formatMoney(item.limit) }}</span>
          </div>
          <div class="budget-impact-track" aria-hidden="true">
            <i :style="{ width: `${Math.min(item.percentage, 100)}%` }"></i>
          </div>
          <div class="budget-impact-meta">
            <span>{{ projectionStatus(item.status) }} · {{ item.percentage }}%</span>
            <span>{{ t(item.remaining >= 0 ? 'Remaining after entry' : 'Over by after entry') }}: {{ formatMoney(Math.abs(item.remaining)) }}</span>
          </div>
        </div>
        <small>{{ t('This preview never blocks saving your entry.') }}</small>
      </section>

      <p v-if="validationMessage" class="form-feedback" data-tone="error" role="alert">{{ validationMessage }}</p>
      <p v-else-if="feedbackMessage" class="form-feedback" :data-tone="feedbackTone" role="status">{{ t(feedbackMessage) }}</p>

      <div class="entry-actions">
        <button type="submit" class="primary-button" :disabled="saving">
          {{ t(saving ? 'Saving…' : editingTransaction ? 'Save changes' : selectedType === 'expense' ? 'Save expense' : 'Save income') }}
        </button>
        <button v-if="editingTransaction" type="button" class="secondary-button" :disabled="saving" @click="cancelEditing">{{ t('Cancel editing') }}</button>
      </div>
    </form>
  </section>
</template>
