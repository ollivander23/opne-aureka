<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', typescript);
hljs.registerLanguage('json', json);

function highlightCode(str: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
    } catch { /* fallback */ }
  }
  const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre class="hljs"><code>${escaped}</code></pre>`;
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: highlightCode,
});

const props = defineProps<{
  content: string;
}>();

const rendered = computed((): string => {
  if (!props.content) return '';
  return md.render(props.content);
});
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--color-text-primary);
  word-break: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}

.markdown-body :deep(h1) { font-size: 1.4em; }
.markdown-body :deep(h2) { font-size: 1.2em; }
.markdown-body :deep(h3) { font-size: 1.05em; }

.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p) {
  margin: 0.5em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.markdown-body :deep(li > ul),
.markdown-body :deep(li > ol) {
  margin: 0.15em 0;
}

.markdown-body :deep(blockquote) {
  margin: 0.75em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--color-accent);
  background: var(--ov-03);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--color-text-secondary);
}

.markdown-body :deep(blockquote p) {
  margin: 0.25em 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
  font-size: var(--text-xs);
  overflow-x: auto;
  display: block;
}

.markdown-body :deep(thead) {
  background: var(--ov-05);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 0.5em 0.75em;
  border: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

.markdown-body :deep(th) {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.markdown-body :deep(tr:nth-child(even)) {
  background: var(--ov-02);
}

.markdown-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  background: var(--ov-06);
  border-radius: 3px;
  color: var(--color-text-secondary);
}

.markdown-body :deep(pre) {
  margin: 0.75em 0;
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  display: block;
  padding: 1em;
  background: var(--color-code-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

.markdown-body :deep(a) {
  color: var(--color-accent);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

/* highlight.js token colors (theme-aware) */
.markdown-body :deep(.hljs-keyword) { color: var(--code-keyword); }
.markdown-body :deep(.hljs-string) { color: var(--code-string); }
.markdown-body :deep(.hljs-number) { color: var(--code-number); }
.markdown-body :deep(.hljs-comment) { color: var(--code-comment); font-style: italic; }
.markdown-body :deep(.hljs-function) { color: var(--code-function); }
.markdown-body :deep(.hljs-title) { color: var(--code-function); }
.markdown-body :deep(.hljs-built_in) { color: var(--code-builtin); }
.markdown-body :deep(.hljs-literal) { color: var(--code-literal); }
</style>
