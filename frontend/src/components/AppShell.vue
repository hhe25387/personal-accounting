<script setup>
import { useI18n } from '@/i18n'

const { t } = useI18n()

defineProps({
  user: { type: Object, required: true },
  mode: { type: String, default: 'standard' },
  allowModeChange: { type: Boolean, default: false },
})
const emit = defineEmits(['logout', 'change-mode'])
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="shell-brand"><span>L</span><div><strong>{{ t('Clear Ledger') }}</strong><small>{{ t('Personal income and expense tracker') }}</small></div></div>
      <nav :aria-label="t('Main navigation')">
        <RouterLink to="/">{{ t('Quick Entry') }}</RouterLink>
        <RouterLink to="/overview">{{ t('Monthly Overview') }}</RouterLink>
        <RouterLink to="/records">{{ t('Transactions') }}</RouterLink>
        <RouterLink to="/budget">{{ t('Budget') }}</RouterLink>
        <RouterLink to="/profile">{{ t('My Profile') }}</RouterLink>
        <button v-if="allowModeChange" type="button" @click="emit('change-mode')">{{ t('Change mode') }}</button>
      </nav>
      <div v-if="allowModeChange" class="persona-note"><small>{{ t(mode === 'standard' ? 'Standard mode: quiet, simple transaction tracking.' : 'Personality mode is on; the entry flow stays the same.') }}</small></div>
      <div class="shell-user">
        <span>{{ user.name.slice(0, 1) }}</span>
        <RouterLink to="/profile"><strong>{{ user.name }}</strong><small>{{ user.account || t('Ledger account') }}</small></RouterLink>
        <button type="button" :title="t('Sign out')" @click="emit('logout')">{{ t('Sign out') }}</button>
      </div>
    </aside>
    <header class="mobile-header"><div class="shell-brand"><span>L</span><strong>{{ t('Clear Ledger') }}</strong></div><button v-if="allowModeChange" type="button" @click="emit('change-mode')">{{ t('Switch') }}</button></header>
    <div class="shell-content"><slot /></div>
    <nav class="mobile-nav" :aria-label="t('Main navigation')"><RouterLink to="/">{{ t('Entry') }}</RouterLink><RouterLink to="/overview">{{ t('Overview') }}</RouterLink><RouterLink to="/records">{{ t('Transactions') }}</RouterLink><RouterLink to="/budget">{{ t('Budget') }}</RouterLink><RouterLink to="/profile">{{ t('Profile') }}</RouterLink></nav>
  </div>
</template>

<style scoped>
@media(max-width:800px){.mobile-nav{grid-template-columns:repeat(5,1fr)}}
.app-shell{min-height:100vh;padding-left:244px;background:#f2efe8}.app-sidebar{position:fixed;inset:0 auto 0 0;z-index:20;display:flex;width:244px;flex-direction:column;padding:28px 20px;color:#eaf0ec;background:#233c31}.shell-brand{display:flex;align-items:center;gap:11px}.shell-brand>span{display:grid;width:40px;height:40px;place-items:center;border-radius:12px;color:#233c31;background:#efbd54;font-weight:900}.shell-brand strong,.shell-brand small{display:block}.shell-brand small{margin-top:2px;color:#aebdb4;font-size:.72rem}.app-sidebar nav{display:grid;gap:7px;margin-top:54px}.app-sidebar nav a,.app-sidebar nav button{padding:11px 13px;border:0;border-radius:10px;color:#c9d5ce;text-align:left;text-decoration:none;background:transparent;cursor:pointer}.app-sidebar nav a:hover,.app-sidebar nav button:hover,.app-sidebar nav .active{color:#fff;background:rgba(255,255,255,.1)}.persona-note{margin-top:auto;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#b9c8bf}.shell-user{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:9px;margin-top:14px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12)}.shell-user>span{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;color:#233c31;background:#f4e3ba;font-weight:850}.shell-user small{overflow:hidden;max-width:115px;color:#aebdb4;text-overflow:ellipsis;white-space:nowrap}.shell-user button{border:0;color:#b9c8bf;background:transparent;cursor:pointer}.shell-content{min-height:100vh}.mobile-header,.mobile-nav{display:none}@media(max-width:800px){.app-shell{padding:64px 0 72px}.app-sidebar{display:none}.mobile-header{position:fixed;inset:0 0 auto;z-index:30;display:flex;height:64px;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #deddd5;background:rgba(255,253,248,.95);backdrop-filter:blur(12px)}.mobile-header .shell-brand>span{width:34px;height:34px}.mobile-header button{border:0;color:#2d6049;background:transparent;font-weight:700}.mobile-nav{position:fixed;inset:auto 0 0;z-index:30;display:grid;grid-template-columns:repeat(4,1fr);height:64px;border-top:1px solid #deddd5;background:rgba(255,253,248,.97)}.mobile-nav a,.mobile-nav button{display:grid;place-items:center;border:0;color:#677169;text-decoration:none;background:transparent;font-size:.78rem}}
.app-sidebar nav .router-link-active{color:#fff;background:rgba(255,255,255,.1)}.mobile-nav .router-link-active{color:#2d6049;font-weight:800}
.shell-user{margin-top:auto}.persona-note+.shell-user{margin-top:14px}
.shell-user>a{min-width:0;color:inherit;text-decoration:none}.shell-user>a strong,.shell-user>a small{display:block}.shell-user button{padding:5px;font-size:.72rem}.shell-user button:hover{color:#fff}
@media(max-width:800px){.mobile-nav{grid-template-columns:repeat(5,1fr)}}
</style>
