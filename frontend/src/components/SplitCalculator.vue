<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '@/i18n'

const { language, locale, t } = useI18n()

const emit = defineEmits(['use-amount'])

const totalAmount = ref('')
const peopleCount = ref(2)

const normalizedTotal = computed(() => Number(totalAmount.value) || 0)
const perPersonAmount = computed(() => {
  if (normalizedTotal.value <= 0 || peopleCount.value < 2) return 0
  return Math.round((normalizedTotal.value * 100) / peopleCount.value) / 100
})
const roundingDifference = computed(() =>
  Math.round(
    (normalizedTotal.value - perPersonAmount.value * peopleCount.value) * 100,
  ) / 100,
)

function changePeople(delta) {
  peopleCount.value = Math.min(99, Math.max(2, peopleCount.value + delta))
}

function normalizePeople() {
  const nextValue = Math.round(Number(peopleCount.value))
  peopleCount.value = Number.isFinite(nextValue)
    ? Math.min(99, Math.max(2, nextValue))
    : 2
}

function useAmount(amount, source) {
  if (amount <= 0) return
  emit('use-amount', { amount, source })
}

function resetCalculator() {
  totalAmount.value = ''
  peopleCount.value = 2
}

function formatMoney(amount) {
  return Number(amount).toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
</script>

<template>
  <aside class="split-calculator" aria-labelledby="split-calculator-title">
    <div class="calculator-heading">
      <div>
        <p class="eyebrow">{{ t('AA CALCULATOR') }}</p>
        <h2 id="split-calculator-title">{{ t('Split the bill, simply') }}</h2>
      </div>
      <button type="button" class="calculator-reset" @click="resetCalculator">{{ t('Reset') }}</button>
    </div>

    <label for="split-total">{{ t('Total bill') }}</label>
    <div class="calculator-amount-field">
      <span>¥</span>
      <input
        id="split-total"
        v-model="totalAmount"
        type="number"
        min="0"
        step="0.01"
        inputmode="decimal"
        placeholder="0.00"
      />
    </div>

    <label for="split-people">{{ t('Number of people') }} <small>{{ t('including you') }}</small></label>
    <div class="people-stepper">
      <button type="button" :aria-label="t('Remove one person')" :disabled="peopleCount <= 2" @click="changePeople(-1)">−</button>
      <input
        id="split-people"
        v-model.number="peopleCount"
        type="number"
        min="2"
        max="99"
        inputmode="numeric"
        @blur="normalizePeople"
      />
      <button type="button" :aria-label="t('Add one person')" :disabled="peopleCount >= 99" @click="changePeople(1)">＋</button>
    </div>

    <div class="split-result" aria-live="polite">
      <small>{{ t('Approx. per person') }}</small>
      <strong>¥{{ formatMoney(perPersonAmount) }}</strong>
      <p v-if="roundingDifference">{{ language === 'zh' ? `四舍五入后相差 ¥${formatMoney(Math.abs(roundingDifference))}，可由付款人补足。` : `Rounding leaves a difference of ¥${formatMoney(Math.abs(roundingDifference))}, which the payer can cover.` }}</p>
      <p v-else>{{ language === 'zh' ? `总额将由 ${peopleCount} 人平均分摊。` : `The total will be split evenly among ${peopleCount} people.` }}</p>
    </div>

    <div class="calculator-actions">
      <button
        type="button"
        class="calculator-primary"
        :disabled="!perPersonAmount"
        @click="useAmount(perPersonAmount, 'share')"
      >
        {{ t('Use my share') }}
      </button>
      <button
        type="button"
        :disabled="!normalizedTotal"
        @click="useAmount(normalizedTotal, 'total')"
      >
        {{ t('I paid—use full bill') }}
      </button>
    </div>
    <p class="calculator-note">{{ t('This only calculates the split. You still confirm the category and save.') }}</p>
  </aside>
</template>

<style scoped>
.split-calculator{position:sticky;top:24px;padding:22px;border:1px solid #d8d7ce;border-radius:20px;color:#20352b;background:#fffdf8}.calculator-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.calculator-heading h2{margin:4px 0 0;font-family:Georgia,serif;font-size:1.35rem;font-weight:500}.calculator-reset{padding:4px;border:0;color:#647168;background:transparent;font-size:.75rem;cursor:pointer}.split-calculator>label{display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px;font-size:.8rem;font-weight:800}.split-calculator>label small{color:#8a918b;font-weight:500}.calculator-amount-field{display:flex;height:48px;align-items:center;border:1px solid #d7d7cf;border-radius:11px;background:#fff}.calculator-amount-field:focus-within{border-color:#2d6049;box-shadow:0 0 0 3px rgba(45,96,73,.1)}.calculator-amount-field span{padding-left:13px;color:#59665e;font-family:Georgia,serif;font-size:1.25rem}.calculator-amount-field input{min-width:0;flex:1;height:100%;padding:0 12px;border:0;outline:0;background:transparent;font-family:Georgia,serif;font-size:1.5rem}.people-stepper{display:grid;grid-template-columns:42px 1fr 42px;height:44px;border:1px solid #d7d7cf;border-radius:11px;overflow:hidden;background:#fff}.people-stepper button{border:0;color:#2d6049;background:#eef3ef;font-size:1.15rem;cursor:pointer}.people-stepper button:disabled{cursor:not-allowed;opacity:.45}.people-stepper input{width:100%;border:0;outline:0;text-align:center;background:#fff;font-weight:800}.split-result{margin-top:18px;padding:18px;border-radius:15px;color:#eaf0ec;background:#294638}.split-result small{color:#bfcac3}.split-result strong{display:block;margin:5px 0;font-family:Georgia,serif;font-size:2rem;font-weight:500}.split-result p{margin:0;color:#c9d3cd;font-size:.72rem;line-height:1.5}.calculator-actions{display:grid;gap:8px;margin-top:14px}.calculator-actions button{padding:10px 12px;border:1px solid #bfc8c2;border-radius:9px;color:#2d6049;background:#fff;font-size:.78rem;font-weight:800;cursor:pointer}.calculator-actions .calculator-primary{border-color:#2d6049;color:#fff;background:#2d6049}.calculator-actions button:disabled{cursor:not-allowed;opacity:.45}.calculator-note{margin:12px 0 0;color:#888f89;font-size:.68rem;line-height:1.5}@media(max-width:980px){.split-calculator{position:static}}
</style>
