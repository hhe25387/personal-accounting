<script setup>
import { computed } from 'vue'

const props = defineProps({
  profile: { type: Object, required: true },
  userName: { type: String, default: 'Ledger User' },
})

defineEmits(['enter'])

const welcome = computed(() => {
  const title = props.profile.preferredTitle || 'Your Highness'
  const copies = {
    bestie: {
      icon: '👯',
      label: 'Supportive Companion',
      greeting: `Hi, ${props.userName}, let’s make life a little clearer today.`,
      subline: 'No pressure to be perfect—just start with one honest entry.',
    },
    savage: {
      icon: '😈',
      label: 'Straight-talking Guide',
      greeting: 'Welcome back. The bills are not going anywhere, so let’s face them together.',
      subline: 'Essential spending is safe. Spending excuses may not be.',
    },
    parent: {
      icon: '🏡',
      label: 'Caring Mentor',
      greeting: `Welcome back, ${props.userName}. Let’s take care of both present and future you.`,
      subline: 'Spend confidently on what matters; we can plan the rest step by step.',
    },
    royal: {
      icon: '👑',
      label: 'Royal Steward',
      greeting: `${title}, welcome back. Your ledger and treasury are ready.`,
      subline: 'Please settle in and leave the organizing to your private steward.',
    },
  }
  return copies[props.profile.persona] || copies.bestie
})
</script>

<template>
  <main class="welcome-screen" :data-persona="profile.persona">
    <div class="welcome-orbit welcome-orbit--one"></div>
    <div class="welcome-orbit welcome-orbit--two"></div>
    <section class="welcome-card">
      <p class="welcome-label">{{ welcome.label }} · WELCOME BACK</p>
      <span class="welcome-icon" aria-hidden="true">{{ welcome.icon }}</span>
      <h1>{{ welcome.greeting }}</h1>
      <p class="welcome-subline">{{ welcome.subline }}</p>
      <button type="button" @click="$emit('enter')">Enter my ledger <span>→</span></button>
      <small>Tracking stays simple; your companion appears only when something matters.</small>
    </section>
  </main>
</template>

<style scoped>
.welcome-screen{--welcome-accent:#2d6049;position:relative;display:grid;min-height:100vh;overflow:hidden;place-items:center;padding:28px;color:#20352b;background:#f2efe7}.welcome-screen[data-persona="savage"]{--welcome-accent:#7c3d36}.welcome-screen[data-persona="parent"]{--welcome-accent:#47664d}.welcome-screen[data-persona="royal"]{--welcome-accent:#80632a}.welcome-card{position:relative;z-index:1;width:min(880px,100%);padding:clamp(38px,7vw,78px);border:1px solid rgba(32,53,43,.14);border-radius:30px;text-align:center;background:rgba(255,253,248,.9);box-shadow:0 28px 90px rgba(32,53,43,.12);backdrop-filter:blur(10px);animation:welcome-in .55s ease-out}.welcome-label{margin:0;color:var(--welcome-accent);font-size:.72rem;font-weight:850;letter-spacing:.15em}.welcome-icon{display:block;margin:26px 0 18px;font-size:3.7rem}.welcome-card h1{max-width:760px;margin:0 auto;font-family:Georgia,serif;font-size:clamp(2.6rem,6vw,5.3rem);font-weight:500;line-height:1.08}.welcome-subline{margin:24px auto 0;color:#647069;font-size:clamp(1rem,2vw,1.18rem);line-height:1.7}.welcome-card button{margin-top:34px;padding:14px 22px;border:0;border-radius:12px;color:#fff;background:var(--welcome-accent);font-size:.95rem;font-weight:800;cursor:pointer;transition:.2s}.welcome-card button:hover{transform:translateY(-2px);box-shadow:0 12px 28px color-mix(in srgb,var(--welcome-accent) 25%,transparent)}.welcome-card button span{margin-left:12px}.welcome-card small{display:block;margin-top:17px;color:#89918c}.welcome-orbit{position:absolute;border:1px solid color-mix(in srgb,var(--welcome-accent) 20%,transparent);border-radius:50%}.welcome-orbit--one{width:58vw;height:58vw;top:-33vw;right:-15vw}.welcome-orbit--two{width:48vw;height:48vw;bottom:-30vw;left:-10vw}@keyframes welcome-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@media(max-width:650px){.welcome-screen{padding:16px}.welcome-card{padding:40px 22px;border-radius:24px}.welcome-icon{margin:22px 0 16px;font-size:3rem}.welcome-card h1{font-size:2.45rem}.welcome-card button{width:100%}}
</style>
