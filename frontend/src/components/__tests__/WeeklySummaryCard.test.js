import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import WeeklySummaryCard from '../WeeklySummaryCard.vue'
import { setLanguage } from '@/i18n'

const report = {
  period: {
    startDate: '2026-08-17',
    endDate: '2026-08-23',
    throughDate: '2026-08-19',
  },
  dataLevel: 'complete',
  summary: {
    totalIncome: 500,
    totalExpense: 90,
    balance: 410,
    transactionCount: 3,
  },
  comparison: {
    hasPreviousData: true,
    hasPreviousExpenseData: true,
    expense: {
      previous: 150,
      current: 90,
      difference: -60,
      direction: 'down',
      percentageChange: -40,
    },
  },
  topCategories: [
    { category: 'Dining', amount: 60, percentage: 66.67 },
    { category: 'Transport', amount: 30, percentage: 33.33 },
  ],
  largestExpense: {
    amount: 60,
    category: 'Dining',
    transactionDate: '2026-08-17',
  },
  days: [
    { date: '2026-08-17', expense: 60 },
    { date: '2026-08-19', expense: 30 },
  ],
}

describe('WeeklySummaryCard', () => {
  beforeEach(() => setLanguage('en'))

  it('默认只展示一句总结和三个核心指标', () => {
    const wrapper = mount(WeeklySummaryCard, { props: { report } })

    expect(wrapper.text()).toContain('You spent ¥90.00 so far this week')
    expect(wrapper.text()).toContain('↓ 40%')
    expect(wrapper.text()).toContain('3 entries')
    expect(wrapper.find('.weekly-summary__details').exists()).toBe(false)
  })

  it('用户展开后显示收支、分类、最大消费和每日趋势', async () => {
    const wrapper = mount(WeeklySummaryCard, { props: { report } })

    await wrapper.get('.weekly-summary__toggle').trigger('click')

    expect(wrapper.text()).toContain('Weekly income')
    expect(wrapper.text()).toContain('¥500.00')
    expect(wrapper.text()).toContain('Dining')
    expect(wrapper.text()).toContain('Transport')
    expect(wrapper.findAll('.weekly-bars > div')).toHaveLength(3)
    expect(wrapper.get('.weekly-summary__toggle').attributes('aria-expanded')).toBe('true')
  })

  it('无账目时不显示展开按钮或虚构评价', () => {
    const wrapper = mount(WeeklySummaryCard, {
      props: {
        report: {
          ...report,
          dataLevel: 'empty',
          summary: { totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 },
          topCategories: [],
          largestExpense: null,
          days: [],
        },
      },
    })

    expect(wrapper.text()).toContain('No transactions this week yet')
    expect(wrapper.find('.weekly-summary__toggle').exists()).toBe(false)
  })
})
