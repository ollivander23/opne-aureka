/// <reference types="vite/client" />

interface Window {
  process?: {
    env: Record<string, string>;
    versions?: { node?: string };
    nextTick?: (fn: () => void) => void;
    browser?: boolean;
  };
  JitSheet?: {
    JitSheet: new (options: Record<string, unknown>) => any;
  };
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
