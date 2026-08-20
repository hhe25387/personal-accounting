<script setup>
import { onMounted, ref } from 'vue'

import AgentChat from '@/components/AgentChat.vue'
import QuickTemplates from '@/components/QuickTemplates.vue'
import SplitCalculator from '@/components/SplitCalculator.vue'
import SummaryCards from '@/components/SummaryCards.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import WeeklySummaryCard from '@/components/WeeklySummaryCard.vue'
import { defaultCategories } from '@/data/defaultCategories'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { t } = useI18n()

const monthlySummary = ref(null)
const summaryLoading = ref(true)
const summaryError = ref('')
const categories = ref([])
const categoriesLoading = ref(true)
const categoriesError = ref('')
const categoryCreating = ref(false)
const categoryCreateError = ref('')
const savingTransaction = ref(false)
const savedRevision = ref(0)
const formFeedback = ref('')
const formFeedbackTone = ref('success')
const calculatorSuggestion = ref({ amount: 0, revision: 0 })
const templates = ref([])
const templatesLoading = ref(true)
const templateSaving = ref(false)
const templateError = ref('')
const templateSuggestion = ref({ template: null, revision: 0 })
const lastSavedTransaction = ref(null)
const entryBudget = ref(null)
const weeklyReport = ref(null)
const weeklyReportLoading = ref(true)
const weeklyReportError = ref('')
let loadedBudgetMonth = ''
let budgetRequestId = 0

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function currentDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadWeeklyReport() {
  weeklyReportLoading.value = true
  weeklyReportError.value = ''
  try {
    weeklyReport.value = await apiRequest(
      `/api/reports/weekly?date=${currentDate()}`,
      { fallbackMessage: 'Could not load the weekly summary' },
    )
  } catch (error) {
    console.error(error)
    weeklyReport.value = null
    weeklyReportError.value = 'The weekly summary is temporarily unavailable.'
  } finally {
    weeklyReportLoading.value = false
  }
}

function monthFromDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.slice(0, 7) : ''
}

async function loadEntryBudget(month, { force = false } = {}) {
  if (!month || (!force && month === loadedBudgetMonth)) return
  const currentRequest = ++budgetRequestId
  loadedBudgetMonth = month

  try {
    const result = await apiRequest(
      `/api/budgets?month=${encodeURIComponent(month)}`,
      { fallbackMessage: 'Could not load the budget' },
    )
    if (currentRequest === budgetRequestId) entryBudget.value = result
  } catch (error) {
    console.error('Could not load entry budget:', error)
    if (currentRequest === budgetRequestId) entryBudget.value = null
  }
}

function handleDraftChange(draft) {
  if (draft.type !== 'expense') return
  loadEntryBudget(monthFromDate(draft.transactionDate))
}

function showFeedback(message, tone = 'success') {
  formFeedback.value = message
  formFeedbackTone.value = tone
}

function clearFeedback() {
  formFeedback.value = ''
}

async function loadMonthlySummary() {
  summaryLoading.value = true
  summaryError.value = ''

  try {
    const month = currentMonth()
    monthlySummary.value = await apiRequest(
      `/api/statistics/summary?month=${month}`,
      { fallbackMessage: 'Could not load the monthly summary' },
    )
  } catch (error) {
    console.error(error)
    monthlySummary.value = null
    summaryError.value = 'Monthly statistics are temporarily unavailable'
  } finally {
    summaryLoading.value = false
  }
}

async function loadCategories() {
  categoriesLoading.value = true
  categoriesError.value = ''

  try {
    categories.value = await apiRequest('/api/categories', {
      fallbackMessage: 'Could not load categories',
    })
  } catch (error) {
    console.error(error)
    categories.value = defaultCategories
    categoriesError.value = 'Using default categories. Start the backend to save entries and add categories.'
  } finally {
    categoriesLoading.value = false
  }
}

async function loadTemplates() {
  templatesLoading.value = true
  templateError.value = ''
  try {
    const result = await apiRequest('/api/templates', {
      fallbackMessage: 'Could not load templates',
    })
    templates.value = result.templates
  } catch (error) {
    console.error(error)
    templateError.value = error.message || 'Cannot connect to the server'
  } finally {
    templatesLoading.value = false
  }
}

async function saveTemplate({ id, payload }) {
  templateSaving.value = true
  templateError.value = ''
  try {
    await apiRequest(
      `/api/templates${id ? `/${id}` : ''}`,
      {
        method: id ? 'PUT' : 'POST',
        body: payload,
        fallbackMessage: 'Could not save the template',
      },
    )
    await loadTemplates()
    showFeedback(id ? 'Template updated' : 'Template saved')
  } catch (error) {
    console.error(error)
    templateError.value = error.message || 'Cannot connect to the server'
  } finally {
    templateSaving.value = false
  }
}

function createTemplate(request) {
  return saveTemplate(request)
}

function updateTemplate(request) {
  return saveTemplate(request)
}

