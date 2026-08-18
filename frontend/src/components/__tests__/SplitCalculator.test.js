import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SplitCalculator from '../SplitCalculator.vue'

describe('SplitCalculator', () => {
  it('根据总金额和人数计算每人份额', async () => {
    const wrapper = mount(SplitCalculator)

    await wrapper.get('#split-total').setValue('300')
    await wrapper.get('#split-people').setValue('3')

    expect(wrapper.get('.split-result strong').text()).toBe('¥100.00')
  })

  it('可以把个人份额或整单金额传给记账表单', async () => {
    const wrapper = mount(SplitCalculator)

    await wrapper.get('#split-total').setValue('99')
    await wrapper.get('#split-people').setValue('3')
    await wrapper.findAll('.calculator-actions button')[0].trigger('click')
    await wrapper.findAll('.calculator-actions button')[1].trigger('click')

    expect(wrapper.emitted('use-amount')).toEqual([
      [{ amount: 33, source: 'share' }],
      [{ amount: 99, source: 'total' }],
    ])
  })

  it('人数不会低于两人并可以重置', async () => {
    const wrapper = mount(SplitCalculator)

    await wrapper.get('#split-total').setValue('88')
    await wrapper.get('[aria-label="Remove one person"]').trigger('click')
    expect(wrapper.get('#split-people').element.value).toBe('2')

    await wrapper.get('.calculator-reset').trigger('click')
    expect(wrapper.get('#split-total').element.value).toBe('')
    expect(wrapper.get('#split-people').element.value).toBe('2')
  })
})
