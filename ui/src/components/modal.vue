<template>
  <!-- URL Modal -->
  <div v-if="showUrlModal" class="modal modal-open" @click="closeUrlModal">
    <div
      class="modal-box max-w-4xl p-0 overflow-hidden border border-base-300"
      @click.stop
    >
      <div
        class="flex items-center justify-between p-2 border-b border-base-200 bg-base-200/50"
      >
        <h3 class="font-bold text-lg">Add URLs</h3>
        <button @click="closeUrlModal" class="btn btn-ghost btn-sm btn-circle">
          &times;
        </button>
      </div>
      <div class="p-4 overflow-auto max-h-[90vh] space-y-4">
        <div class="form-control w-full">
          <textarea
            v-model="urlsText"
            class="textarea textarea-bordered w-full h-32"
            @paste="handlePaste"
          ></textarea>
        </div>

        <div class="flex flex-col gap-4">
          <div class="bg-base-200/30 p-2 rounded-lg border border-base-200">
            <label class="inline-label">
              <span class="label-text font-bold">Track Mode</span>
              <select
                v-model="track"
                class="select select-bordered select-sm w-full"
              >
                <option value="0" selected>-</option>
                <option value="1">1hx24 (no overwrite)</option>
                <option value="2">1hx24 (overwrite)</option>
              </select>
            </label>
          </div>

          <ScrapingOptionsForm v-model="scrapingOptions" />
        </div>

        <div class="pt-4">
          <button
            class="btn btn-primary w-full"
            @click="submitUrls"
            :disabled="loading"
          >
            {{ loading ? 'Submitting...' : 'Add URLs' }}
          </button>
          <div
            v-if="message"
            class="alert mt-4 shadow-sm"
            :class="error ? 'alert-error' : 'alert-success'"
          >
            <svg
              v-if="!error"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { userAgentApi } from '../api';
import ScrapingOptionsForm from './ScrapingOptionsForm.vue';
import { SCRAPING_OPTIONS } from '../config/scrapingOptions';

const emit = defineEmits(['submit']);

interface UserAgent {
  _id: string;
  name: string;
  userAgent: string;
}

const showUrlModal = ref(false);
const urlsText = ref('https://');

// SCRAPING_OPTIONS から初期値オブジェクトを動的に組み立てる
const initialOptions = SCRAPING_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.default;
    return acc;
  },
  {} as Record<string, any>,
);

// 組み立てたオブジェクトを ref に渡す
//const scrapingOptions = ref(initialOptions);
const scrapingOptions = ref({
  userAgent: '',
  language: 'ja',
  referrer: '',
  proxy: '',
  timeout: 30,
  delay: 5,
  disableScript: false,
  actions: '',
  extraHeaders: '',
});

const track = ref('0');
const loading = ref(false);
const userAgents = ref<UserAgent[]>([]);
const userAgentsLoading = ref(false);

const fetchUserAgents = async () => {
  try {
    userAgentsLoading.value = true;
    const response = await userAgentApi.getAllUserAgents();
    userAgents.value = response.results;
    // 先頭のUAをデフォルト値として設定
    if (response.results.length > 0 && !scrapingOptions.value.userAgent) {
      scrapingOptions.value.userAgent = response.results[0].userAgent;
    }
  } catch (err: any) {
    console.error('Failed to fetch user agents:', err);
  } finally {
    userAgentsLoading.value = false;
  }
};
const message = ref('');
const error = ref(false);

const onLanguageChange = (e: Event) => {
  console.log('Language change event triggered');
  console.log('Current urlsText before change:', urlsText.value);
  console.log('New language value:', (e.target as HTMLSelectElement).value);
  // 少し遅延して確認
  setTimeout(() => {
    console.log('urlsText after change timeout:', urlsText.value);
  }, 100);
};

const handlePaste = (e: ClipboardEvent) => {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const clipboardText = clipboardData.getData('Text').split('\n');
  const text = clipboardText
    .map((line: string) =>
      line
        .replace(/^ +/, '')
        .replace(/\[:\]/g, ':')
        .replace(/\[.\]/g, '.')
        .replace(/^url./i, '')
        .replace(/^hxxp/i, 'http'),
    )
    .join('\n');

  const textarea = e.target as HTMLTextAreaElement;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;

  const newValue =
    textarea.value.substring(0, startPos) +
    text +
    textarea.value.substring(endPos);
  urlsText.value = newValue;

  setTimeout(() => {
    textarea.selectionStart = startPos + text.length;
    textarea.selectionEnd = startPos + text.length;
  }, 0);

  e.preventDefault();
};

const submitUrls = () => {
  const formData = {
    urlsText: urlsText.value,
    options: scrapingOptions.value,
  };

  loading.value = true;
  message.value = '';
  error.value = false;
  console.log('submitUrls formData:', formData);
  // Emit event to parent component
  emit('submit', {
    formData,
    onSuccess: () => {
      loading.value = false;
      resetForm();
      closeUrlModal();
    },
    onError: (errMsg: string) => {
      loading.value = false;
      error.value = true;
      message.value = errMsg;
    },
  });
};

const resetForm = () => {
  urlsText.value = 'https://';
  scrapingOptions.value = {
    userAgent: userAgents.value.length > 0 ? userAgents.value[0].userAgent : '',
    language: 'ja',
    referrer: '',
    proxy: '',
    timeout: 30,
    delay: 5,
    disableScript: false,
    actions: '',
    extraHeaders: '',
  };
  //track.value = '0';
  message.value = '';
  error.value = false;
};

const closeUrlModal = () => {
  showUrlModal.value = false;
};

onMounted(() => {
  fetchUserAgents();
});

defineExpose({
  showUrlModal,
  closeUrlModal,
  submitUrls,
});
</script>

<style scoped>
.inline-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-label span {
  min-width: 80px;
  flex-shrink: 0;
}
</style>
