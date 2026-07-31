import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { i18n } from './locales';

import 'virtual:uno.css';
import './styles/variables.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/animations.css';

// Apply the persisted (or OS-preferred) theme before first paint to avoid a
// flash of the default dark theme for light-theme users.
(function applyInitialTheme() {
  const stored = localStorage.getItem('aureka_theme');
  const theme =
    stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

app.mount('#app');
