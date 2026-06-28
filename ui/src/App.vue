<template>
  <div class="flex flex-col min-h-screen bg-base-100">
    <header
      class="flex justify-center items-center py-4 px-6 bg-base-100 border-b border-base-200 shadow-sm sticky top-0 z-40"
    >
      <nav class="flex items-center gap-4 flex-wrap justify-center">
        <ul class="menu menu-horizontal bg-base-200 rounded-box p-1 gap-1">
          <li><RouterLink to="/websites" active-class="active">Websites</RouterLink></li>
          <li><RouterLink to="/webpages" active-class="active">Webpages</RouterLink></li>
          <li><RouterLink to="/responses" active-class="active">Responses</RouterLink></li>
          <li><RouterLink to="/screenshots" active-class="active">Screenshots</RouterLink></li>
          <li><RouterLink to="/payloads" active-class="active">Payloads</RouterLink></li>
          <li><RouterLink to="/yara-rules" active-class="active">YARA</RouterLink></li>
          <li><RouterLink to="/user-agents" active-class="active">UA</RouterLink></li>
          <li><RouterLink to="/deobfuscator" active-class="active">Deobfuscator</RouterLink></li>
          <li>
            <a href="/admin/queues" target="_blank" rel="noopener noreferrer">Queues</a>
          </li>
        </ul>
        <button class="btn btn-outline btn-success btn-sm" @click.prevent="openUrlModal">
          Add URLs
        </button>
        <label class="swap swap-rotate btn btn-sm btn-ghost btn-circle">
          <input type="checkbox" :checked="isDark" @change="toggleTheme" />
          <svg
            class="swap-on h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <path
              d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
            />
          </svg>
          <svg
            class="swap-off h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </label>
      </nav>
    </header>

    <main class="flex-1 w-full max-w-[1280px] mx-auto p-4 sm:p-6 lg:p-8 layout-container">
      <RouterView />
    </main>

    <footer
      class="footer footer-center p-4 bg-base-200 text-base-content/70 border-t border-base-300 mt-auto"
    >
      <aside>
        <p>Backend API: /api</p>
      </aside>
    </footer>

    <!-- URL Modal -->
    <UrlModal ref="urlModalRef" @submit="handleModalSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { taskApi } from './api';
import { useWebpageStore } from './stores/webpageStore';
import UrlModal from './components/modal.vue';

const router = useRouter();
const urlModalRef = ref<InstanceType<typeof UrlModal>>();

const { addWebpageId, clearWebpageIds } = useWebpageStore();

const isDark = ref(false);

onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    isDark.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (
    !savedTheme &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    isDark.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  const newTheme = isDark.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
};

const clearStore = () => {
  console.log('Clearing webpage store before creating new tasks...');
  clearWebpageIds();
  console.log('Store cleared');
};

const openUrlModal = () => {
  if (urlModalRef.value) {
    urlModalRef.value.showUrlModal = true;
  }
};

const handleModalSubmit = async (payload: { formData: any; onSuccess: () => void; onError: (msg: string) => void }) => {
  const { formData, onSuccess, onError } = payload;
  console.log('handleModalSubmit called with formData:', formData);
  clearStore();

  const rawUrls = formData.urlsText
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  console.log('Processed URLs:', rawUrls);

  if (rawUrls.length === 0) {
    console.log('No URLs to process, returning');
    onError('Please enter at least one URL');
    return;
  }

  let successCount = 0;
  let lastError: any = null;

  try {
    for (const url of rawUrls) {
      try {
        console.log(`Creating task for URL: ${url}`);
        const response = await taskApi.createTask(url, {
          userAgent: formData.userAgent || undefined,
          referrer: formData.referrer || undefined,
          track: formData.track,
          language: formData.language,
          proxy: formData.proxy,
          actions: formData.actions,
          timeout: formData.timeout,
          delay: formData.delay,
          pptr: formData.pptr,
          disableScript: formData.disableScript,
          cloudflare: formData.cloudflare,
          extraHeaders: formData.extraHeaders,
        } as any);
        console.log(`Task creation response for ${url}:`, response);
        if (response?.webpageId) {
          console.log(`Adding webpageId to store: ${response.webpageId}`);
          addWebpageId(response.webpageId);
          console.log(`WebpageId added. Current store:`, useWebpageStore().createdWebpageIds.value);
          successCount++;
        } else {
          console.log(`No webpageId in response for ${url}:`, response);
        }
      } catch (err: any) {
        console.error(`Failed to create task for ${url}:`, err);
        console.error('Error response:', err.response?.data);
        if (err.response?.data?.details) {
          console.error('Error details:', err.response.data.details);
        }
        lastError = err;
      }
    }

    if (successCount > 0) {
      onSuccess();
      console.log('All successful URLs processed. Navigating to /tasks...');
      console.log('Final webpage store:', useWebpageStore().createdWebpageIds.value);
      await router.push('/tasks');
      console.log('Navigation completed');
    } else {
      const details = lastError?.response?.data?.details;
      const errorMsg = lastError?.response?.data?.error || lastError?.message || 'Unknown error';
      const formattedError = details ? `${errorMsg} (${details})` : errorMsg;
      onError(`Failed to create tasks: ${formattedError}`);
    }
  } catch (err: any) {
    console.error('Unexpected error in handleModalSubmit:', err);
    onError(`Unexpected error: ${err.message || err}`);
  }
};
</script>

<style scoped>
.layout-container {
  /* 全ページ共通でスクロールバーによるレイアウトシフトを防止 */
  scrollbar-gutter: stable;
  overflow-y: auto;
}
/* 塗りつぶしバッジの明るさを全体的に少し抑える */
:deep(.badge:not(.badge-outline):not(.badge-ghost)) {
  filter: brightness(0.8);
}
</style>
