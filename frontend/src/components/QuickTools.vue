<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'

import QuickTemplates from '@/components/QuickTemplates.vue'
import SplitCalculator from '@/components/SplitCalculator.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const props = defineProps({
  templates: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  lastTransaction: { type: Object, default: null },
})

const emit = defineEmits([
  'use-template',
  'create-template',
  'update-template',
  'delete-template',
  'retry-templates',
  'use-amount',
])

const activeTool = ref('')
const calculatorState = reactive({ total: '', people: 2 })
const closeButton = ref(null)
const templateButton = ref(null)
const calculatorButton = ref(null)
const activeTitle = computed(() => (
  activeTool.value === 'templates' ? t('Quick Templates') : t('Split the bill, simply')
))

function openTool(tool) {
  activeTool.value = tool
  nextTick(() => closeButton.value?.focus())
}

function closeTool() {
  const opener = activeTool.value === 'templates' ? templateButton.value : calculatorButton.value
  activeTool.value = ''
  nextTick(() => opener?.focus())
}

function useTemplate(template) {
  emit('use-template', template)
  closeTool()
}

function useAmount(payload) {
  emit('use-amount', payload)
  closeTool()
}

function saveCalculatorState(state) {
  calculatorState.total = state.total
  calculatorState.people = state.people
}

function isTypingTarget(target) {
  return target instanceof Element && (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
  )
}

function handleShortcut(event) {
  if (!event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (key === 't') {
    event.preventDefault()
    openTool('templates')
  } else if (key === 'c') {
    event.preventDefault()
    openTool('calculator')
  }
}

onMounted(() => document.addEventListener('keydown', handleShortcut))
onUnmounted(() => document.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <div class="quick-tools" role="group" :aria-label="t('Quick tools')">
    <button
      ref="templateButton"
      type="button"
      class="quick-tool-trigger"
      data-test="open-templates"
      @click="openTool('templates')"
    >
      <span aria-hidden="true">◇</span>
      {{ t('Quick Templates') }}
      <small v-if="templates.length">{{ templates.length }}</small>
      <kbd>⌥ T</kbd>
    </button>
    <button
      ref="calculatorButton"
      type="button"
      class="quick-tool-trigger"
      data-test="open-calculator"
      @click="openTool('calculator')"
    >
      <span aria-hidden="true">＋</span>
      {{ t('AA CALCULATOR') }}
      <kbd>⌥ C</kbd>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-show="activeTool"
      class="quick-tool-backdrop"
      data-test="quick-tool-backdrop"
      @click.self="closeTool"
      @keydown.esc="closeTool"
    >
      <section
        class="quick-tool-dialog"
        :class="`quick-tool-dialog--${activeTool || 'closed'}`"
        role="dialog"
        aria-modal="true"
        :aria-label="activeTitle"
      >
        <button
          ref="closeButton"
          type="button"
          class="quick-tool-close"
          :aria-label="t('Close quick tool')"
          @click="closeTool"
        >
          ×
        </button>

        <div v-show="activeTool === 'templates'" class="quick-tool-content">
          <QuickTemplates
            :templates="props.templates"
            :categories="props.categories"
            :loading="props.loading"
            :error="props.error"
            :saving="props.saving"
            :last-transaction="props.lastTransaction"
            @use="useTemplate"
            @create="emit('create-template', $event)"
            @update="emit('update-template', $event)"
            @delete="emit('delete-template', $event)"
            @retry="emit('retry-templates')"
          />
        </div>
        <div v-show="activeTool === 'calculator'" class="quick-tool-content">
          <SplitCalculator
            :initial-total="calculatorState.total"
            :initial-people="calculatorState.people"
            @state-change="saveCalculatorState"
            @use-amount="useAmount"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.quick-tools{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.quick-tool-trigger{display:flex;min-height:38px;align-items:center;gap:7px;padding:7px 10px;border:1px solid #ccd4cf;border-radius:10px;color:#294638;background:#f8faf8;font:inherit;font-size:.75rem;font-weight:800;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}.quick-tool-trigger:hover{border-color:#5f826f;background:#eef4f0;transform:translateY(-1px)}.quick-tool-trigger>span{font-size:1rem}.quick-tool-trigger small{display:grid;min-width:18px;height:18px;place-items:center;border-radius:999px;color:#fff;background:#5f826f;font-size:.62rem}.quick-tool-trigger kbd{padding:2px 5px;border:1px solid #d8ddd9;border-radius:5px;color:#7a857e;background:#fff;font:inherit;font-size:.58rem;font-weight:600}.quick-tool-backdrop{position:fixed;z-index:1200;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(24,37,31,.5);backdrop-filter:blur(3px)}.quick-tool-dialog{position:relative;width:min(720px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;border:1px solid #d8d7ce;border-radius:22px;background:#fffdf8;box-shadow:0 24px 70px rgba(24,37,31,.28)}.quick-tool-dialog--calculator{width:min(450px,100%)}.quick-tool-close{position:absolute;z-index:2;top:14px;right:14px;display:grid;width:34px;height:34px;place-items:center;border:1px solid #d8d7ce;border-radius:50%;color:#526158;background:#fff;font-size:1.3rem;line-height:1;cursor:pointer}.quick-tool-dialog :deep(.quick-templates),.quick-tool-dialog :deep(.split-calculator){position:static;margin:0;padding:26px;border:0;border-radius:0;background:transparent;box-shadow:none}.quick-tool-dialog :deep(.quick-templates__heading),.quick-tool-dialog :deep(.calculator-heading){padding-right:40px}@media(max-width:700px){.quick-tools{justify-content:flex-start;width:100%;margin-top:10px}.quick-tool-trigger{flex:1;justify-content:center}.quick-tool-trigger kbd{display:none}.quick-tool-backdrop{align-items:flex-end;padding:0}.quick-tool-dialog,.quick-tool-dialog--calculator{width:100%;max-height:88vh;border-radius:22px 22px 0 0}.quick-tool-dialog :deep(.quick-templates),.quick-tool-dialog :deep(.split-calculator){padding:24px 18px calc(24px + env(safe-area-inset-bottom))}}
</style>
