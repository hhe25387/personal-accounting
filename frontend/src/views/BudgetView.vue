<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import { useI18n } from '@/i18n'

const { language, locale, t, tc } = useI18n()

const selectedMonth = ref(currentMonth())
const budget = ref(null)
const categories = ref([])
const loading = ref(true)
const saving = ref(false)
const editing = ref(false)
const error = ref('')
const formError = ref('')
const totalAmount = ref('')
const categoryRows = ref([])
let rowId = 0
let requestId = 0

const expenseCategories = computed(() =>
  categories.value.filter((category) => category.type === 'expense'),
)

const monthTitle = computed(() => {
  const [year, month] = selectedMonth.value.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    locale.value,
    { month: 'long', year: 'numeric' },
  )
})

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMoney(value) {
  return `¥${Number(value).toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function statusLabel(status) {
  return t(status === 'exceeded'
    ? 'Over budget'
    : status === 'warning'
      ? 'Approaching limit'
      : 'On track')
}

function progressWidth(percentage) {
  return `${Math.min(Math.max(Number(percentage), 0), 100)}%`
}

function nextAvailableCategory() {
  const selected = new Set(categoryRows.value.map((row) => row.category))
  return expenseCategories.value.find((category) => !selected.has(category.name))?.name || ''
}

function createRow(category = '', amount = '') {
  rowId += 1
  return { id: rowId, category: category || nextAvailableCategory(), amount }
}

function beginEditing() {
  totalAmount.value = budget.value?.total?.limit ?? ''
  categoryRows.value = (budget.value?.categories || []).map((item) =>
    createRow(item.category, item.limit),
  )
  formError.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  formError.value = ''
}

function addCategoryRow() {
  const category = nextAvailableCategory()
  if (!category) return
  categoryRows.value.push(createRow(category))
}

function removeCategoryRow(id) {
  categoryRows.value = categoryRows.value.filter((row) => row.id !== id)
}

function requestError(requestFailure) {
  return requestFailure.message === 'Failed to fetch'
    ? t('Cannot connect to the server. Make sure the backend is running.')
    : t(requestFailure.message)
}

async function readResponse(response, fallbackMessage) {
  try {
    return await response.json()
  } catch {
    throw new Error(response.ok ? fallbackMessage : 'Budget API is unavailable. Restart the backend server.')
  }
}

async function loadCategories() {
  try {
    const response = await fetch('http://localhost:3000/api/categories?type=expense', {
      credentials: 'include',
    })
    const result = await readResponse(response, 'Could not load categories')
    if (!response.ok) throw new Error(result.message || 'Could not load categories')
    categories.value = result
  } catch (loadError) {
    console.error(loadError)
    error.value = requestError(loadError)
  }
}

async function loadBudget() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  editing.value = false
  try {
    const response = await fetch(
      `http://localhost:3000/api/budgets?month=${encodeURIComponent(selectedMonth.value)}`,
      { credentials: 'include' },
    )
    const result = await readResponse(response, 'Could not load the budget')
    if (!response.ok) throw new Error(result.message || 'Could not load the budget')
    if (currentRequest === requestId) budget.value = result
  } catch (loadError) {
    console.error(loadError)
    if (currentRequest === requestId) {
      budget.value = null
      error.value = requestError(loadError)
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function validateForm() {
  const hasTotal = totalAmount.value !== '' && totalAmount.value !== null
  if (hasTotal && Number(totalAmount.value) <= 0) return t('Total budget must be greater than 0')
  const seen = new Set()
  for (const row of categoryRows.value) {
    if (!row.category) return t('Select a category for every category budget')
    if (!row.amount || Number(row.amount) <= 0) return t('Category budgets must be greater than 0')
    const key = row.category.toLocaleLowerCase('en-US')
    if (seen.has(key)) return t('Each category can only appear once')
    seen.add(key)
  }
  if (!hasTotal && !categoryRows.value.length) {
    return t('Set a total budget or at least one category budget')
  }
  return ''
}

async function saveBudget() {
  formError.value = validateForm()
  if (formError.value) return
  saving.value = true
  try {
    const response = await fetch(
      `http://localhost:3000/api/budgets/${selectedMonth.value}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: totalAmount.value === '' ? null : Number(totalAmount.value),
          categories: categoryRows.value.map((row) => ({
            category: row.category,
            amount: Number(row.amount),
          })),
        }),
      },
    )
    const result = await readResponse(response, 'Could not save the budget')
    if (!response.ok) throw new Error(result.message || 'Could not save the budget')
    budget.value = result.budget
    editing.value = false
  } catch (saveError) {
    console.error(saveError)
    formError.value = requestError(saveError)
  } finally {
    saving.value = false
  }
}

async function removeBudget() {
  const confirmed = window.confirm(
    language.value === 'zh'
      ? `删除 ${selectedMonth.value} 的预算？账目不会受到影响。`
      : `Remove the budget for ${selectedMonth.value}? Your transactions will not be affected.`,
  )
  if (!confirmed) return
  saving.value = true
  try {
    const response = await fetch(
      `http://localhost:3000/api/budgets/${selectedMonth.value}`,
      { method: 'DELETE', credentials: 'include' },
    )
    const result = await readResponse(response, 'Could not remove the budget')
    if (!response.ok) throw new Error(result.message || 'Could not remove the budget')
    await loadBudget()
  } catch (removeError) {
    console.error(removeError)
    error.value = requestError(removeError)
  } finally {
    saving.value = false
  }
}

watch(selectedMonth, loadBudget)
onMounted(async () => {
  await Promise.all([loadCategories(), loadBudget()])
})
</script>

<template>
  <main class="budget-page">
    <header class="budget-heading">
      <div>
        <p class="eyebrow">{{ t('BUDGET') }}</p>
        <h1>{{ t('Plan lightly, spend clearly') }}</h1>
        <p>{{ t('A budget is optional. Set one only when it helps you make a decision.') }}</p>
      </div>
      <label class="budget-month-picker">
        <span>{{ t('Budget month') }}</span>
        <input v-model="selectedMonth" type="month" :aria-label="t('Budget month')" />
      </label>
    </header>

    <p v-if="error" class="budget-alert budget-alert--error" role="alert">{{ error }}</p>

    <section v-if="loading" class="budget-state" aria-live="polite">
      <span aria-hidden="true">◌</span>
      <h2>{{ t('Loading budget…') }}</h2>
    </section>

    <section v-else-if="!budget?.configured && !editing" class="budget-empty">
      <div class="budget-empty-mark" aria-hidden="true">◎</div>
      <p class="eyebrow">{{ monthTitle }}</p>
      <h2>{{ t('No budget, no problem') }}</h2>
      <p>{{ t('You can keep recording normally. Add a total or category budget whenever you want a spending boundary.') }}</p>
      <button type="button" class="budget-primary" @click="beginEditing">{{ t('Set a budget') }}</button>
      <small>{{ t('This will not change or block any transaction.') }}</small>
    </section>

    <template v-else-if="budget?.configured && !editing">
      <section class="budget-overview-heading">
        <div><p class="eyebrow">{{ monthTitle }}</p><h2>{{ t('Budget progress') }}</h2></div>
        <div><button type="button" @click="beginEditing">{{ t('Edit budget') }}</button><button type="button" class="budget-remove" :disabled="saving" @click="removeBudget">{{ t('Remove') }}</button></div>
      </section>

      <article v-if="budget.total" class="budget-total-card" :data-status="budget.total.status">
        <div class="budget-total-copy">
          <p class="eyebrow">{{ t('TOTAL BUDGET') }}</p>
          <h2>{{ formatMoney(budget.total.remaining) }}</h2>
          <p>{{ budget.total.remaining >= 0 ? t('remaining this month') : t('over the monthly budget') }}</p>
        </div>
        <div class="budget-total-numbers">
          <span><small>{{ t('Spent') }}</small><strong>{{ formatMoney(budget.total.spent) }}</strong></span>
          <span><small>{{ t('Limit') }}</small><strong>{{ formatMoney(budget.total.limit) }}</strong></span>
          <em>{{ statusLabel(budget.total.status) }}</em>
        </div>
        <div class="budget-progress"><i :style="{ width: progressWidth(budget.total.percentage) }"></i></div>
        <small class="budget-percentage">{{ budget.total.percentage }}%</small>
      </article>

      <section v-if="budget.categories.length" class="category-budget-section">
        <div class="category-budget-heading"><p class="eyebrow">{{ t('CATEGORY BUDGETS') }}</p><h2>{{ t('Where each limit stands') }}</h2></div>
        <div class="category-budget-grid">
          <article v-for="item in budget.categories" :key="item.category" class="category-budget-card" :data-status="item.status">
            <header><strong>{{ tc(item.category) }}</strong><span>{{ statusLabel(item.status) }}</span></header>
            <div class="category-budget-money"><strong>{{ formatMoney(item.spent) }}</strong><span>/ {{ formatMoney(item.limit) }}</span></div>
            <div class="budget-progress"><i :style="{ width: progressWidth(item.percentage) }"></i></div>
            <footer><span>{{ item.percentage }}%</span><span>{{ item.remaining >= 0 ? `${formatMoney(item.remaining)} ${t('left')}` : `${formatMoney(Math.abs(item.remaining))} ${t('over')}` }}</span></footer>
          </article>
        </div>
      </section>

      <section v-if="!budget.total && !budget.categories.length" class="budget-state"><h2>{{ t('No active limits for this month') }}</h2></section>
    </template>

    <section v-if="editing" class="budget-editor" aria-labelledby="budget-editor-title">
      <header>
        <div><p class="eyebrow">{{ t('SET LIMITS') }}</p><h2 id="budget-editor-title">{{ budget?.configured ? t('Edit monthly budget') : t('Create monthly budget') }}</h2></div>
        <button type="button" :disabled="saving" @click="cancelEditing">{{ t('Cancel') }}</button>
      </header>

      <div class="total-budget-field">
        <label for="total-budget">{{ t('Total monthly budget') }} <small>{{ t('optional') }}</small></label>
        <div><span>¥</span><input id="total-budget" v-model="totalAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" :disabled="saving" /></div>
        <p>{{ t('Use this for one overall boundary. You can also leave it empty and set only category budgets.') }}</p>
      </div>

      <div class="category-budget-editor">
        <div><h3>{{ t('Category budgets') }}</h3><p>{{ t('Optional limits for the categories you want to watch more closely.') }}</p></div>
        <div v-for="row in categoryRows" :key="row.id" class="category-budget-row">
          <label><span>{{ t('Category') }}</span><select v-model="row.category" :disabled="saving"><option value="">{{ t('Select a category') }}</option><option v-for="category in expenseCategories" :key="category.id" :value="category.name" :disabled="categoryRows.some((other) => other.id !== row.id && other.category === category.name)">{{ tc(category.name) }}</option></select></label>
          <label><span>{{ t('Limit') }}</span><div><span>¥</span><input v-model="row.amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" :disabled="saving" /></div></label>
          <button type="button" :aria-label="t('Remove category budget')" :disabled="saving" @click="removeCategoryRow(row.id)">×</button>
        </div>
        <button v-if="categoryRows.length < expenseCategories.length" type="button" class="add-category-budget" :disabled="saving || !expenseCategories.length" @click="addCategoryRow">＋ {{ t('Add category budget') }}</button>
      </div>

      <p v-if="formError" class="budget-alert budget-alert--error" role="alert">{{ formError }}</p>
      <div class="budget-editor-actions">
        <button type="button" class="budget-primary" :disabled="saving" @click="saveBudget">{{ saving ? t('Saving…') : t('Save budget') }}</button>
        <small>{{ t('Alerts are informational and never prevent you from recording an expense.') }}</small>
      </div>
    </section>
  </main>
</template>

<style scoped>
.budget-page{width:min(1120px,calc(100% - 60px));margin:0 auto;padding:64px 0 90px;color:#20352b}.eyebrow{margin:0;color:#2d6049;font-size:.72rem;font-weight:850;letter-spacing:.18em}.budget-heading{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:30px}.budget-heading h1{max-width:760px;margin:8px 0;font-family:Georgia,serif;font-size:clamp(3.2rem,7vw,6rem);font-weight:500;line-height:.98}.budget-heading>div>p:last-child{color:#68736c}.budget-month-picker{display:grid;gap:6px;flex:0 0 185px}.budget-month-picker span{color:#69746d;font-size:.75rem;font-weight:800}.budget-month-picker input{height:44px;padding:0 11px;border:1px solid #d7d6ce;border-radius:10px;outline:none;background:#fffdf8}.budget-month-picker input:focus{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.1)}.budget-alert{padding:13px 15px;border-radius:11px;font-size:.82rem}.budget-alert--error{color:#a6403a;background:#f9e8e5}.budget-state,.budget-empty{display:grid;min-height:360px;place-items:center;align-content:center;padding:42px;border:1px solid #d9d8d0;border-radius:24px;background:#fffdf8;text-align:center}.budget-state span,.budget-empty-mark{display:grid;width:66px;height:66px;place-items:center;margin-bottom:17px;border-radius:50%;color:#2d6049;background:#e7f0ea;font-size:1.7rem}.budget-state h2,.budget-empty h2{margin:6px 0 10px;font-family:Georgia,serif;font-size:2rem;font-weight:500}.budget-empty>p:not(.eyebrow){max-width:550px;margin:0 0 23px;color:#707a73;line-height:1.6}.budget-empty>small{margin-top:12px;color:#8a918c}.budget-primary{padding:12px 18px;border:0;border-radius:10px;color:#fff;background:#2d6049;font-weight:800;cursor:pointer}.budget-primary:disabled{cursor:wait;opacity:.6}.budget-overview-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:16px}.budget-overview-heading h2{margin:4px 0 0;font-family:Georgia,serif;font-size:2rem;font-weight:500}.budget-overview-heading>div:last-child{display:flex;gap:8px}.budget-overview-heading button{padding:9px 12px;border:1px solid #c8cdc9;border-radius:9px;color:#2d6049;background:#fffdf8;cursor:pointer;font-weight:750}.budget-overview-heading .budget-remove{color:#ae4942;border-color:#e4c7c3}.budget-total-card{position:relative;display:grid;grid-template-columns:1fr auto;gap:20px;padding:28px;border:1px solid #d6d8d2;border-radius:22px;background:#fffdf8;overflow:hidden}.budget-total-copy h2{margin:8px 0 0;font-family:Georgia,serif;font-size:clamp(2.6rem,5vw,4.2rem);font-weight:500}.budget-total-copy>p:last-child{margin:3px 0;color:#707a73}.budget-total-numbers{display:flex;align-items:center;gap:25px}.budget-total-numbers span small,.budget-total-numbers span strong{display:block}.budget-total-numbers small{color:#7b847e;font-size:.7rem}.budget-total-numbers strong{margin-top:4px;font-size:.95rem}.budget-total-numbers em,.category-budget-card header span{padding:6px 9px;border-radius:99px;color:#287052;background:#e6f1ea;font-size:.68rem;font-style:normal;font-weight:850}.budget-progress{height:8px;border-radius:99px;background:#e8e7e1;overflow:hidden}.budget-progress i{display:block;height:100%;border-radius:inherit;background:#3c795c}.budget-total-card>.budget-progress{grid-column:1/-1}.budget-percentage{position:absolute;right:28px;bottom:8px;color:#768078}.budget-total-card[data-status=warning] .budget-progress i,.category-budget-card[data-status=warning] .budget-progress i{background:#d19b32}.budget-total-card[data-status=warning] em,.category-budget-card[data-status=warning] header span{color:#896119;background:#fbefcf}.budget-total-card[data-status=exceeded] .budget-progress i,.category-budget-card[data-status=exceeded] .budget-progress i{background:#c8554d}.budget-total-card[data-status=exceeded] em,.category-budget-card[data-status=exceeded] header span{color:#a63e38;background:#f8e3e0}.category-budget-section{margin-top:28px}.category-budget-heading h2{margin:5px 0 15px;font-family:Georgia,serif;font-size:1.7rem;font-weight:500}.category-budget-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.category-budget-card{padding:20px;border:1px solid #d9d8d0;border-radius:16px;background:#fffdf8}.category-budget-card header,.category-budget-card footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.category-budget-money{display:flex;align-items:baseline;gap:5px;margin:18px 0 12px}.category-budget-money strong{font-family:Georgia,serif;font-size:1.7rem;font-weight:500}.category-budget-money span,.category-budget-card footer{color:#7a837d;font-size:.72rem}.category-budget-card footer{margin-top:8px}.budget-editor{padding:28px;border:1px solid #d8d7cf;border-radius:22px;background:#fffdf8}.budget-editor>header{display:flex;align-items:flex-start;justify-content:space-between}.budget-editor>header h2{margin:5px 0 0;font-family:Georgia,serif;font-size:2rem;font-weight:500}.budget-editor>header button{padding:7px;border:0;color:#627067;background:transparent;cursor:pointer}.total-budget-field{margin-top:25px;padding:20px;border-radius:15px;background:#f1efe9}.total-budget-field>label{display:block;margin-bottom:7px;font-weight:800}.total-budget-field>label small{color:#858d87;font-weight:500}.total-budget-field>div,.category-budget-row label>div{display:flex;height:46px;align-items:center;border:1px solid #d4d4cc;border-radius:10px;background:#fff}.total-budget-field>div>span,.category-budget-row label>div>span{padding-left:12px;color:#69746d}.total-budget-field input,.category-budget-row input{min-width:0;flex:1;height:100%;padding:0 11px;border:0;outline:0;background:transparent}.total-budget-field>p,.category-budget-editor>div:first-child p{margin:8px 0 0;color:#7e8781;font-size:.75rem}.category-budget-editor{margin-top:25px}.category-budget-editor h3{margin:0;font-family:Georgia,serif;font-size:1.35rem;font-weight:500}.category-budget-row{display:grid;grid-template-columns:1fr 200px 36px;align-items:end;gap:10px;margin-top:13px}.category-budget-row label>span{display:block;margin-bottom:6px;color:#58645c;font-size:.75rem;font-weight:800}.category-budget-row select{width:100%;height:46px;padding:0 10px;border:1px solid #d4d4cc;border-radius:10px;background:#fff}.category-budget-row>button{height:46px;border:1px solid #e1cfcc;border-radius:9px;color:#af4942;background:#fff;cursor:pointer;font-size:1.1rem}.add-category-budget{margin-top:14px;padding:8px 0;border:0;color:#2d6049;background:transparent;cursor:pointer;font-weight:800}.budget-editor-actions{display:flex;align-items:center;gap:14px;margin-top:20px;padding-top:18px;border-top:1px solid #e1dfd8}.budget-editor-actions small{color:#7f8781}.budget-editor .budget-alert{margin-top:18px}@media(max-width:900px){.category-budget-grid{grid-template-columns:repeat(2,1fr)}.budget-total-card{grid-template-columns:1fr}.budget-total-numbers{justify-content:space-between}.category-budget-row{grid-template-columns:1fr 160px 36px}}@media(max-width:760px){.budget-page{width:calc(100% - 28px);padding:35px 0}.budget-heading{display:block}.budget-heading h1{font-size:3.2rem}.budget-month-picker{margin-top:20px}.category-budget-grid{grid-template-columns:1fr}.budget-total-numbers{align-items:flex-start;flex-direction:column;gap:10px}.category-budget-row{grid-template-columns:1fr 36px}.category-budget-row label:nth-child(2){grid-column:1}.category-budget-row>button{grid-column:2;grid-row:1/3}.budget-editor-actions{align-items:flex-start;flex-direction:column}.budget-primary{width:100%}}
</style>
