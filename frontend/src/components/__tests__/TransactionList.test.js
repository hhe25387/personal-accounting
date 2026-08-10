import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionList from '../TransactionList.vue'

describe('TransactionList', () => {
  it('显示收入和支出记录', () => {
    const wrapper = mount(TransactionList, {
      props: {
        transactions: [
          {
            id: 1,
            type: 'income',
            amount: 12,
            category: '兼职',
            transactionDate: '2026-08-10',
            description: '',
          },
          {
            id: 2,
            type: 'expense',
            amount: 25.5,
            category: '餐饮',
            transactionDate: '2026-08-09',
            description: '早餐',
          },
        ],
      },
    })

    const rows = wrapper.findAll('[data-test="transaction-row"]')

    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('兼职')
    expect(wrapper.text()).toContain('早餐')

    expect(wrapper.get('.transaction-amount--income').text()).toBe('+$12.00')
    expect(wrapper.get('.transaction-amount--expense').text()).toBe('-$25.50')
  })
})