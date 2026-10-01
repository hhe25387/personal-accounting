import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PersonalityWelcome from '@/components/PersonalityWelcome.vue'

describe('PersonalityWelcome', () => {
  it.each([
    ['bestie', 'Supportive Companion'],
    ['savage', 'Straight-talking Guide'],
    ['parent', 'Caring Mentor'],
    ['royal', 'Royal Steward'],
  ])('为 %s 显示对应的欢迎语', (persona, label) => {
    const wrapper = mount(PersonalityWelcome, {
      props: { profile: { persona, preferredTitle: 'Princess' }, userName: '小禾' },
    })

    expect(wrapper.text()).toContain(label)
    if (persona === 'royal') expect(wrapper.text()).toContain('Princess')
  })

  it('点击按钮后进入账本', async () => {
    const wrapper = mount(PersonalityWelcome, {
      props: { profile: { persona: 'bestie' } },
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('enter')).toHaveLength(1)
  })
})
