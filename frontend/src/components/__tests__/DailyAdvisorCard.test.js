import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyAdvisorCard from '@/components/DailyAdvisorCard.vue'

const message = {
  personaName: 'Supportive Companion',
  message: '今天先记清楚就好。',
  evidence: '本月共 3 笔。',
  suggestion: '继续完整记录。',
}

describe('DailyAdvisorCard', () => {
  it('默认只显示一句话，点击后展开依据和建议', async () => {
    const wrapper = mount(DailyAdvisorCard, { props: { message } })
    expect(wrapper.text()).not.toContain('本月共 3 笔')

    await wrapper.get('.detail-toggle').trigger('click')
    expect(wrapper.text()).toContain('本月共 3 笔')
    expect(wrapper.text()).toContain('继续完整记录')
  })

  it('支持关闭和简单反馈', async () => {
    const wrapper = mount(DailyAdvisorCard, { props: { message } })
    await wrapper.get('.advisor-close').trigger('click')
    await wrapper.get('.detail-toggle').trigger('click')
    await wrapper.get('[aria-label="Helpful"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('feedback')[0]).toEqual(['like'])
  })
})
