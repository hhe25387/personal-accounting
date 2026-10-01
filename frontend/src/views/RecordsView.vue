<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'
import { defaultCategories } from '@/data/defaultCategories'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { language, t, tc } = useI18n()

const transactions = ref([])
const loading = ref(true)
const error = ref('')
const editingTransaction = ref(null)
const categories = ref([])
const categoryCreating = ref(false)
const categoryCreateError = ref('')
const saving = ref(false)
const editFeedback = ref('')
const editFeedbackTone = ref('success')
const PAGE_SIZE = 25
const filters = reactive({
  type: '',
  category: '',
  keyword: '',
  dateMode: 'week',
  month: new Date().toISOString().slice(0, 7),
  startDate: '',
  endDate: '',
  sort: 'date_desc',
})
const appliedFilterCount = ref(0)
const filterError = ref('')
const totalCount = ref(0)
const hasMore = ref(false)
const nextOffset = ref(0)
const loadingMore = ref(false)
let filterTimer

const availableFilterCategories = computed(() => {
  const names = categories.value
    .filter((category) => !filters.type || category.type === filters.type)
    .map((category) => category.name)
  return [...new Set(names)]
})

watch(
  () => filters.type,
  () => {
    if (
      filters.category &&
      !availableFilterCategories.value.includes(filters.category)
    ) {
      filters.category = ''
    }
  },
)

watch(
  () => [
    filters.type,
    filters.category,
    filters.keyword,
    filters.dateMode,
    filters.month,
    filters.startDate,
    filters.endDate,
    filters.sort,
  ],
  () => {
    window.clearTimeout(filterTimer)
    if (
      (filters.dateMode === 'month' && !filters.month) ||
      (filters.dateMode === 'range' && !filters.startDate && !filters.endDate)
    ) {
      filterError.value = ''
      return
    }
    filterTimer = window.setTimeout(loadTransactions, 120)
  },
)

function lastDayOfMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentWeekRange() {
  const today = new Date()
  const weekday = today.getDay() || 7
  const start = new Date(today)
  start.setDate(today.getDate() - weekday + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) }
}

function relativeDate({ months = 0, years = 0 }) {
  const today = new Date()
  const targetDay = today.getDate()
  today.setDate(1)
  if (months) today.setMonth(today.getMonth() - months)
  if (years) today.setFullYear(today.getFullYear() - years)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  today.setDate(Math.min(targetDay, lastDay))
  return formatLocalDate(today)
}

function buildFilterParams() {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.category) params.set('category', filters.category)
  if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
  const [sortBy, sortOrder] = filters.sort.split('_')
  params.set('sortBy', sortBy)
  params.set('sortOrder', sortOrder)

  if (filters.dateMode === 'week') {
    const week = currentWeekRange()
    params.set('startDate', week.startDate)
    params.set('endDate', week.endDate)
  }

  if (filters.dateMode === 'halfYear') {
    params.set('startDate', relativeDate({ months: 6 }))
    params.set('endDate', formatLocalDate(new Date()))
  }

  if (filters.dateMode === 'year') {
    params.set('startDate', relativeDate({ years: 1 }))
    params.set('endDate', formatLocalDate(new Date()))
  }

  if (filters.dateMode === 'month') {
    if (!filters.month) throw new Error('Select a month')
    params.set('startDate', `${filters.month}-01`)
    params.set(
      'endDate',
      `${filters.month}-${String(lastDayOfMonth(filters.month)).padStart(2, '0')}`,
    )
  }

  if (filters.dateMode === 'range') {
    if (!filters.startDate && !filters.endDate) {
      throw new Error('Select at least a start or end date')
    }
    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      throw new Error('The start date cannot be after the end date')
    }
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
  }

  return params
}

function countAppliedFilters() {
  return Number(Boolean(filters.type)) +
    Number(Boolean(filters.category)) +
    Number(Boolean(filters.keyword.trim())) +
    Number(!['week', 'all'].includes(filters.dateMode))
}

