<template>
  <InfoCard :id="id" :title="`Response (${content?.length || 0} bytes)`">
    <template #actions>
      <div v-if="!showContent">
        <button @click="loadContent" class="btn btn-primary btn-sm">Show Content</button>
      </div>
      <div v-else class="flex gap-2 flex-wrap items-center">
        <div class="join">
          <button
            v-for="type in ['html', 'js', 'css', 'raw']"
            :key="type"
            @click="setFormat(type)"
            class="btn btn-sm join-item btn-outline uppercase"
            :class="{ 'btn-active': formatType === type || (type === 'raw' && formatType === '') }"
          >
            {{ type }}
          </button>
        </div>
        <button
          @click="toggleHighlight"
          class="btn btn-sm btn-outline"
          :class="{ 'btn-active': isHighlightEnabled }"
        >
          {{ isHighlightEnabled ? 'No Highlight' : 'Highlight' }}
        </button>
        <div class="flex gap-2">
          <button
            @click="explainWithGemini"
            class="btn btn-sm btn-info btn-outline"
            :disabled="geminiLoading"
          >
            {{ geminiLoading ? 'Queuing...' : 'Gemini' }}
          </button>
          <button
            @click="scanWithYara"
            class="btn btn-sm btn-accent btn-outline"
            :disabled="isScanning"
          >
            {{ isScanning ? 'Scanning...' : 'YARA' }}
          </button>
          <button @click="copyToClipboard" class="btn btn-sm btn-outline">Copy</button>
        </div>
        <span v-if="statusMessage" class="badge badge-info badge-sm">{{ statusMessage }}</span>
      </div>
    </template>

    <!-- Analysis Panels -->
    <div
      v-if="yaraResults || geminiExplanation || savedYara || payloads?.length"
      class="space-y-4 mb-4"
    >
      <!-- Gemini Result -->
      <div
        v-if="geminiExplanation"
        class="bg-info/10 border border-info/20 rounded p-4 text-sm italic leading-relaxed"
      >
        <h4 class="font-bold mb-1 opacity-70 uppercase tracking-wider text-sm">
          Gemini Explanation
        </h4>
        <pre class="whitespace-pre-wrap font-sans text-info">{{ geminiExplanation }}</pre>
      </div>

      <!-- Associated Payloads -->
      <div v-if="payloads?.length" class="mt-4">
        <h4 class="text-sm font-bold opacity-50 uppercase mb-2">Related Payloads</h4>
        <InfoTable>
          <template #header>
            <thead>
              <tr>
                <th class="w-1/3">ID</th>
                <th>YARA Match</th>
              </tr>
            </thead>
          </template>
          <tr v-for="(p, index) in payloads" :key="index">
            <td>
              <router-link :to="`/payloads/${p._id}`" class="link link-primary font-mono text-sm">{{
                p._id
              }}</router-link>
            </td>
            <td>{{ p.yara }}</td>
          </tr>
        </InfoTable>
      </div>
    </div>

    <!-- Saved YARA Result -->
    <div v-if="savedYara?.rules?.length" class="p-3 bg-base-200 rounded">
      <h4 class="text-sm font-bold opacity-50 uppercase mb-2">YARA Analysis</h4>
      <div v-for="rule in savedYara.rules" :key="rule.id" class="text-sm mb-2">
        <span class="badge badge-error badge-md mr-2">{{ rule.id }}</span>
        <span class="opacity-70">{{ rule.tags?.join(', ') }}</span>
      </div>
    </div>

    <!-- Live YARA Results -->
    <div v-if="yaraResults?.length" class="p-3 bg-base-200 rounded">
      <h4 class="text-sm font-bold opacity-50 uppercase mb-2">Live YARA Matches</h4>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="match in yaraResults"
          :key="match.id"
          class="badge badge-accent badge-md font-bold"
        >
          {{ match.id }}
        </span>
      </div>
    </div>
    <div v-if="yaraError" class="alert alert-error text-sm p-2 rounded">
      <span>YARA Error: {{ yaraError }}</span>
    </div>

    <!-- Code Viewer -->
    <div v-if="showContent" class="mockup-code before:hidden px-0 py-0 border border-base-300">
      <pre
        class="whitespace-pre-wrap break-all"
        :class="{ 'line-numbers': isHighlightEnabled }"
      ><code ref="codeBlock" class="text-content font-mono text-sm leading-relaxed block px-4 py-2">{{ displayContent }}</code></pre>
    </div>
    <div
      v-else
      class="p-4 bg-base-200/50 rounded border border-base-300 text-base-content/60 text-sm italic"
    >
      Content is hidden. Click "Show Content" to load.
    </div>
  </InfoCard>
