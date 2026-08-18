<script setup>
import { computed, ref, watch } from 'vue'

import SummaryCards from '@/components/SummaryCards.vue'
import { useI18n } from '@/i18n'

const { language, locale, t, tc } = useI18n()

const selectedMonth = ref(currentMonth())
const summary = ref(null)
const dailyData = ref(null)
const categoryData = ref(null)
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

async function loadOverview() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''

  try {
    const month = encodeURIComponent(selectedMonth.value)
    const responses = await Promise.all([
      fetch(`http://localhost:3000/api/statistics/summary?month=${month}`, {
        credentials: 'include',
      }),
      fetch(`http://localhost:3000/api/statistics/daily?month=${month}`, {
        credentials: 'include',
      }),
      fetch(
        `http://localhost:3000/api/statistics/categories?month=${month}&type=expense`,
        { credentials: 'include' },
      ),
    ])

    if (responses.some((response) => !response.ok)) {
      throw new Error('Could not load the monthly overview')
    }

    const [nextSummary, nextDailyData, nextCategoryData] =
      await Promise.all(responses.map((response) => response.json()))

    if (currentRequest !== requestId) return
    summary.value = nextSummary
    dailyData.value = nextDailyData
    categoryData.value = nextCategoryData
  } catch (loadError) {
    console.error(loadError)
    if (currentRequest !== requestId) return
    error.value = 'The monthly overview is unavailable. Make sure the backend is running.'
    summary.value = null
    dailyData.value = null
    categoryData.value = null
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
