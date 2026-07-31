<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { User, Lock, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-vue-next';
import { useUserStore } from '@/stores/user';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMsg = ref('');

const canSubmit = computed(() => username.value.trim() && password.value && !loading.value);

async function handleLogin() {
  if (!canSubmit.value) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    await userStore.login(username.value.trim(), password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.replace(redirect || '/');
  } catch (err: any) {
    errorMsg.value =
      err?.data?.message || err?.message || t('login.errorGeneric');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card glass-modal">
      <div class="login__brand">
        <span class="login__logo">{{ locale === 'zh-CN' ? '灵' : 'A' }}</span>
        <span class="login__brand-name">{{ t('brand.name') }}</span>
      </div>

      <h1 class="login__title">{{ t('login.title') }}</h1>
      <p class="login__subtitle">{{ t('login.subtitle') }}</p>

      <form class="login__form" @submit.prevent="handleLogin">
        <label class="login__field glass-input" :class="{ 'login__field--error': errorMsg }">
          <User :size="16" class="login__field-icon" />
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            :placeholder="t('login.username')"
            class="login__input"
          />
        </label>

        <label class="login__field glass-input" :class="{ 'login__field--error': errorMsg }">
          <Lock :size="16" class="login__field-icon" />
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :placeholder="t('login.password')"
            class="login__input"
          />
          <button
            type="button"
            class="login__eye"
            :title="showPassword ? t('login.hidePassword') : t('login.showPassword')"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </label>

        <p v-if="errorMsg" class="login__error">{{ errorMsg }}</p>

        <button type="submit" class="login__submit" :disabled="!canSubmit">
          <Loader2 v-if="loading" :size="16" class="login__spinner" />
          <LogIn v-else :size="16" />
          <span>{{ loading ? t('login.signingIn') : t('login.signIn') }}</span>
        </button>

        <div class="login__wechat">
          <img
            class="login__wechat-qr"
            src="https://jitword.com/assets/media/wechat.png"
            alt="WeChat QR"
            loading="lazy"
          />
          <div class="login__wechat-body">
            <p class="login__wechat-title">{{ t('login.wechatTitle') }}</p>
            <p class="login__wechat-desc">{{ t('login.wechatDesc') }}</p>
          </div>
        </div>
      </form>

      <div class="login__sso">
        <ShieldCheck :size="14" />
        <span>{{ t('login.ssoHint') }}</span>
      </div>
    </div>

    <a
      class="login__footer"
      href="https://jitword.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t('login.poweredBy') }}
    </a>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background:
    radial-gradient(1200px 600px at 80% -10%, var(--color-accent), transparent 60%),
    var(--color-bg-primary);
}

.login__card {
  width: 100%;
  max-width: 380px;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
}

.login__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.login__logo {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--text-base);
}

.login__brand-name {
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.login__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: var(--space-2);
}

.login__subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-6);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.login__field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: 42px;
}

.login__field--error {
  border-color: var(--color-danger, #ef4444);
}

.login__field-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.login__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  min-width: 0;
  /* Keep the caret clear of the leading icon so it is never obscured. */
  padding-left: 10px;
}

.login__input::placeholder {
  color: var(--color-text-muted);
}

.login__eye {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease-out);
}

.login__eye:hover {
  color: var(--color-text-primary);
}

.login__error {
  font-size: var(--text-xs);
  color: var(--color-danger, #ef4444);
  line-height: 1.5;
}

.login__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 42px;
  margin-top: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  /* Inverts with the theme, matching the monochrome brand language. */
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  transition: all var(--duration-fast) var(--ease-out);
}

.login__submit:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.login__submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.login__spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.login__sso {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.login__sso svg {
  flex-shrink: 0;
}

/* WeChat official-account hint for users without credentials. The QR sits on
   a white pad so it stays scannable in dark mode. */
.login__wechat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--color-border-hover, var(--color-border));
  border-radius: var(--radius-md);
  background: var(--glass-bg);
}

.login__wechat-qr {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  object-fit: contain;
  padding: 3px;
  background: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.login__wechat-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.login__wechat-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.login__footer {
  margin-top: var(--space-6);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
  transition: color var(--duration-fast) var(--ease-out);
}

.login__footer:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}
</style>
