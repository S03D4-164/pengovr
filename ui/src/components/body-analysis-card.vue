<template>
  <InfoCard :id="id" :title="`Response (${content?.length || 0} bytes)`">
    <template #actions>
      <div v-if="!showContent">
        <button @click="loadContent" class="btn btn-primary btn-sm">
          Show Content
        </button>
      </div>
      <div v-else class="flex gap-2 flex-wrap items-center">
        <div class="join">
          <button
            v-for="type in ['html', 'js', 'css', 'raw']"
            :key="type"
            @click="setFormat(type)"
            class="btn btn-sm join-item btn-outline uppercase"
            :class="{
              'btn-active':
                formatType === type || (type === 'raw' && formatType === ''),
            }"
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
            @click="aiExplain('gemini')"
            class="btn btn-sm btn-info btn-outline"
            :disabled="aiExplainLoading"
          >
            {{ aiExplainLoading ? 'Queuing...' : 'Gemini' }}
          </button>
          <button
            @click="aiExplain('bedrock')"
            class="btn btn-sm btn-info btn-outline"
            :disabled="aiExplainLoading"
          >
            {{ aiExplainLoading ? 'Queuing...' : 'Bedrock' }}
          </button>

          <button
            @click="scanWithYara"
            class="btn btn-sm btn-accent btn-outline"
            :disabled="isScanning"
          >
            {{ isScanning ? 'Scanning...' : 'YARA' }}
          </button>
          <button @click="copyToClipboard" class="btn btn-sm btn-outline">
            Copy
          </button>
        </div>
        <span v-if="statusMessage" class="badge badge-info badge-sm">{{
          statusMessage
        }}</span>
      </div>
    </template>

    <!-- Analysis Panels -->
    <div
      v-if="
        yaraResults || effectiveAiExplanation || savedYara || payloads?.length
      "
      class="space-y-4 mb-4"
    >
      <!-- AI Result -->
      <div
        v-if="effectiveAiExplanation"
        class="bg-info/10 border border-info/20 rounded p-4 text-sm italic leading-relaxed"
      >
        <h4 class="font-bold mb-1 opacity-70 uppercase tracking-wider text-sm">
          AI Explanation
        </h4>
        <pre class="whitespace-pre-wrap font-sans text-info">{{
          effectiveAiExplanation
        }}</pre>
      </div>

      <!-- Associated Payloads -->
      <div v-if="payloads?.length" class="mt-4">
        <h4 class="text-sm font-bold opacity-50 uppercase mb-2">
          Related Payloads
        </h4>
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
              <router-link
                :to="`/payloads/${p._id}`"
                class="link link-primary font-mono text-sm"
                >{{ p._id }}</router-link
              >
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
      <h4 class="text-sm font-bold opacity-50 uppercase mb-3">
        Live YARA Matches
      </h4>
      <div class="space-y-3">
        <div
          v-for="match in yaraResults"
          :key="match.id"
          class="rounded bg-base-100 p-3 border border-base-300"
        >
          <div class="mb-2">
            <span class="badge badge-accent font-bold">{{ match.id }}</span>
          </div>
          <div v-if="match.matchedStrings?.length" class="text-sm space-y-1">
            <div
              v-for="(str, idx) in match.matchedStrings"
              :key="idx"
              class="pl-2 border-l-2 border-accent/30 text-base-content/80 font-mono text-xs break-all"
            >
              {{ str.length > 60 ? str.substring(0, 60) + '...' : str }}
            </div>
          </div>
          <div v-else class="text-xs opacity-50 italic">No matched strings</div>
        </div>
      </div>
    </div>
    <div v-if="yaraError" class="alert alert-error text-sm p-2 rounded">
      <span>YARA Error: {{ yaraError }}</span>
    </div>

    <!-- Code Viewer -->
    <div
      v-if="showContent"
      class="mockup-code before:hidden px-0 py-0 border border-base-300"
    >
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
import Mark from 'mark.js';

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
    aiExplanation: { type: String, default: '' },
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
      aiExplainLoading: false,
      aiExplainMessage: '',
      aiExplainTaskId: '',
      aiPollingInterval: null,
      localAiExplanation: '',
      statusMessage: '',
    };
  },
  computed: {
    displayContent() {
      if (!this.content) return '';
      let out = this.content;
      try {
        if (this.formatType === 'html')
          out = beautify.html(out, { indent_size: 2 });
        else if (this.formatType === 'js')
          out = beautify(out, { indent_size: 2 });
        else if (this.formatType === 'css')
          out = beautify.css(out, { indent_size: 2 });
      } catch (e) {
        console.warn('Beautify failed', e);
      }
      return out;
    },
    effectiveAiExplanation() {
      // Use local state if available, otherwise use prop
      return this.localAiExplanation || this.aiExplanation;
    },
  },
  beforeUnmount() {
    // Clean up polling when component is unmounted
    if (this.aiPollingInterval) {
      clearInterval(this.aiPollingInterval);
      this.aiPollingInterval = null;
    }
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
        el.className =
          'text-content font-mono text-sm leading-relaxed block px-4 py-2';
        const langMap = {
          html: 'language-html',
          js: 'language-javascript',
          css: 'language-css',
        };
        let lang = langMap[this.formatType] || 'language-javascript';

        if (this.formatType === 'raw' && this.isJson(this.content))
          lang = 'language-json';

        el.classList.add(lang);
        Prism.highlightElement(el);
      } else {
        el.className =
          'text-content font-mono text-sm leading-relaxed block px-4 py-2';
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
        console.log(this.yaraResults);

        // ハイライト処理
        if (this.yaraResults && this.yaraResults.length > 0) {
          this.$nextTick(() => {
            this.highlightYaraMatches();
          });
        }
      } catch (e) {
        this.yaraError = e.message;
      } finally {
        this.isScanning = false;
      }
    },
    highlightYaraMatches() {
      const codeEl = this.$refs.codeBlock;
      if (!codeEl) return;

      // mark.js インスタンスを作成
      const instance = new Mark(codeEl);

      // 既に存在するハイライトをクリア
      instance.unmark();

      // 各マッチの文字列をハイライト
      if (this.yaraResults && this.yaraResults.length > 0) {
        this.yaraResults.forEach((result, index) => {
          if (result.matchedStrings && result.matchedStrings.length > 0) {
            // 各マッチされた文字列に対して異なる色を割り当て
            const colors = [
              'bg-red-300',
              'bg-yellow-300',
              'bg-green-300',
              'bg-blue-300',
              'bg-purple-300',
              'bg-pink-300',
              'bg-cyan-300',
              'bg-orange-300',
            ];
            const colorClass = colors[index % colors.length];

            result.matchedStrings.forEach((matchedStr) => {
              instance.mark(matchedStr, {
                className: `mark-yara ${colorClass}`,
                separateWordSearch: false,
              });
            });
          }
        });
      }
    },
    async aiExplain(api) {
      this.aiExplainLoading = true;
      this.aiExplainMessage = '';
      try {
        console.log(`[BodyAnalysisCard] Requesting AI explanation with ${api}`);
        const response = await fetch('/api/ai/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: this.targetId,
            webpageId: this.webpageId || this.targetId,
            content: this.content,
            targetType: this.targetType,
            ai: api,
          }),
        });
        if (!response.ok) throw new Error('Failed to queue AI task');

        const data = await response.json();
        console.log(`[BodyAnalysisCard] Task queued with ID: ${data.taskId}`);
        this.aiExplainTaskId = data.taskId;
        this.aiExplainMessage = 'Task queued, waiting for result...';
        this.statusMessage = 'AI task queued';

        // Start polling for result
        this.pollAiResult(this.aiExplainTaskId);
      } catch (e) {
        console.error(`[BodyAnalysisCard] AI explain error:`, e);
        this.statusMessage = 'Error: ' + e.message;
        this.aiExplainMessage = '';
      } finally {
        this.aiExplainLoading = false;
      }
    },
    pollAiResult(taskId) {
      // Clear any existing polling
      if (this.aiPollingInterval) {
        clearInterval(this.aiPollingInterval);
      }

      console.log(`[BodyAnalysisCard] Starting polling for task ${taskId}`);

      // Poll every 2 seconds
      this.aiPollingInterval = setInterval(async () => {
        try {
          console.log(`[BodyAnalysisCard] Polling: taskId=${taskId}`);

          // First try polling by taskId (for raw content)
          let result = await fetch(`/api/ai/result/${taskId}`).then((res) =>
            res.json(),
          );

          // If no result by taskId, try fetching from document
          if (!result || result.status === 'pending') {
            result = await fetch(
              `/api/ai/result/${this.targetId}/${this.targetType}`,
            ).then((res) => res.json());
          }

          console.log(`[BodyAnalysisCard] Poll result:`, result);

          if (result.status === 'completed') {
            console.log(`[BodyAnalysisCard] Task completed!`);
            clearInterval(this.aiPollingInterval);
            this.aiPollingInterval = null;

            if (result.explanation) {
              this.localAiExplanation = result.explanation;
              this.aiExplainMessage = '';
              this.statusMessage = 'AI explanation completed';
              console.log(
                `[BodyAnalysisCard] Explanation set:`,
                result.explanation.substring(0, 100),
              );
              // Clear status message after 3 seconds
              setTimeout(() => (this.statusMessage = ''), 3000);
            } else if (result.error) {
              this.aiExplainMessage = `Error: ${result.error}`;
              console.error(`[BodyAnalysisCard] Task error:`, result.error);
            }
          } else {
            console.log(`[BodyAnalysisCard] Task still pending...`);
          }
          // If pending, continue polling
        } catch (err) {
          console.error('[BodyAnalysisCard] Error polling AI result:', err);
        }
      }, 2000);

      // Stop polling after 3 minutes
      setTimeout(() => {
        if (this.aiPollingInterval) {
          console.log(`[BodyAnalysisCard] Polling timeout for task ${taskId}`);
          clearInterval(this.aiPollingInterval);
          this.aiPollingInterval = null;
          this.aiExplainMessage = 'Polling timeout - check result manually';
        }
      }, 180000);
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
  width: 100%;
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
[data-theme='light'] .btn-outline.btn-active {
  background-color: rgba(0, 0, 0, 0.1) !important;
  border-color: #000000 !important;
  color: #000000 !important;
}

/* YARA ハイライトスタイル */
:deep(.mark-yara) {
  padding: 2px 4px;
  border-radius: 2px;
  font-weight: bold;
}

:deep(.mark-yara.bg-red-300) {
  background-color: rgba(239, 68, 68, 0.5);
  color: #fff;
}

:deep(.mark-yara.bg-yellow-300) {
  background-color: rgba(234, 179, 8, 0.5);
  color: #000;
}

:deep(.mark-yara.bg-green-300) {
  background-color: rgba(34, 197, 94, 0.5);
  color: #fff;
}

:deep(.mark-yara.bg-blue-300) {
  background-color: rgba(59, 130, 246, 0.5);
  color: #fff;
}

:deep(.mark-yara.bg-purple-300) {
  background-color: rgba(147, 51, 234, 0.5);
  color: #fff;
}

:deep(.mark-yara.bg-pink-300) {
  background-color: rgba(236, 72, 153, 0.5);
  color: #fff;
}

:deep(.mark-yara.bg-cyan-300) {
  background-color: rgba(34, 211, 238, 0.5);
  color: #000;
}

:deep(.mark-yara.bg-orange-300) {
  background-color: rgba(249, 115, 22, 0.5);
  color: #fff;
}
</style>
