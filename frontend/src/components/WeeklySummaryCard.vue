<script setup>
import { computed, ref } from 'vue'

import { useI18n } from '@/i18n'

const { language, locale, t, tc } = useI18n()

const props = defineProps({
  report: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const expanded = ref(false)

const periodLabel = computed(() => {
  if (!props.report) return t('This week')
  const start = formatDate(props.report.period.startDate)
  const through = formatDate(props.report.period.throughDate)
  return start === through ? start : `${start} – ${through}`
})

const narrative = computed(() => {
  const report = props.report
  if (!report || report.dataLevel === 'empty') {
    return t('No transactions this week yet. Start with one entry when you are ready.')
  }

  const expense = formatMoney(report.summary.totalExpense)
  const count = report.summary.transactionCount
  if (!report.comparison.hasPreviousExpenseData) {
    return language.value === 'zh'
      ? `本周已记录 ${count} 笔账目，支出 ${expense}。继续记录后即可进行同期比较。`
      : `You recorded ${count} entries and spent ${expense} this week. Keep recording to unlock a fair comparison.`
  }

  const comparison = report.comparison.expense
  if (comparison.direction === 'stable') {
    return language.value === 'zh'
      ? `本周截至目前支出 ${expense}，与上周同期持平。`
      : `You spent ${expense} so far this week, level with the same point last week.`
  }
  const change = `${Math.abs(comparison.percentageChange)}%`
  return language.value === 'zh'
    ? `本周截至目前支出 ${expense}，比上周同期${comparison.direction === 'up' ? '增加' : '减少'} ${change}。`
    : `You spent ${expense} so far this week, ${change} ${comparison.direction === 'up' ? 'more' : 'less'} than the same point last week.`
})

const comparisonLabel = computed(() => {
  const comparison = props.report?.comparison
  if (!comparison?.hasPreviousExpenseData) return '—'
  if (comparison.expense.direction === 'stable') return t('No change')
  return `${comparison.expense.direction === 'up' ? '↑' : '↓'} ${Math.abs(comparison.expense.percentageChange)}%`
})

const comparisonTone = computed(() => {
  const direction = props.report?.comparison.expense.direction
  return direction === 'up' ? 'bad' : direction === 'down' ? 'good' : 'neutral'
})

const completedDays = computed(() => {
  if (!props.report) return []
  const values = new Map(props.report.days.map((day) => [day.date, day.expense]))
  const result = []
  const cursor = new Date(`${props.report.period.startDate}T12:00:00`)
  const through = new Date(`${props.report.period.throughDate}T12:00:00`)
  while (cursor <= through) {
    const date = formatInputDate(cursor)
    result.push({ date, expense: values.get(date) || 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
})

const maximumDailyExpense = computed(() =>
  Math.max(1, ...completedDays.value.map((day) => day.expense)),
)

function formatInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
  })
}

function formatWeekday(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale.value, {
    weekday: 'narrow',
  })
}

function formatMoney(value) {
  return `¥${Number(value).toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function entryLabel(value) {
  return language.value === 'zh' ? `${value} 笔` : `${value} entries`
}

function barHeight(value) {
  return value ? `${Math.max(10, (value / maximumDailyExpense.value) * 100)}%` : '3px'
}
</script>

<template>
  <section class="weekly-summary" aria-labelledby="weekly-summary-title">
    <header class="weekly-summary__heading">
      <div>
        <p class="eyebrow">{{ t('WEEKLY CHECK-IN') }}</p>
        <h2 id="weekly-summary-title">{{ t('This week') }}</h2>
      </div>
      <span>{{ periodLabel }}</span>
    </header>

    <div v-if="loading" class="weekly-summary__state">{{ t('Preparing this week…') }}</div>
    <div v-else-if="error" class="weekly-summary__state weekly-summary__state--error">{{ t(error) }}</div>
    <template v-else-if="report">
      <div class="weekly-summary__main">
        <p>{{ narrative }}</p>
        <dl class="weekly-summary__metrics">
          <div>
            <dt>{{ t('Spent this week') }}</dt>
            <dd>{{ formatMoney(report.summary.totalExpense) }}</dd>
          </div>
          <div>
            <dt>{{ t('Vs. last week') }}</dt>
            <dd :data-tone="comparisonTone">{{ comparisonLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('Entries') }}</dt>
            <dd>{{ entryLabel(report.summary.transactionCount) }}</dd>
          </div>
        </dl>
      </div>

      <button
        v-if="report.dataLevel !== 'empty'"
        class="weekly-summary__toggle"
        type="button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ t(expanded ? 'Hide details' : 'Show details') }}
        <span aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
      </button>

      <div v-if="expanded" class="weekly-summary__details">
        <article>
          <span>{{ t('Weekly income') }}</span>
          <strong>{{ formatMoney(report.summary.totalIncome) }}</strong>
        </article>
        <article>
          <span>{{ t('Weekly balance') }}</span>
          <strong>{{ formatMoney(report.summary.balance) }}</strong>
        </article>
        <article>
          <span>{{ t('Largest expense') }}</span>
          <strong>{{ report.largestExpense ? formatMoney(report.largestExpense.amount) : '—' }}</strong>
          <small v-if="report.largestExpense">{{ tc(report.largestExpense.category) }}</small>
        </article>
        <article class="weekly-summary__categories">
          <span>{{ t('Top categories') }}</span>
          <ol v-if="report.topCategories.length">
            <li v-for="category in report.topCategories" :key="category.category">
              <span>{{ tc(category.category) }}</span>
              <strong>{{ formatMoney(category.amount) }}</strong>
            </li>
          </ol>
          <small v-else>{{ t('No expenses this week') }}</small>
        </article>
        <article class="weekly-summary__trend">
          <span>{{ t('Daily spending') }}</span>
          <div class="weekly-bars" :aria-label="t('Daily spending')">
            <div v-for="day in completedDays" :key="day.date" :title="`${day.date}: ${formatMoney(day.expense)}`">
              <i :style="{ height: barHeight(day.expense) }"></i>
              <small>{{ formatWeekday(day.date) }}</small>
            </div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.weekly-summary{margin:20px 0;padding:21px 24px;border:1px solid #d8d7ce;border-radius:18px;color:#20352b;background:#fffdf8}.weekly-summary__heading{display:flex;align-items:start;justify-content:space-between;gap:16px}.weekly-summary__heading h2{margin:3px 0 0;font-family:Georgia,serif;font-size:1.45rem;font-weight:500}.weekly-summary__heading>span{color:#778179;font-size:.75rem}.weekly-summary__main{display:grid;grid-template-columns:minmax(260px,1.35fr) minmax(420px,1fr);align-items:center;gap:26px;margin-top:15px}.weekly-summary__main>p{margin:0;font-family:Georgia,serif;font-size:1.05rem;line-height:1.5}.weekly-summary__metrics{display:grid;grid-template-columns:repeat(3,1fr);margin:0}.weekly-summary__metrics>div{padding:4px 14px;border-left:1px solid #e3e1da}.weekly-summary__metrics dt{color:#79827c;font-size:.68rem}.weekly-summary__metrics dd{margin:5px 0 0;font-weight:850}.weekly-summary__metrics dd[data-tone=bad]{color:#c14f48}.weekly-summary__metrics dd[data-tone=good]{color:#2b7757}.weekly-summary__toggle{display:flex;align-items:center;gap:7px;margin-top:13px;padding:5px 0;border:0;color:#2d6049;background:transparent;cursor:pointer;font-weight:800}.weekly-summary__toggle span{display:grid;width:19px;height:19px;place-items:center;border-radius:50%;background:#e8f0eb}.weekly-summary__details{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px;padding-top:15px;border-top:1px solid #e2e0d8}.weekly-summary__details article{min-width:0;padding:14px;border-radius:12px;background:#f4f1ea}.weekly-summary__details article>span,.weekly-summary__details small{display:block;color:#778179;font-size:.7rem}.weekly-summary__details article>strong{display:block;margin-top:6px;font-family:Georgia,serif;font-size:1.2rem;font-weight:500}.weekly-summary__categories{grid-column:span 2}.weekly-summary__categories ol{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 0;padding:0;list-style:none}.weekly-summary__categories li{display:flex;justify-content:space-between;gap:6px;font-size:.78rem}.weekly-summary__categories li strong{white-space:nowrap}.weekly-summary__trend{grid-column:span 1}.weekly-bars{display:grid;height:58px;grid-template-columns:repeat(7,1fr);align-items:end;gap:4px;margin-top:7px}.weekly-bars>div{display:grid;height:100%;grid-template-rows:1fr auto;align-items:end;justify-items:center}.weekly-bars i{display:block;width:9px;border-radius:4px 4px 1px 1px;background:#d46b62}.weekly-bars small{margin-top:3px;font-size:.58rem}.weekly-summary__state{padding:22px 0 5px;color:#778179}.weekly-summary__state--error{color:#b84842}@media(max-width:980px){.weekly-summary__main{grid-template-columns:1fr}.weekly-summary__metrics>div:first-child{padding-left:0;border-left:0}}@media(max-width:600px){.weekly-summary{padding:18px}.weekly-summary__heading>span{display:none}.weekly-summary__main{gap:16px}.weekly-summary__metrics>div{padding:3px 9px}.weekly-summary__metrics dd{font-size:.82rem}.weekly-summary__details{grid-template-columns:1fr 1fr}.weekly-summary__categories,.weekly-summary__trend{grid-column:1/-1}.weekly-summary__categories ol{grid-template-columns:1fr}.weekly-summary__main>p{font-size:1rem}}
</style>