</template>

<script>
import beautify from 'js-beautify';
import Prism from '../prism';
import 'prismjs/themes/prism.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import InfoCard from './info-card.vue';
import InfoTable from './info-table.vue';
import { scanContent } from '../utils/yara-utils';

export default {
  name: 'BodyAnalysisCard',
  components: { InfoCard, InfoTable },
  props: {
    id: { type: String, default: 'contents' },
    content: { type: String, default: '' },
    targetId: { type: String, required: true },
    webpageId: { type: String, default: '' },
    targetType: { type: String, default: 'webpage' }, // 'webpage' or 'response'
    savedYara: { type: Object, default: null },
    geminiExplanation: { type: String, default: '' },
    payloads: { type: Array, default: () => [] },
  },
  data() {
    return {
      showContent: false,
      formatType: 'raw',
      isHighlightEnabled: false,
      yaraResults: null,
      yaraError: null,
      isScanning: false,
      geminiLoading: false,
      statusMessage: '',
    };
  },
  computed: {
    displayContent() {
      if (!this.content) return '';
      let out = this.content;
      try {
        if (this.formatType === 'html') out = beautify.html(out, { indent_size: 2 });
        else if (this.formatType === 'js') out = beautify(out, { indent_size: 2 });
        else if (this.formatType === 'css') out = beautify.css(out, { indent_size: 2 });
      } catch (e) {
        console.warn('Beautify failed', e);
      }
      return out;
    },
  },
  methods: {
    loadContent() {
      this.showContent = true;
      this.$nextTick(() => this.applyHighlighting());
    },
    setFormat(type) {
      this.formatType = type;
      this.$nextTick(() => this.applyHighlighting());
    },
    toggleHighlight() {
      this.isHighlightEnabled = !this.isHighlightEnabled;
      this.$nextTick(() => this.applyHighlighting());
    },
    applyHighlighting() {
      const el = this.$refs.codeBlock;
      if (!el) return;

      if (this.isHighlightEnabled) {
        el.className = 'text-content font-mono text-sm leading-relaxed block px-4 py-2';
        const langMap = { html: 'language-html', js: 'language-javascript', css: 'language-css' };
        let lang = langMap[this.formatType] || 'language-javascript';

        if (this.formatType === 'raw' && this.isJson(this.content)) lang = 'language-json';

        el.classList.add(lang);
        Prism.highlightElement(el);
      } else {
        el.className = 'text-content font-mono text-sm leading-relaxed block px-4 py-2';
        el.textContent = this.displayContent;
      }
    },
    isJson(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    },
    async scanWithYara() {
      try {
        this.isScanning = true;
        this.yaraResults = await scanContent(this.content);
      } catch (e) {
        this.yaraError = e.message;
      } finally {
        this.isScanning = false;
      }
    },
    async explainWithGemini() {
      this.geminiLoading = true;
      try {
        const response = await fetch('/api/gemini/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: this.targetId,
            webpageId: this.webpageId || this.targetId,
            content: this.content,
            targetType: this.targetType,
          }),
        });
        if (!response.ok) throw new Error('Failed to queue Gemini task');
        this.statusMessage = 'Gemini task queued';
      } catch (e) {
        this.statusMessage = 'Error: ' + e.message;
      } finally {
        this.geminiLoading = false;
      }
    },
    copyToClipboard() {
      navigator.clipboard.writeText(this.displayContent).then(() => {
        this.statusMessage = 'Copied!';
        setTimeout(() => (this.statusMessage = ''), 2000);
      });
    },
  },
};
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-break: break-all;
}
:deep(pre[class*='language-']),
:deep(code[class*='language-']) {
  background: #0d1117 !important;
  color: #d4d4d4 !important;
  white-space: pre-wrap !important;
  word-break: break-all !important;
  text-shadow: none !important;
  border: none !important;
  box-shadow: none !important;
}
:deep(.token) {
  background: none !important;
}
[data-theme='dark'] .btn-outline.btn-active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: #ffffff !important;
  color: #ffffff !important;
}
</style>
