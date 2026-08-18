<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from '@/i18n'

const { language, t, tc } = useI18n()

const props = defineProps({
  templates: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  lastTransaction: { type: Object, default: null },
})

const emit = defineEmits(['use', 'create', 'update', 'delete', 'retry'])
const managerOpen = ref(false)
const formOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const templateForm = reactive(emptyTemplate())

const visibleTemplates = computed(() => props.templates.slice(0, 4))
const availableCategories = computed(() =>
  props.categories.filter((category) => category.type === templateForm.type),
)

function emptyTemplate() {
  return {
    name: '',
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    isPinned: false,
  }
}

function resetForm(template = null) {
  const source = template || emptyTemplate()
  Object.assign(templateForm, {
    name: source.name || '',
    type: source.type || 'expense',
    amount: source.amount ?? '',
    category: source.category || '',
    description: source.description || '',
    isPinned: Boolean(source.isPinned),
  })
  if (!templateForm.category) {
    templateForm.category = availableCategories.value[0]?.name || ''
  }
  editingId.value = template?.id || null
  formError.value = ''
}

function openManager() {
  managerOpen.value = true
  formOpen.value = false
  resetForm()
}

function closeManager() {
  if (props.saving) return
  managerOpen.value = false
  formOpen.value = false
  resetForm()
}

function startCreate(source = null) {
  resetForm(source)
  editingId.value = null
  formOpen.value = true
}

function startEdit(template) {
  resetForm(template)
  formOpen.value = true
}

function submitTemplate() {
  formError.value = ''
  if (!templateForm.name.trim()) {
    formError.value = t('Give this template a recognizable name')
    return
  }
  if (!templateForm.category) {
    formError.value = t('Select a category')
    return
  }

  const payload = {
    name: templateForm.name.trim(),
    type: templateForm.type,
    amount: templateForm.amount,
    category: templateForm.category,
    description: templateForm.description.trim(),
    isPinned: templateForm.isPinned,
  }
  emit(editingId.value ? 'update' : 'create', {
    ...(editingId.value ? { id: editingId.value } : {}),
    payload,
  })
}

function requestDelete(template) {
  if (window.confirm(language.value === 'zh' ? `删除“${template.name}”模板？` : `Delete “${template.name}” template?`)) {
    emit('delete', template.id)
  }
}

function handleEscape(event) {
  if (event.key === 'Escape' && managerOpen.value) closeManager()
}

watch(
  () => templateForm.type,
  () => {
    if (!availableCategories.value.some((item) => item.name === templateForm.category)) {
      templateForm.category = availableCategories.value[0]?.name || ''
    }
  },
)

watch(
  () => props.saving,
  (saving, wasSaving) => {
    if (wasSaving && !saving && !props.error) {
      formOpen.value = false
      resetForm()
    }
  },
)

onMounted(() => document.addEventListener('keydown', handleEscape))
onUnmounted(() => document.removeEventListener('keydown', handleEscape))
</script>

