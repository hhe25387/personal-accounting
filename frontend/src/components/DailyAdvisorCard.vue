<script setup>
import { ref } from 'vue'

defineProps({
  message: { type: Object, default: null },
  loading: Boolean,
})

const emit = defineEmits(['close', 'feedback'])
const expanded = ref(false)
const feedbackSent = ref(false)

function sendFeedback(value) {
  if (feedbackSent.value) return
  feedbackSent.value = true
  emit('feedback', value)
}
</script>

<template>
  <div class="advisor-overlay">
    <section
      class="advisor-card"
      role="status"
      aria-labelledby="advisor-title"
      aria-describedby="advisor-message"
    >
      <div class="advisor-mark" aria-hidden="true">✦</div>
      <div class="advisor-content">
      <span>Today’s companion · {{ message?.personaName || 'Preparing your ledger' }}</span>
      <h2 id="advisor-title">A note for today</h2>
      <p v-if="loading" id="advisor-message">Looking for something worth sharing today…</p>
      <p v-else id="advisor-message">{{ message?.message }}</p>

      <div v-if="expanded && message" class="advisor-details">
        <p><strong>Why this appeared</strong>{{ message.evidence }}</p>
        <p><strong>What you can do</strong>{{ message.suggestion }}</p>
        <div class="advisor-feedback">
          <span>{{ feedbackSent ? 'Thanks—I will remember that.' : 'Was this helpful?' }}</span>
          <template v-if="!feedbackSent">
            <button type="button" aria-label="Helpful" @click="sendFeedback('like')">👍</button>
            <button type="button" aria-label="Not helpful" @click="sendFeedback('dislike')">👎</button>
          </template>
        </div>
      </div>

      <button
        v-if="message"
        class="detail-toggle"
        type="button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Show less' : 'Show details' }}
      </button>
      </div>
      <button class="advisor-close" type="button" aria-label="Hide for today" @click="emit('close')">×</button>
    </section>
  </div>
</template>

<style scoped>
.advisor-overlay{position:fixed;right:24px;bottom:96px;z-index:31;width:min(420px,calc(100vw - 32px));animation:pop-in .24s ease-out}.advisor-card{position:relative;display:grid;grid-template-columns:auto 1fr;gap:14px;padding:20px 42px 18px 20px;border:1px solid rgba(255,255,255,.65);border-radius:20px;color:#20352b;background:#fffdf8;box-shadow:0 22px 60px rgba(25,40,32,.28)}.advisor-card::after{position:absolute;right:34px;bottom:-9px;width:18px;height:18px;border-right:1px solid rgba(255,255,255,.65);border-bottom:1px solid rgba(255,255,255,.65);background:#fffdf8;content:"";transform:rotate(45deg)}.advisor-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:50%;color:#fff;background:#2d6049}.advisor-content>span{color:#728078;font-size:.7rem;font-weight:800;letter-spacing:.08em}.advisor-content>h2{margin:6px 0 3px;font-family:Georgia,serif;font-size:1.28rem;font-weight:500}.advisor-content>p{margin:0;line-height:1.55}.advisor-details{display:grid;gap:8px;margin-top:13px;padding-top:12px;border-top:1px solid #e4e1d9}.advisor-details p{margin:0;color:#59665f;font-size:.84rem}.advisor-details strong{display:block;margin-bottom:2px;color:#20352b}.detail-toggle{margin-top:10px;padding:0;border:0;color:#2d6049;background:transparent;font-weight:750;cursor:pointer}.advisor-close{position:absolute;top:10px;right:12px;border:0;color:#7b837d;background:transparent;font-size:1.3rem;cursor:pointer}.advisor-feedback{display:flex;align-items:center;gap:7px;margin-top:3px;color:#768079;font-size:.78rem}.advisor-feedback button{padding:4px;border:0;background:transparent;cursor:pointer}@keyframes pop-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}@media(max-width:650px){.advisor-overlay{right:16px;bottom:82px;left:16px;width:auto}.advisor-card{grid-template-columns:auto 1fr;padding:18px 38px 17px 18px}.advisor-mark{width:34px;height:34px}.advisor-content>h2{font-size:1.18rem}}
</style>
