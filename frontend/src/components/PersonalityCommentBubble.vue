<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({ comment: { type: Object, required: true } })
const emit = defineEmits(['close', 'feedback'])
const expanded = ref(false)
const interacted = ref(false)
const feedbackSent = ref(false)
let timer
let remaining = 10000
let startedAt = 0

function startTimer() {
  if (interacted.value) return
  startedAt = Date.now()
  timer = window.setTimeout(() => emit('close'), remaining)
}

function pauseTimer() {
  if (!timer) return
  window.clearTimeout(timer)
  timer = null
  remaining -= Date.now() - startedAt
}

function expand() {
  expanded.value = !expanded.value
  if (expanded.value) {
    interacted.value = true
    pauseTimer()
  }
}

function sendFeedback(value) {
  interacted.value = true
  pauseTimer()
  feedbackSent.value = true
  emit('feedback', value)
}

onMounted(startTimer)
onBeforeUnmount(pauseTimer)
</script>

<template>
  <aside class="comment-bubble" role="status" @mouseenter="pauseTimer" @mouseleave="startTimer">
    <button class="bubble-close" type="button" aria-label="Close companion note" @click="emit('close')">×</button>
    <span>{{ comment.personaName }} · Just now</span>
    <p>{{ comment.message }}</p>
    <div v-if="expanded" class="bubble-details">
      <p><strong>Why it appeared</strong>{{ comment.evidence }}</p>
      <p><strong>Suggestion</strong>{{ comment.suggestion }}</p>
      <div>
        <span>{{ feedbackSent ? 'Thanks for your feedback.' : 'Was this note useful?' }}</span>
        <template v-if="!feedbackSent">
          <button type="button" aria-label="Useful note" @click="sendFeedback('like')">👍</button>
          <button type="button" aria-label="Not useful" @click="sendFeedback('dislike')">👎</button>
        </template>
      </div>
    </div>
    <button class="bubble-toggle" type="button" @click="expand">{{ expanded ? 'Show less' : 'Why did this appear?' }}</button>
  </aside>
</template>

<style scoped>
.comment-bubble{position:fixed;right:24px;bottom:96px;z-index:30;width:min(380px,calc(100vw - 32px));padding:19px 44px 18px 20px;border:1px solid rgba(255,255,255,.16);border-radius:18px;color:#f9f5eb;background:#274536;box-shadow:0 20px 55px rgba(31,47,39,.3);animation:arrive .24s ease-out}.comment-bubble>span{color:#cbd8d0;font-size:.7rem;font-weight:800;letter-spacing:.08em}.comment-bubble>p{margin:7px 0 0;line-height:1.55}.bubble-close{position:absolute;top:10px;right:12px;border:0;color:#d2dcd6;background:transparent;font-size:1.3rem;cursor:pointer}.bubble-toggle{margin-top:10px;padding:0;border:0;color:#dbe9e0;background:transparent;font-weight:750;cursor:pointer}.bubble-details{display:grid;gap:8px;margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.16)}.bubble-details p{margin:0;color:#d4dfd8;font-size:.84rem}.bubble-details strong{display:block;color:#fff}.bubble-details div{display:flex;align-items:center;gap:7px;color:#cbd8d0;font-size:.78rem}.bubble-details div button{border:0;background:transparent;cursor:pointer}@keyframes arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@media(max-width:650px){.comment-bubble{right:16px;bottom:82px;left:16px;width:auto}}
</style>
