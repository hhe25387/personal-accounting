<script setup>
import { computed, ref, watch } from 'vue'

import SummaryCards from '@/components/SummaryCards.vue'
import { useI18n } from '@/i18n'
import { apiRequest } from '@/services/apiClient'

const { language, locale, t, tc } = useI18n()

const selectedMonth = ref(currentMonth())
const summary = ref(null)
const dailyData = ref(null)
const categoryData = ref(null)
const monthlyReport = ref(null)
const monthlyReportError = ref('')
const loading = ref(true)
const error = ref('')
let requestId = 0

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const monthTitle = computed(() => {
  const [year, month] = selectedMonth.value.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
  })
})

const completeDays = computed(() => {
  if (!dailyData.value) return []

  const values = new Map(dailyData.value.days.map((day) => [day.date, day]))
  const lastDay = Number(dailyData.value.endDate.slice(-2))

  return Array.from({ length: lastDay }, (_, index) => {
    const dayNumber = index + 1
    const date = `${selectedMonth.value}-${String(dayNumber).padStart(2, '0')}`
    return values.get(date) || {
      date,
      income: 0,
      expense: 0,
      transactionCount: 0,
    }
  })
})

const chartMaximum = computed(() =>
  Math.max(
    1,
    ...completeDays.value.flatMap((day) => [day.income, day.expense]),
  ),
)

const reportNarrative = computed(() => {
  const report = monthlyReport.value
  if (!report || report.dataLevel === 'empty') {
    return t('Record your first transaction to unlock this monthly review.')
  }

  const expense = formatMoney(report.summary.totalExpense)
  const count = report.summary.transactionCount
  if (!report.comparison.hasPreviousData) {
    return language.value === 'zh'
      ? `本月已记录 ${count} 笔账目，支出 ${expense}。继续记录后即可看到月度变化。`
      : `You recorded ${count} entries and spent ${expense} this month. Keep recording to unlock month-over-month changes.`
  }

  const change = report.comparison.expense
  if (change.direction === 'stable') {
    return language.value === 'zh'
      ? `本月支出 ${expense}，与上月基本持平。`
      : `You spent ${expense} this month, staying level with last month.`
  }
  const direction = change.direction === 'up'
    ? t('more than last month')
    : t('less than last month')
  const changeText = change.percentageChange === null
    ? formatMoney(Math.abs(change.difference))
    : `${Math.abs(change.percentageChange)}%`
  return language.value === 'zh'
    ? `本月支出 ${expense}，比上月${change.direction === 'up' ? '增加' : '减少'} ${changeText}。`
    : `You spent ${expense} this month, ${changeText} ${direction}.`
})

function barHeight(value) {
  if (!value) return '2px'
  return `${Math.max(8, (Number(value) / chartMaximum.value) * 100)}%`
}

