<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Upload, MessageSquare, BarChart2, ArrowRight } from 'lucide-vue-next';
import { computed } from 'vue';

const { t } = useI18n();
const router = useRouter();

const features = computed(() => [
  {
    icon: Upload,
    title: t('home.features.import.title'),
    desc: t('home.features.import.desc'),
  },
  {
    icon: MessageSquare,
    title: t('home.features.ask.title'),
    desc: t('home.features.ask.desc'),
  },
  {
    icon: BarChart2,
    title: t('home.features.insights.title'),
    desc: t('home.features.insights.desc'),
  },
]);
</script>

<template>
  <AppShell>
    <div class="home">
      <section class="home__hero">
        <h1 class="home__title">
          <span class="text-gradient">{{ t('home.heroTitle') }}</span>
        </h1>
        <p class="home__subtitle">{{ t('home.heroSubtitle') }}</p>
        <button class="home__cta glass-panel--interactive" @click="router.push('/workspace')">
          <span>{{ t('home.cta') }}</span>
          <ArrowRight :size="18" />
        </button>
      </section>

      <section class="home__features">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="home__feature glass-panel--interactive"
        >
          <div class="home__feature-icon">
            <component :is="feature.icon" :size="24" />
          </div>
          <h3 class="home__feature-title">{{ feature.title }}</h3>
          <p class="home__feature-desc">{{ feature.desc }}</p>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--space-12) var(--space-8);
  gap: var(--space-12);
}

.home__hero {
  text-align: center;
  max-width: 640px;
}

.home__title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  margin-bottom: var(--space-4);
}

.home__subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-8);
}

.home__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--text-sm);
  transition: all var(--duration-fast) var(--ease-out);
}

.home__cta:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.home__features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  max-width: 900px;
  width: 100%;
}

.home__feature {
  padding: var(--space-6);
  text-align: center;
}

.home__feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
}

.home__feature-title {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: var(--space-2);
}

.home__feature-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