<template>
  <section class="quick-templates" aria-labelledby="quick-template-title">
    <div class="quick-templates__heading">
      <div>
        <p class="eyebrow">{{ t('COMMON ENTRIES') }}</p>
        <h2 id="quick-template-title">{{ t('Quick Templates') }}</h2>
      </div>
      <button type="button" class="text-button" @click="openManager">
        {{ t('Manage templates') }}<span aria-hidden="true"> →</span>
      </button>
    </div>

    <div v-if="loading" class="quick-templates__state" role="status">{{ t('Loading templates…') }}</div>
    <div v-else-if="error" class="quick-templates__state quick-templates__state--error" role="alert">
      <span>{{ t(error) }}</span>
      <button type="button" class="text-button" @click="$emit('retry')">{{ t('Retry') }}</button>
    </div>
    <div v-else class="quick-template-list">
      <button
        v-for="template in visibleTemplates"
        :key="template.id"
        type="button"
        class="quick-template-chip"
        :data-type="template.type"
        @click="$emit('use', template)"
      >
        <span class="quick-template-chip__mark" aria-hidden="true">{{ template.type === 'income' ? '+' : '−' }}</span>
        <span>
          <strong>{{ template.name }}</strong>
          <small>{{ tc(template.category) }}<template v-if="template.amount !== null"> · ¥{{ Number(template.amount).toFixed(2) }}</template></small>
        </span>
        <span v-if="template.isPinned" class="quick-template-chip__pin" :title="t('Pinned')" :aria-label="t('Pinned')">◆</span>
      </button>

      <button type="button" class="quick-template-chip quick-template-chip--add" @click="openManager">
        <span aria-hidden="true">＋</span>
        <span><strong>{{ t(templates.length ? 'New template' : 'Add your first template') }}</strong><small>{{ t('Save time next time') }}</small></span>
      </button>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="managerOpen" class="template-modal-backdrop" @click.self="closeManager">
      <section class="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-manager-title">
        <header class="template-modal__header">
          <div>
            <p class="eyebrow">{{ t('TEMPLATES') }}</p>
            <h2 id="template-manager-title">{{ t('Manage Quick Templates') }}</h2>
            <p>{{ t('Templates prefill the form. You always confirm before saving.') }}</p>
          </div>
          <button type="button" class="icon-button" :aria-label="t('Close template manager')" @click="closeManager">×</button>
        </header>

        <div v-if="error" class="template-modal__error" role="alert">{{ t(error) }}</div>

        <form v-if="formOpen" class="template-editor" @submit.prevent="submitTemplate">
          <div class="template-editor__title">
            <h3>{{ t(editingId ? 'Edit template' : 'New template') }}</h3>
            <span>{{ templates.length }} / 12</span>
          </div>
          <div class="template-editor__grid">
            <label>
              {{ t('Template name') }}
              <input v-model="templateForm.name" type="text" maxlength="20" :placeholder="t('e.g. Work lunch')" :disabled="saving" />
            </label>
            <label>
              {{ t('Entry type') }}
              <select v-model="templateForm.type" :disabled="saving">
                <option value="expense">{{ t('Expense') }}</option>
                <option value="income">{{ t('Income') }}</option>
              </select>
            </label>
            <label>
              {{ t('Category') }}
              <select v-model="templateForm.category" :disabled="saving">
                <option v-for="category in availableCategories" :key="category.id" :value="category.name">{{ tc(category.name) }}</option>
              </select>
            </label>
            <label>
              {{ t('Usual amount (optional)') }}
              <input v-model="templateForm.amount" type="number" min="0.01" step="0.01" :placeholder="t('Leave blank if it varies')" :disabled="saving" />
            </label>
            <label class="template-editor__wide">
              {{ t('Note (optional)') }}
              <input v-model="templateForm.description" type="text" maxlength="100" :placeholder="t('e.g. Lunch near the office')" :disabled="saving" />
            </label>
          </div>
          <label class="template-pin-toggle">
            <input v-model="templateForm.isPinned" type="checkbox" :disabled="saving" />
            {{ t('Pin to the top') }}
          </label>
          <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
          <div class="template-editor__actions">
            <button type="submit" class="primary-button" :disabled="saving">{{ t(saving ? 'Saving…' : 'Save template') }}</button>
            <button type="button" class="secondary-button" :disabled="saving" @click="formOpen = false">{{ t('Cancel') }}</button>
          </div>
        </form>

        <template v-else>
          <button
            v-if="lastTransaction && templates.length < 12"
            type="button"
            class="save-last-template"
            @click="startCreate({
              ...lastTransaction,
              name: lastTransaction.description || lastTransaction.category,
              isPinned: false,
            })"
          >
            <span aria-hidden="true">↗</span>
            <span><strong>{{ language === 'zh' ? `将最近的“${tc(lastTransaction.category)}”账目保存为模板` : `Save the recent “${lastTransaction.category}” entry as a template` }}</strong><small>{{ language === 'zh' ? '下一步移除金额，可让模板更灵活' : 'Remove the amount on the next step to keep it flexible' }}</small></span>
          </button>

          <div class="template-manager-list">
            <article v-for="template in templates" :key="template.id" class="template-manager-row">
              <button type="button" class="template-manager-row__main" @click="$emit('use', template); closeManager()">
                <span class="quick-template-chip__mark" :data-type="template.type">{{ template.type === 'income' ? '+' : '−' }}</span>
                <span><strong>{{ template.name }}</strong><small>{{ tc(template.category) }} · {{ template.amount === null ? t('Enter amount each time') : `¥${Number(template.amount).toFixed(2)}` }}</small></span>
              </button>
              <span v-if="template.isPinned" class="template-manager-row__pinned">{{ t('Pinned') }}</span>
              <button type="button" class="text-button" @click="startEdit(template)">{{ t('Edit') }}</button>
              <button type="button" class="text-button text-button--danger" @click="requestDelete(template)">{{ t('Delete') }}</button>
            </article>
            <p v-if="!templates.length" class="template-empty">{{ t('No templates yet. Add a frequent entry to prefill its category and note with one click.') }}</p>
          </div>

          <button v-if="templates.length < 12" type="button" class="primary-button template-add-button" @click="startCreate()">{{ t('＋ New template') }}</button>
          <p v-else class="template-limit-note">{{ t('You have reached 12 templates. Delete an unused one to add another.') }}</p>
        </template>
      </section>
    </div>
  </Teleport>
</template>
