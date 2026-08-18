const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const { getCurrentMonth, getMonthRange } = require('./reportingPeriod')

describe('reportingPeriod', () => {
  it('根据本地日期生成当前月份', () => {
    assert.equal(getCurrentMonth(new Date(2026, 7, 13)), '2026-08')
  })

  it('生成普通月份和闰年二月的完整日期范围', () => {
    assert.deepEqual(getMonthRange('2026-08'), {
      month: '2026-08',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    })
    assert.equal(getMonthRange('2028-02').endDate, '2028-02-29')
  })

  it('拒绝格式错误或不存在的月份', () => {
    assert.throws(() => getMonthRange('2026-8'), /YYYY-MM/)
    assert.throws(() => getMonthRange('2026-13'), /valid month/)
  })
})