async function deleteTemplate(templateId) {
  templateSaving.value = true
  templateError.value = ''
  try {
    await apiRequest(`/api/templates/${templateId}`, {
      method: 'DELETE',
      fallbackMessage: 'Could not delete the template',
    })
    await loadTemplates()
  } catch (error) {
    console.error(error)
    templateError.value = error.message || 'Cannot connect to the server'
  } finally {
    templateSaving.value = false
  }
}

function useTemplate(template) {
  templateSuggestion.value = {
    template,
    revision: templateSuggestion.value.revision + 1,
  }
  showFeedback(`Applied “${template.name}”. Confirm the amount before saving.`)

  apiRequest(`/api/templates/${template.id}/use`, {
    method: 'POST',
    fallbackMessage: 'Could not record template usage',
  })
    .then((result) => {
      if (result?.template) loadTemplates()
    })
    .catch((error) => console.error('Could not record template usage:', error))
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
  } catch (error) {
    console.error(error)
    categoryCreateError.value = error.message || 'Cannot connect to the server'
  } finally {
    categoryCreating.value = false
  }
}

function clearCategoryCreateError() {
  categoryCreateError.value = ''
}

async function saveTransaction(transaction) {
  savingTransaction.value = true
  clearFeedback()

  try {
    const result = await apiRequest('/api/transactions', {
      method: 'POST',
      body: transaction,
      fallbackMessage: 'Could not save',
    })

    await Promise.all([
      loadMonthlySummary(),
      loadEntryBudget(monthFromDate(transaction.transactionDate), { force: true }),
      loadWeeklyReport(),
    ])
    lastSavedTransaction.value = result.transaction
    savedRevision.value += 1
    showFeedback(
      `Recorded ¥${Number(transaction.amount).toFixed(2)} ${transaction.category}${transaction.type === 'income' ? 'Income' : 'Expense'}`,
    )
  } catch (error) {
    console.error(error)
    showFeedback(
      error.message === 'Failed to fetch'
        ? 'Cannot connect to the server. Your form entries have been preserved.'
        : error.message,
      'error',
    )
  } finally {
    savingTransaction.value = false
  }
}

async function submitTransaction(transaction) {
  await saveTransaction(transaction)
}

function useCalculatorAmount({ amount, source }) {
  calculatorSuggestion.value = {
    amount,
    revision: calculatorSuggestion.value.revision + 1,
  }
  showFeedback(
    source === 'share'
      ? `Your share has been filled in: ¥${Number(amount).toFixed(2)}`
      : `The full amount has been filled in: ¥${Number(amount).toFixed(2)}`,
  )
}

onMounted(() => {
  loadCategories()
  loadMonthlySummary()
  loadTemplates()
  loadWeeklyReport()
})
</script>

<template>
  <main id="top" class="dashboard">
    <section class="page-heading">
      <div>
        <p class="eyebrow">{{ t('QUICK ENTRY') }}</p>
        <h1>{{ t('Finish an entry,\nwithout breaking your rhythm').split('\n')[0] }}<br />{{ t('Finish an entry,\nwithout breaking your rhythm').split('\n')[1] }}</h1>
      </div>

      <p>{{ t('Record income and expenses in one simple form. Capture it now and understand it over time.') }}</p>
    </section>

    <SummaryCards
      :transactions="[]"
      :summary="monthlySummary"
      :loading="summaryLoading"
      :error="summaryError"
    />

    <WeeklySummaryCard
      :report="weeklyReport"
      :loading="weeklyReportLoading"
      :error="weeklyReportError"
    />

    <section class="dashboard-note" :aria-label="t('Entry reminder')">
      <span aria-hidden="true">✦</span>
      <p><strong>{{ t('You do not need to plan everything today.') }}</strong> {{ t('Take 30 seconds to record one entry and let your ledger organize the rest.') }}</p>
    </section>

    <QuickTemplates
      :templates="templates"
      :categories="categories"
      :loading="templatesLoading"
      :error="templateError"
      :saving="templateSaving"
      :last-transaction="lastSavedTransaction"
      @use="useTemplate"
      @create="createTemplate"
      @update="updateTemplate"
      @delete="deleteTemplate"
      @retry="loadTemplates"
    />

    <section class="dashboard-entry">
      <TransactionForm
        :categories="categories"
        :categories-loading="categoriesLoading"
        :categories-error="categoriesError"
        :category-creating="categoryCreating"
        :category-create-error="categoryCreateError"
        :saving="savingTransaction"
        :saved-revision="savedRevision"
        :feedback-message="formFeedback"
        :feedback-tone="formFeedbackTone"
        :prefill-amount="calculatorSuggestion.amount"
        :prefill-revision="calculatorSuggestion.revision"
        :prefill-template="templateSuggestion.template"
        :prefill-template-revision="templateSuggestion.revision"
        :budget="entryBudget"
        @submit="submitTransaction"
        @draft-change="handleDraftChange"
        @create-category="createCategory"
        @clear-category-error="clearCategoryCreateError"
        @clear-feedback="clearFeedback"
      />
      <SplitCalculator @use-amount="useCalculatorAmount" />
    </section>
  </main>

  <AgentChat />
</template>
