<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main Area -->
      <div class="flex-1 flex flex-col gap-4">
        <h1 class="text-3xl font-bold">Deobfuscator</h1>

        <textarea
          v-model="inputText"
          class="textarea textarea-bordered w-full input-textarea font-mono text-sm"
          rows="15"
          placeholder="Paste JavaScript, CSS, or HTML code here..."
        ></textarea>

        <div class="relative min-h-[300px]">
          <pre
            v-if="resultText"
            class="result-display rounded p-4 bg-base-200"
            :class="{ 'pretty-printed': isHighlightEnabled }"
          ><code ref="codeElement" class="text-content font-mono text-sm leading-relaxed">{{ resultText }}</code></pre>
          <pre
            v-else
            class="result-placeholder rounded p-4 bg-base-200 italic text-base-content/30"
          ><code>result</code></pre>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="flex flex-col gap-4 w-full lg:w-48 flex-shrink-0">
        <div>
          <h3
            class="text-sm font-bold opacity-50 uppercase tracking-wider mb-2"
          >
            Beautify
          </h3>
          <div class="flex flex-col gap-2">
            <button @click="beautify('script')" class="btn btn-outline btn-sm">
              JS
            </button>
            <button
              @click="beautify('stylesheet')"
              class="btn btn-outline btn-sm"
            >
              CSS
            </button>
            <button @click="beautify('html')" class="btn btn-outline btn-sm">
              HTML
            </button>
            <button @click="decodeBase64" class="btn btn-outline btn-sm">
              Base64
            </button>
            <button
              @click="prettyPrint"
              class="btn btn-outline btn-sm"
              :class="{ 'btn-active': isHighlightEnabled }"
            >
              {{ isHighlightEnabled ? 'No Highlight' : 'Highlight' }}
            </button>
          </div>
        </div>

        <div>
          <h3
            class="text-sm font-bold opacity-50 uppercase tracking-wider mb-2"
          >
            Analysis
          </h3>
          <div class="flex flex-col gap-2">
            <button
              @click="deobfuscateIo"
              class="btn btn-outline btn-primary btn-sm text-sm"
              :disabled="loading"
            >
              Deobfuscate
            </button>
            <button
              @click="aiExplain('gemini')"
              class="btn btn-outline btn-info btn-sm text-sm"
              :disabled="aiExplainLoading || !inputText"
            >
              {{ aiExplainLoading ? 'Queuing...' : 'Gemini' }}
            </button>
            <button
              @click="aiExplain('bedrock')"
              class="btn btn-outline btn-info btn-sm text-sm"
              :disabled="aiExplainLoading || !inputText"
            >
              {{ aiExplainLoading ? 'Queuing...' : 'Bedrock' }}
            </button>

            <button
              @click="yaraScan"
              class="btn btn-outline btn-accent btn-sm text-sm"
              :disabled="loading"
            >
              YARA
            </button>
            <button @click="reset" class="btn btn-outline btn-sm text-sm">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 space-y-4">
      <div v-if="error" class="alert alert-error text-sm p-2 rounded shadow-sm">
        <pre class="whitespace-pre-wrap">{{ error }}</pre>
      </div>

      <div
        v-if="aiExplainMessage"
        class="alert alert-success text-sm p-2 rounded shadow-sm"
      >
        {{ aiExplainMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import jsBeautify from 'js-beautify';
import Prism from '../prism';
import 'prismjs/themes/prism.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import { aiExplainApi } from '../api';
import { initYara, scanContent } from '../utils/yara-utils';

export default {
  name: 'Deobfuscator',
  setup() {
    const inputText = ref('');
    const resultText = ref('');
    const isHighlightEnabled = ref(false);
    const codeElement = ref(null);
    const loading = ref(false);
    const error = ref('');
    const aiExplainLoading = ref(false);
    const aiExplainMessage = ref('');
    const aiExplainTaskId = ref('');
    const aiExplanation = ref('');
    const aiPollingInterval = ref(null);

    const reset = () => {
      resultText.value = '';
      isHighlightEnabled.value = false;
      error.value = '';
      aiExplainMessage.value = '';
      aiExplanation.value = '';
      aiExplainTaskId.value = '';
      if (aiPollingInterval.value) {
        clearInterval(aiPollingInterval.value);
        aiPollingInterval.value = null;
      }
    };

    const isJsonContent = (text) => {
      try {
        JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    };

    const applyHighlighting = () => {
      if (!codeElement.value) return;

      const el = codeElement.value;
      if (isHighlightEnabled.value) {
        el.classList.add('line-numbers');
        el.classList.add('language-javascript');

        if (isJsonContent(el.textContent)) {
          el.classList.remove('language-javascript');
          el.classList.add('language-json');
        }

        Prism.highlightElement(el);
      } else {
        el.classList.remove('line-numbers');
        el.classList.remove(
          'language-javascript',
          'language-html',
          'language-css',
          'language-json',
        );
      }
    };

    const beautify = (type) => {
      if (!inputText.value) {
        error.value = 'Please enter code to beautify';
        return;
      }
      error.value = '';

      const opts = { 'unescape-strings': true };
      let beautified;

      if (type === 'script') {
        beautified = jsBeautify.js_beautify(inputText.value, opts);
      } else if (type === 'stylesheet') {
        beautified = jsBeautify.css_beautify(inputText.value);
      } else {
        beautified = jsBeautify.html_beautify(inputText.value);
      }

      resultText.value = beautified;
      isHighlightEnabled.value = false;
      nextTick(() => {
        applyHighlighting();
      });
    };

    const decodeBase64 = () => {
      if (!inputText.value) {
        error.value = 'Please enter Base64 string to decode';
        return;
      }
      error.value = '';
      try {
        const cleaned = inputText.value.replace(/\s/g, '');
        resultText.value = atob(cleaned);
        isHighlightEnabled.value = false;
        nextTick(() => applyHighlighting());
      } catch (err) {
        error.value =
          'Decoding failed: ' +
          (err instanceof Error ? err.message : 'Invalid Base64');
        console.error('Base64 error:', err);
      }
    };

    const prettyPrint = () => {
      if (!resultText.value) {
        error.value = 'Please process code first';
        return;
      }
      error.value = '';
      isHighlightEnabled.value = !isHighlightEnabled.value;
      nextTick(() => {
        applyHighlighting();
      });
    };

    const deobfuscateIo = async () => {
      if (!inputText.value) {
        error.value = 'Please enter JavaScript code to deobfuscate';
        return;
      }
      error.value = '';
      loading.value = true;

      try {
        // Dynamically import obfuscator-io-deobfuscator
        const { deobfuscate } = await import('obfuscator-io-deobfuscator');
        const result = deobfuscate(inputText.value);
        resultText.value = result;
        isHighlightEnabled.value = false;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Deobfuscate.io error:', err);
        error.value = `Deobfuscation failed: ${message}`;
        resultText.value = `Error: ${message}`;
      } finally {
        loading.value = false;
      }
    };

    const pollAiResult = (taskId) => {
      // Clear any existing polling
      if (aiPollingInterval.value) {
        clearInterval(aiPollingInterval.value);
      }

      console.log(`Starting polling for task ${taskId}`);

      // Poll every 3 seconds
      aiPollingInterval.value = setInterval(async () => {
        try {
          console.log(`Polling task ${taskId}...`);
          const result = await aiExplainApi.getResult(taskId);
          console.log(`Poll result:`, result);

          if (result.status === 'completed') {
            console.log(`Task ${taskId} completed`);
            clearInterval(aiPollingInterval.value);
            aiPollingInterval.value = null;

            if (result.explanation) {
              resultText.value = result.explanation;
              aiExplanation.value = result.explanation;
              aiExplainMessage.value = '';
              isHighlightEnabled.value = false;
              console.log('Explanation set successfully');

              // Scroll to result section
              nextTick(() => {
                const resultDisplay = document.querySelector('.result-display');
                if (resultDisplay) {
                  resultDisplay.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }
              });
            } else if (result.error) {
              aiExplainMessage.value = `Error: ${result.error}`;
              console.error('Task returned error:', result.error);
            }
          } else {
            console.log(`Task ${taskId} still pending...`);
          }
          // If pending, continue polling
        } catch (err) {
          console.error('Error polling AI result:', err);
        }
      }, 3000);

      // Stop polling after 3 minutes
      setTimeout(() => {
        if (aiPollingInterval.value) {
          console.log(`Polling timeout for task ${taskId}`);
          clearInterval(aiPollingInterval.value);
          aiPollingInterval.value = null;
          aiExplainMessage.value = 'Polling timeout - check result manually';
        }
      }, 180000);
    };

    const aiExplain = async (ai) => {
      if (!inputText.value) {
        error.value = 'Please enter code to explain';
        return;
      }

      aiExplainLoading.value = true;
      aiExplainMessage.value = '';
      aiExplanation.value = '';

      try {
        const result = await aiExplainApi.explainContent(inputText.value, ai);
        aiExplainTaskId.value = result.taskId;
        aiExplainMessage.value = 'AI task queued, waiting for result...';
        console.log('AI task queued:', result.taskId);

        // Start polling for result
        pollAiResult(result.taskId);
      } catch (err) {
        console.error('Error queuing AI explanation:', err);
        aiExplainMessage.value =
          'Failed to queue: ' +
          (err instanceof Error ? err.message : 'Unknown error');
      } finally {
        aiExplainLoading.value = false;
      }
    };

    const yaraScan = async () => {
      if (!inputText.value) {
        error.value = 'Please enter code to scan';
        return;
      }
      error.value = '';
      loading.value = true;
      isHighlightEnabled.value = false;

      try {
        const scanResults = await scanContent(inputText.value);
        resultText.value = JSON.stringify({ results: scanResults }, null, 2);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('YARA error:', err);
        error.value = `YARA scan failed: ${message}`;
        resultText.value = `Error: ${message}`;
      } finally {
        loading.value = false;
        nextTick(() => {
          applyHighlighting();
        });
      }
    };

    onMounted(() => {
      initYara();
    });

    onUnmounted(() => {
      if (aiPollingInterval.value) {
        clearInterval(aiPollingInterval.value);
      }
    });

    return {
      inputText,
      resultText,
      isHighlightEnabled,
      codeElement,
      loading,
      error,
      aiExplainLoading,
      aiExplainMessage,
      aiExplanation,
      reset,
      beautify,
      decodeBase64,
      prettyPrint,
      deobfuscateIo,
      aiExplain,
      yaraScan,
    };
  },
};
</script>

<style scoped>
.container {
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}

pre {
  white-space: pre-wrap;
  word-break: break-all;
  max-width: 100%;
  margin: 0;
}

/* アクティブ（選択中）なアウトラインボタンの塗りつぶしを回避し、白いボーダーを維持 */
.btn-outline.btn-active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: #ffffff !important;
  color: #ffffff !important;
}
</style>