function formatMoney(value) {
  return `¥${Number(value).toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatSignedMoney(value) {
  if (Number(value) === 0) return formatMoney(0)
  return `${Number(value) > 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`
}

function formatDays(value) {
  return language.value === 'zh' ? `${value} 天` : `${value} days`
}

function comparisonTone(metric, positiveIsGood = false) {
  if (metric.direction === 'stable') return 'neutral'
  const favorable = positiveIsGood
    ? metric.direction === 'up'
    : metric.direction === 'down'
  return favorable ? 'good' : 'bad'
}

async function loadOverview() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  monthlyReportError.value = ''

  try {
    const month = encodeURIComponent(selectedMonth.value)
    const [nextSummary, nextDailyData, nextCategoryData, nextMonthlyReport] = await Promise.all([
      apiRequest(`/api/statistics/summary?month=${month}`, {
        fallbackMessage: 'Could not load the monthly overview',
      }),
      apiRequest(`/api/statistics/daily?month=${month}`, {
        fallbackMessage: 'Could not load the monthly overview',
      }),
      apiRequest(`/api/statistics/categories?month=${month}&type=expense`, {
        fallbackMessage: 'Could not load the monthly overview',
      }),
      apiRequest(`/api/reports/monthly?month=${month}`, {
        fallbackMessage: 'Could not load the monthly report',
      }).catch((reportError) => {
        console.error(reportError)
        monthlyReportError.value = 'The monthly report is temporarily unavailable.'
        return null
      }),
    ])

    if (currentRequest !== requestId) return
    summary.value = nextSummary
    dailyData.value = nextDailyData
    categoryData.value = nextCategoryData
    monthlyReport.value = nextMonthlyReport
  } catch (loadError) {
    console.error(loadError)
    if (currentRequest !== requestId) return
    error.value = 'The monthly overview is unavailable. Make sure the backend is running.'
    summary.value = null
    dailyData.value = null
    categoryData.value = null
    monthlyReport.value = null
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(selectedMonth, loadOverview, { immediate: true })
</script>

<template>
  <main class="overview-page">
    <header class="overview-heading">
      <div>
        <p class="eyebrow">{{ t('MONTHLY OVERVIEW') }}</p>
        <h1>{{ t('Understand this month') }}</h1>
        <p>{{ t('Trends show when you spent; categories show where the money went.') }}</p>
      </div>
      <label class="month-picker">
        <span>{{ t('View month') }}</span>
        <input v-model="selectedMonth" type="month" :aria-label="t('View month')" />
      </label>
    </header>

    <SummaryCards
      :transactions="[]"
      :summary="summary"
      :loading="loading"
      :error="error"
    />

    <section class="monthly-review" aria-labelledby="monthly-review-title">
      <div class="monthly-review-heading">
        <div>
          <p class="eyebrow">{{ t('MONTH IN REVIEW') }}</p>
          <h2 id="monthly-review-title">{{ t('Monthly Report') }}</h2>
        </div>
        <span>{{ monthTitle }}</span>
      </div>

      <div v-if="loading" class="monthly-review-loading">{{ t('Preparing your monthly report…') }}</div>
      <div v-else-if="monthlyReport" class="monthly-review-content" :data-level="monthlyReport.dataLevel">
        <p class="monthly-review-narrative">{{ reportNarrative }}</p>

        <div v-if="monthlyReport.dataLevel !== 'empty'" class="monthly-review-metrics">
          <article>
            <span>{{ t('Savings rate') }}</span>
            <strong>{{ monthlyReport.summary.savingsRate === null ? '—' : `${monthlyReport.summary.savingsRate}%` }}</strong>
            <small>{{ t(monthlyReport.summary.savingsRate === null ? 'Add income to calculate it' : 'Income kept after expenses') }}</small>
          </article>
          <article>
            <span>{{ t('Active days') }}</span>
            <strong>{{ formatDays(monthlyReport.activity.activeDays) }}</strong>
            <small>{{ t('Days with recorded activity') }}</small>
          </article>
          <article>
            <span>{{ t('Average spending day') }}</span>
            <strong>{{ formatMoney(monthlyReport.activity.averagePerSpendingDay) }}</strong>
            <small>{{ t('Average across days with expenses') }}</small>
          </article>
          <article>
            <span>{{ t('Largest expense') }}</span>
            <strong>{{ monthlyReport.largestExpense ? formatMoney(monthlyReport.largestExpense.amount) : '—' }}</strong>
            <small>{{ monthlyReport.largestExpense ? `${tc(monthlyReport.largestExpense.category)} · ${monthlyReport.largestExpense.transactionDate}` : t('No expenses this month') }}</small>
          </article>
        </div>

        <div v-if="monthlyReport.dataLevel !== 'empty'" class="monthly-review-details">
          <article>
            <p class="eyebrow">{{ t('MONTH OVER MONTH') }}</p>
            <h3>{{ t('Compared with last month') }}</h3>
            <p v-if="!monthlyReport.comparison.hasPreviousData" class="monthly-review-muted">{{ t('There is not enough previous-month data for a comparison yet.') }}</p>
            <dl v-else class="monthly-comparison-list">
              <div><dt>{{ t('Expense') }}</dt><dd :data-tone="comparisonTone(monthlyReport.comparison.expense)">{{ formatSignedMoney(monthlyReport.comparison.expense.difference) }}</dd></div>
              <div><dt>{{ t('Income') }}</dt><dd :data-tone="comparisonTone(monthlyReport.comparison.income, true)">{{ formatSignedMoney(monthlyReport.comparison.income.difference) }}</dd></div>
              <div><dt>{{ t('Balance') }}</dt><dd :data-tone="comparisonTone(monthlyReport.comparison.balance, true)">{{ formatSignedMoney(monthlyReport.comparison.balance.difference) }}</dd></div>
            </dl>
          </article>
          <article>
            <p class="eyebrow">{{ t('KEY MOVEMENT') }}</p>
            <h3>{{ t('Category to notice') }}</h3>
            <template v-if="monthlyReport.comparison.hasPreviousData && monthlyReport.largestCategoryChange">
              <strong class="monthly-category-name">{{ tc(monthlyReport.largestCategoryChange.category) }}</strong>
              <p class="monthly-review-muted">
                {{ t('Change from last month') }}:
                <b :data-tone="comparisonTone(monthlyReport.largestCategoryChange)">{{ formatSignedMoney(monthlyReport.largestCategoryChange.difference) }}</b>
              </p>
            </template>
            <template v-else-if="monthlyReport.topCategory">
              <strong class="monthly-category-name">{{ tc(monthlyReport.topCategory.category) }}</strong>
              <p class="monthly-review-muted">{{ monthlyReport.topCategory.percentage }}% {{ t('of this month’s expenses') }}</p>
            </template>
            <p v-else class="monthly-review-muted">{{ t('No expense categories to compare yet.') }}</p>
          </article>
        </div>
      </div>
      <div v-else class="monthly-review-loading">{{ t(monthlyReportError || 'The monthly report is temporarily unavailable.') }}</div>
    </section>

    <p v-if="error" class="overview-error" role="alert">{{ error }}</p>

    <section class="overview-grid">
      <article class="overview-panel trend-panel">
        <div class="overview-panel-heading">
          <div><p class="eyebrow">{{ t('DAILY FLOW') }}</p><h2>{{ t('Daily Cash Flow') }}</h2></div>
          <div class="chart-legend"><span><i class="income"></i>{{ t('Income') }}</span><span><i class="expense"></i>{{ t('Expense') }}</span></div>
        </div>

        <div v-if="loading" class="overview-empty">{{ t('Preparing daily data…') }}</div>
        <div v-else-if="!completeDays.length" class="overview-empty">{{ t('No trend data for this month') }}</div>
        <div v-else class="daily-chart-scroll">
          <div class="daily-chart" :style="{ '--day-count': completeDays.length }">
            <div v-for="day in completeDays" :key="day.date" class="daily-column" :title="`${day.date}: ${t('Income')} ${formatMoney(day.income)}, ${t('Expense')} ${formatMoney(day.expense)}`">
              <div class="bar-pair">
                <i class="daily-bar daily-bar--income" :style="{ height: barHeight(day.income) }"></i>
                <i class="daily-bar daily-bar--expense" :style="{ height: barHeight(day.expense) }"></i>
              </div>
              <span>{{ Number(day.date.slice(-2)) }}</span>
            </div>
          </div>
        </div>
      </article>

      <article class="overview-panel category-panel">
        <div class="overview-panel-heading">
          <div><p class="eyebrow">{{ t('WHERE IT WENT') }}</p><h2>{{ t('Expenses by Category') }}</h2></div>
          <span>{{ monthTitle }}</span>
        </div>

        <div v-if="loading" class="overview-empty">{{ t('Calculating categories…') }}</div>
        <div v-else-if="!categoryData?.categories.length" class="overview-empty">{{ t('No expenses for this month') }}</div>
        <ol v-else class="category-breakdown">
          <li v-for="category in categoryData.categories" :key="category.category">
            <div><strong>{{ tc(category.category) }}</strong><span>{{ language === 'zh' ? `${category.transactionCount} 笔` : `${category.transactionCount} entries` }} · {{ category.percentage }}%</span></div>
            <strong>{{ formatMoney(category.amount) }}</strong>
            <span class="category-progress"><i :style="{ width: `${category.percentage}%` }"></i></span>
          </li>
        </ol>
      </article>
    </section>
  </main>
</template>