function keepMatchingTransactions(result, params) {
  const type = params.get('type')
  const category = params.get('category')
  const keyword = params.get('keyword')?.toLocaleLowerCase('en-US')
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  const matching = result.filter((transaction) =>
    (!type || transaction.type === type) &&
    (!category || transaction.category === category) &&
    (!keyword ||
      transaction.category.toLocaleLowerCase('en-US').includes(keyword) ||
      (transaction.description || '').toLocaleLowerCase('en-US').includes(keyword)) &&
    (!startDate || transaction.transactionDate >= startDate) &&
    (!endDate || transaction.transactionDate <= endDate),
  )
  const direction = params.get('sortOrder') === 'asc' ? 1 : -1
  if (params.get('sortBy') === 'amount') {
    return matching.sort((first, second) =>
      (Number(first.amount) - Number(second.amount)) * direction ||
      second.transactionDate.localeCompare(first.transactionDate) ||
      Number(second.id) - Number(first.id),
    )
  }
  return matching.sort((first, second) =>
    first.transactionDate.localeCompare(second.transactionDate) * direction ||
    (Number(first.id) - Number(second.id)) * direction,
  )
}

async function loadTransactions({ append = false } = {}) {
  if (append) loadingMore.value = true
  else {
    loading.value = true
    hasMore.value = false
    nextOffset.value = 0
  }
  if (!append) error.value = ''
  filterError.value = ''
  try {
    const params = buildFilterParams()
    const requestedOffset = append ? nextOffset.value : 0
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(requestedOffset))
    const compatibleParams = new URLSearchParams(params)
    let result
    let requestFailure
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const query = compatibleParams.toString()
      try {
        result = await apiRequest(
          `/api/transactions${query ? `?${query}` : ''}`,
          { fallbackMessage: 'Could not load transactions' },
        )
        requestFailure = null
        break
      } catch (attemptError) {
        requestFailure = attemptError
      }

      const unsupportedField = requestFailure.data?.message?.match(
        /^Unsupported filter: (sortBy|sortOrder|keyword|offset)$/,
      )?.[1]
      if (!unsupportedField) throw requestFailure
      if (unsupportedField.startsWith('sort')) {
        compatibleParams.delete('sortBy')
        compatibleParams.delete('sortOrder')
      } else {
        compatibleParams.delete(unsupportedField)
        if (unsupportedField === 'offset') compatibleParams.delete('limit')
      }
    }
    if (requestFailure) throw requestFailure
    const serverPaginated = !Array.isArray(result)
    const rawTransactions = serverPaginated ? result.transactions : result
    const matchingTransactions = keepMatchingTransactions(rawTransactions, params)
    const pageTransactions = serverPaginated
      ? matchingTransactions
      : matchingTransactions.slice(requestedOffset, requestedOffset + PAGE_SIZE)
    transactions.value = append
      ? [...transactions.value, ...pageTransactions]
      : pageTransactions
    totalCount.value = serverPaginated
      ? result.pagination.total
      : matchingTransactions.length
    nextOffset.value = serverPaginated
      ? requestedOffset + rawTransactions.length
      : requestedOffset + pageTransactions.length
    hasMore.value = serverPaginated
      ? result.pagination.hasMore
      : nextOffset.value < matchingTransactions.length
    appliedFilterCount.value = countAppliedFilters()
  } catch (loadError) {
    console.error(loadError)
    if (
      ['Select a month', 'Select at least a start or end date', 'The start date cannot be after the end date'].includes(
        loadError.message,
      )
    ) {
      filterError.value = loadError.message
    } else {
      error.value = loadError.message === 'Failed to fetch'
        ? 'Transactions are unavailable. Make sure the backend is running.'
        : loadError.message
    }
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

function loadMoreTransactions() {
  if (!loadingMore.value && hasMore.value) loadTransactions({ append: true })
}

function clearFilters() {
  filters.type = ''
  filters.category = ''
  filters.keyword = ''
  filters.dateMode = 'week'
  filters.month = new Date().toISOString().slice(0, 7)
  filters.startDate = ''
  filters.endDate = ''
  loadTransactions()
}

async function loadCategories() {
  try {
    categories.value = await apiRequest('/api/categories', {
      fallbackMessage: 'Could not load categories',
    })
  } catch (loadError) {
    console.error(loadError)
    categories.value = defaultCategories
  }
}

async function createCategory(categoryInput) {
  categoryCreating.value = true
  categoryCreateError.value = ''
  try {
    const result = await apiRequest('/api/categories', {
      method: 'POST',
      body: categoryInput,
      fallbackMessage: 'Could not add the category',
    })
    categories.value.push(result.category)
  } catch (createError) {
    console.error(createError)
    categoryCreateError.value = createError.message
  } finally {
    categoryCreating.value = false
  }
}

function startEditing(transaction) {
  editFeedback.value = ''
  editingTransaction.value = { ...transaction }
}

function cancelEditing() {
  editingTransaction.value = null
  editFeedback.value = ''
}

async function updateTransaction(transaction) {
  saving.value = true
  editFeedback.value = ''
  try {
    await apiRequest(
      `/api/transactions/${editingTransaction.value.id}`,
      {
        method: 'PUT',
        body: transaction,
        fallbackMessage: 'Could not update the transaction',
      },
    )
    editingTransaction.value = null
    await loadTransactions()
  } catch (updateError) {
    console.error(updateError)
    editFeedbackTone.value = 'error'
    editFeedback.value = updateError.message
  } finally {
    saving.value = false
  }
}

async function deleteTransaction(transactionId) {
  if (!window.confirm(language.value === 'zh' ? '删除这笔账目？此操作无法撤销。' : 'Delete this transaction? This cannot be undone.')) return
  try {
    await apiRequest(
      `/api/transactions/${transactionId}`,
      { method: 'DELETE', fallbackMessage: 'Could not delete the transaction' },
    )
    await loadTransactions()
  } catch (deleteError) {
    console.error(deleteError)
    error.value = deleteError.message
  }
}

onMounted(() => {
  loadTransactions()
  loadCategories()
})

onBeforeUnmount(() => window.clearTimeout(filterTimer))
</script>

<template>
  <main class="records-page">
    <header class="records-heading">
      <div>
        <p class="eyebrow">{{ t('Transactions').toLocaleUpperCase() }}</p>
        <h1>{{ t('Every transaction, all in one place') }}</h1>
        <p>{{ t('Review, filter, and organize your income and expenses.') }}</p>
      </div>
      <RouterLink to="/">{{ t('+ Add entry') }}</RouterLink>
    </header>

    <section class="records-workspace">
      <div class="records-list-column">
        <p v-if="error" class="records-status records-status--error" role="alert">{{ t(error) }}</p>
        <TransactionList
          :title="t('All Transactions')"
          :transactions="transactions"
          :total-count="totalCount"
          :empty-message="t(loading ? 'Loading transactions…' : appliedFilterCount ? 'No transactions match these filters' : 'No transactions yet')"
          @edit="startEditing"
          @delete="deleteTransaction"
        >
          <template #heading-actions>
            <label class="list-sort-field" for="filter-sort">
              <span>{{ t('Sort by') }}</span>
              <select id="filter-sort" v-model="filters.sort">
                <option value="date_desc">{{ t('Newest first') }}</option>
                <option value="date_asc">{{ t('Oldest first') }}</option>
                <option value="amount_desc">{{ t('Amount: high to low') }}</option>
                <option value="amount_asc">{{ t('Amount: low to high') }}</option>
              </select>
            </label>
          </template>
        </TransactionList>
        <button v-if="hasMore" type="button" class="load-more-button" :disabled="loadingMore" @click="loadMoreTransactions">
          {{ loadingMore ? t('Loading…') : (language === 'zh' ? `加载更多（剩余 ${Math.max(totalCount - transactions.length, 0)} 笔）` : `Load more (${Math.max(totalCount - transactions.length, 0)} remaining)`) }}
        </button>
      </div>

      <aside class="records-filter-panel" aria-labelledby="filter-title">
        <div class="filter-panel-heading">
          <div><p class="eyebrow">{{ t('FILTER') }}</p><h2 id="filter-title">{{ t('Filter Transactions') }}</h2></div>
          <button v-if="appliedFilterCount" type="button" class="clear-filter-button" @click="clearFilters">{{ t('Clear filters') }}</button>
        </div>
        <p class="filter-hint">{{ t('This week is shown by default. Filters update automatically; sorting is preserved.') }}</p>
        <form class="records-filter-form" @submit.prevent="loadTransactions">
          <label class="filter-field keyword-field" for="filter-keyword">
            <span>{{ t('Keyword search') }}</span>
            <div>
              <span aria-hidden="true">⌕</span>
              <input id="filter-keyword" v-model="filters.keyword" type="search" maxlength="80" :placeholder="t('Search categories or notes')" autocomplete="off" />
            </div>
          </label>
          <fieldset class="type-filter">
            <legend>{{ t('Entry type') }}</legend>
            <div>
              <label v-for="option in [{ value: '', label: 'All' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]" :key="option.value">
                <input v-model="filters.type" type="radio" name="transaction-type" :value="option.value" />
                <span>{{ t(option.label) }}</span>
              </label>
            </div>
          </fieldset>
          <label class="filter-field" for="filter-category">
            <span>{{ t('Category') }}</span>
            <select id="filter-category" v-model="filters.category">
              <option value="">{{ t('All categories') }}</option>
              <option v-for="category in availableFilterCategories" :key="category" :value="category">{{ tc(category) }}</option>
            </select>
          </label>
          <label class="filter-field" for="filter-date-mode">
            <span>{{ t('Date range') }}</span>
            <select id="filter-date-mode" v-model="filters.dateMode">
              <option value="week">{{ t('This week') }}</option>
              <option value="all">{{ t('All time') }}</option>
              <option value="month">{{ t('By month') }}</option>
              <option value="halfYear">{{ t('Last 6 months') }}</option>
              <option value="year">{{ t('Last 12 months') }}</option>
              <option value="range">{{ t('Custom dates') }}</option>
            </select>
          </label>
          <label v-if="filters.dateMode === 'month'" class="filter-field" for="filter-month">
            <span>{{ t('Select month') }}</span>
            <input id="filter-month" v-model="filters.month" type="month" />
          </label>
          <div v-if="filters.dateMode === 'range'" class="date-range-fields">
            <label class="filter-field" for="filter-start-date"><span>{{ t('Start date') }}</span><input id="filter-start-date" v-model="filters.startDate" type="date" /></label>
            <label class="filter-field" for="filter-end-date"><span>{{ t('End date') }}</span><input id="filter-end-date" v-model="filters.endDate" type="date" /></label>
          </div>
        </form>
        <p v-if="filterError" class="filter-error" role="alert">{{ t(filterError) }}</p>
        <p v-else-if="appliedFilterCount" class="filter-result">{{ language === 'zh' ? `已应用 ${appliedFilterCount} 个筛选条件` : `${appliedFilterCount} filters applied` }}<br />{{ language === 'zh' ? `找到 ${transactions.length} 笔账目` : `${transactions.length} transactions found` }}</p>
      </aside>
    </section>

    <div v-if="editingTransaction" class="records-edit-overlay">
      <div class="records-edit-dialog" role="dialog" aria-modal="true" :aria-label="t('Edit Entry')">
        <TransactionForm
          :editing-transaction="editingTransaction"
          :categories="categories"
          :category-creating="categoryCreating"
          :category-create-error="categoryCreateError"
          :saving="saving"
          :feedback-message="editFeedback"
          :feedback-tone="editFeedbackTone"
          @submit="updateTransaction"
          @cancel="cancelEditing"
          @create-category="createCategory"
          @clear-category-error="categoryCreateError = ''"
          @clear-feedback="editFeedback = ''"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.records-page{width:min(1180px,calc(100% - 60px));margin:0 auto;padding:64px 0 80px}.records-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:30px}.records-heading h1{margin:8px 0;font-family:Georgia,serif;font-size:clamp(3rem,6vw,5.5rem);font-weight:500;line-height:1}.records-heading>div>p:last-child{color:#68736c}.records-heading>a{padding:12px 17px;border-radius:10px;color:#fff;text-decoration:none;background:#2d6049;font-weight:800}.records-workspace{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;align-items:start}.records-list-column{min-width:0}.records-filter-panel{position:sticky;top:24px;padding:22px;border:1px solid #dcdad2;border-radius:18px;background:#fffdf8}.filter-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.filter-panel-heading h2{margin:3px 0 0;font-family:Georgia,serif;font-size:1.5rem;font-weight:500}.filter-hint{margin:10px 0 20px;color:#858c86;font-size:.74rem;line-height:1.5}.clear-filter-button{padding:4px 0;border:0;color:#2d6049;background:transparent;font-size:.75rem;font-weight:800;cursor:pointer}.records-filter-form{display:grid;gap:15px}.type-filter{margin:0;padding:0;border:0}.type-filter legend,.filter-field>span{display:block;margin-bottom:6px;color:#59645d;font-size:.75rem;font-weight:800}.type-filter>div{display:grid;grid-template-columns:repeat(3,1fr);padding:3px;border-radius:10px;background:#efede7}.type-filter label{cursor:pointer}.type-filter input{position:absolute;opacity:0;pointer-events:none}.type-filter label span{display:block;padding:9px 8px;border-radius:8px;color:#657069;text-align:center;font-size:.82rem}.type-filter input:checked+span{color:#fff;background:#2d6049}.filter-field select,.filter-field input{width:100%;height:41px;min-width:0;padding:0 10px;border:1px solid #d8d7d0;border-radius:9px;outline:none;background:#fff}.filter-field select:focus,.filter-field input:focus,.list-sort-field select:focus{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.1)}.keyword-field>div{display:flex;align-items:center;border:1px solid #d8d7d0;border-radius:9px;background:#fff}.keyword-field>div:focus-within{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.1)}.keyword-field>div>span{padding-left:10px;color:#7b847e}.keyword-field input{border:0;box-shadow:none!important}.date-range-fields{display:grid;gap:15px}.list-sort-field{display:grid;gap:4px}.list-sort-field>span{color:#7a837d;font-size:.68rem;font-weight:750}.list-sort-field select{height:36px;max-width:155px;padding:0 9px;border:1px solid #d8d7d0;border-radius:8px;outline:none;background:#fff;font-size:.78rem}.load-more-button{display:block;width:min(320px,100%);margin:14px auto 0;padding:11px 16px;border:1px solid #2d6049;border-radius:10px;color:#2d6049;background:#fffdf8;font-weight:800;cursor:pointer}.load-more-button:disabled{cursor:wait;opacity:.6}.filter-error,.filter-result{margin:16px 0 0;padding-top:13px;border-top:1px solid #e4e1d9;font-size:.78rem;line-height:1.55}.filter-error{color:#b8413c}.filter-result{color:#657069}.records-status{margin-bottom:12px;padding:14px 18px;border:1px solid #deddd5;border-radius:12px;background:#fffdf8}.records-status--error{color:#b8413c}.records-edit-overlay{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(24,39,31,.48);backdrop-filter:blur(3px)}.records-edit-dialog{width:min(660px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:20px;box-shadow:0 30px 90px rgba(24,39,31,.3)}@media(max-width:1180px){.records-workspace{grid-template-columns:1fr}.records-filter-panel{position:static}}@media(max-width:760px){.records-page{width:calc(100% - 28px);padding:34px 0}.records-heading{display:block}.records-heading h1{font-size:3rem}.records-heading>a{display:inline-block;margin-top:12px}.records-edit-overlay{align-items:end;padding:12px}.records-edit-dialog{max-height:calc(100vh - 84px)}}
</style>
