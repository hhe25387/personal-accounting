import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SummaryCards from '../SummaryCards.vue'

describe('SummaryCards', () => {
  it('正确计算收入、支出和结余', () => {
    const wrapper = mount(SummaryCards, {
      props: {
        transactions: [
          {
            id: 1,
            type: 'income',
            amount: 100,
          },
          {
            id: 2,
            type: 'expense',
            amount: 25.5,
          },
        ],
      },
    })

    expect(wrapper.get('[data-test="income-total"]').text()).toContain('$100.00')
    expect(wrapper.get('[data-test="expense-total"]').text()).toContain('$25.50')
    expect(wrapper.get('[data-test="balance-total"]').text()).toContain('$74.50')
  })
})