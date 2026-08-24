<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <h1 class="text-3xl font-bold mb-6">Webpage Processing</h1>

    <!-- Header Section -->
    <div
      class="flex items-center justify-between mb-6 bg-base-100 p-4 rounded-box shadow-sm border border-base-200"
    >
      <div class="flex items-center gap-4">
        <span class="text-base-content/70 font-medium"
          >Total: {{ webpages.length }} webpages</span
        >
        <div class="flex items-center gap-2">
          <span
            v-if="autoRefreshing"
            class="badge badge-info badge-outline gap-2 py-3 px-3"
          >
            <span class="loading loading-spinner loading-sm"></span>
            Auto-refreshing
          </span>
          <span
            v-else
            class="badge badge-success badge-outline gap-2 py-3 px-3"
          >
            <span class="text-sm font-bold">✓</span>
            Completed
          </span>
        </div>
      </div>
    </div>

    <!-- Table Container -->
    <div
      class="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200"
    >
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th class="w-4/10">Webpage</th>
            <th class="w-4/10">Result</th>
            <th class="w-2/10 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="webpage in webpages" :key="webpage._id" class="hover">
            <td>
              <div class="flex flex-col gap-1">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <router-link
                    :to="`/webpages/${webpage._id}`"
                    class="link link-primary text-sm font-mono"
                    target="_blank"
                  >
                    ID: {{ webpage._id }}
                  </router-link>
                  <div class="text-sm opacity-60">
                    {{ getRelativeTime(webpage.createdAt) }}
                    <span class="opacity-50 ml-1"
                      >({{ formatDate(webpage.createdAt) }})</span
                    >
                  </div>
                </div>
                <div
                  class="text-sm break-all opacity-80 mt-1"
                  :title="webpage.input"
                >
                  {{ truncateUrl(webpage.input) }}
                </div>

                <div
                  v-if="webpage.option"
                  class="mt-2 overflow-hidden rounded border border-base-300 bg-base-200/30"
                >
                  <table class="table table-sm w-full bg-transparent">
                    <tbody class="border-none">
                      <template
                        v-for="(value, key) in webpage.option"
                        :key="key"
                      >
                        <tr v-if="value" class="border-none">
                          <td
                            class="py-0.5 px-2 font-bold opacity-50 text-sm w-32 align-top uppercase border-none"
                          >
                            {{ key }}:
                          </td>
                          <td
                            class="py-0.5 px-2 text-sm break-all font-mono border-none leading-tight"
                          >
                            {{ value }}
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </td>
            <td>
              <div
                v-if="webpage.error"
                class="bg-error text-white text-sm font-bold px-2 py-1.5 rounded mb-3 break-all shadow-sm"
              >
                {{ webpage.error }}
              </div>
              <div class="text-base font-bold truncate max-w-md">
                {{ webpage.title || 'Loading...' }}
              </div>

              <div
                class="text-sm break-all opacity-70 mt-1"
                :title="webpage.url"
              >
                <span
                  :class="
                    webpage.url && webpage.url !== webpage.input
                      ? 'text-warning font-semibold opacity-100'
                      : ''
                  "
                >
                  {{ truncateUrl(webpage.url) }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <span
                  v-if="webpage.status"
                  :class="getHttpStatusClass(webpage.status)"
                >
                  {{ webpage.status }}
                </span>
                <span v-if="webpage.status" class="text-sm opacity-30">|</span>
                <span class="text-sm text-primary font-medium"
                  >Req: {{ webpage.requests?.length || 0 }}</span
                >
                <span class="text-sm opacity-30">|</span>
                <span class="text-sm text-success font-medium"
                  >Res: {{ webpage.responses?.length || 0 }}</span
                >
              </div>
              <div
                v-if="webpage.remoteAddress?.ip"
                class="text-sm opacity-70 font-mono mt-1"
              >
                IP: {{ webpage.remoteAddress.ip }}
                <span
                  v-if="webpage.remoteAddress?.geoip?.[0]?.country"
                  class="opacity-60 ml-1"
                >
                  ({{ webpage.remoteAddress.geoip[0].country }})
                </span>
              </div>
              <div
                v-if="webpage.securityDetails?.subjectName"
                class="text-sm opacity-50 mt-1"
              >
                SSL: {{ webpage.securityDetails.subjectName }}
              </div>
              <div
                v-if="webpage.wappalyzer?.length"
                class="flex flex-wrap gap-1 mt-2"
              >
                <span
                  v-for="tech in webpage.wappalyzer"
                  :key="tech"
                  class="badge badge-outline badge-sm opacity-70"
                >
                  {{ tech }}
                </span>
              </div>
            </td>
            <td class="text-center">
              <div class="flex flex-col items-center gap-2">
                <div
                  v-if="webpage.thumbnail"
                  @click="showFullScreenshot(webpage)"
                  class="cursor-pointer mb-1"
                >
                  <img
                    :src="getThumbnailUrl(webpage.thumbnail)"
                    class="max-w-full max-h-24 rounded border border-base-300 shadow-sm mx-auto hover:border-primary transition-colors"
                    alt="Thumbnail"
                  />
                </div>
                <div
                  v-else-if="getStatusText(webpage) === 'processing'"
                  class="opacity-30 mb-1"
                >
                  <span class="loading loading-dots loading-sm"></span>
                </div>
                <span
                  :class="[
                    'badge badge-md font-bold text-white uppercase',
                    getStatusClass(webpage),
                  ]"
                >
                  {{ getStatusText(webpage) }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Screenshot Modal -->
    <ScreenshotModal
      :visible="showModal"
      :screenshot-id="modalScreenshotId"
      @close="closeModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { taskApi, webpageApi } from '../api';
import ScreenshotModal from '../components/screenshot-modal.vue';
import { useWebpageStore } from '../stores/webpageStore';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { formatImageUrl } from '../utils/format-utils';

const webpages = ref<any[]>([]);
const router = useRouter();
const showModal = ref(false);
const modalScreenshotId = ref<string | null>(null);
const autoRefreshing = ref(true);
let intervalId: number | undefined;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const { createdWebpageIds, getWebpageIds, addWebpageId, clearWebpageIds } =
  useWebpageStore();

const fetchWebpages = async () => {
  try {
    console.log('Fetching webpages...');
    console.log('Current createdWebpageIds:', createdWebpageIds.value);
    console.log('Length of createdWebpageIds:', createdWebpageIds.value.length);

    let response;
    if (createdWebpageIds.value.length > 0) {
      // Fetch specific webpages by IDs
      const idsQuery = createdWebpageIds.value.join(',');
      console.log('Making API call with IDs:', idsQuery);
      // 手動でクエリパラメータを構築
      response = await fetch(
        `/api/webpages?ids=${encodeURIComponent(idsQuery)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ).then((res) => res.json());
    } else {
      // No webpages created yet
      console.log('No webpage IDs, returning empty result');
      response = { docs: [] };
    }
    console.log('Webpages response:', response);
    webpages.value = (response as any).docs || [];
    console.log('Webpages:', webpages.value);

    // Check if all webpages are completed
    const allCompleted = webpages.value.every(
      (webpage) =>
        webpage.thumbnail ||
        webpage.title ||
        webpage.status >= 400 ||
        webpage.error,
    );
    autoRefreshing.value = !allCompleted;

    // Stop auto-refresh if all completed
    if (allCompleted && intervalId) {
      console.log('All webpages completed, stopping auto-refresh');
      clearInterval(intervalId);
      intervalId = undefined;
    }
  } catch (err) {
    console.error('Error fetching webpages:', err);
  }
};

const viewWebpage = (webpageId: string) => {
  router.push(`/webpages/${webpageId}`);
};

const getStatusClass = (webpage: any) => {
  // If thumbnail or title exists, consider it completed
  if (webpage.thumbnail || webpage.title) return 'badge-success';
  if (webpage.status >= 400 || webpage.error) return 'badge-error';
  return 'badge-warning text-base-content';
};

const getHttpStatusClass = (status: number) => {
  const base = 'badge badge-md font-bold ';
  if (status >= 200 && status < 300) return base + 'badge-success text-white';
  if (status >= 300 && status < 400) return base + 'badge-warning';
  if (status >= 400 && status < 500) return base + 'badge-error text-white';
  if (status >= 500) return base + 'badge-error text-white';
  return base + 'badge-ghost';
};

const getStatusText = (webpage: any) => {
  // If thumbnail or title exists, consider it completed
  if (webpage.thumbnail || webpage.title) return 'COMPLETED';
  if (webpage.status >= 400 || webpage.error) return 'error';
  return 'processing';
};

const truncateUrl = (url: string) => {
  if (!url) return '';
  if (url.length > 100) {
    return url.substring(0, 97) + '...';
  }
  return url;
};

const getThumbnailUrl = (thumbnail: string) => {
  return formatImageUrl(thumbnail);
};

const showFullScreenshot = (webpage: any) => {
  console.log('[Tasks] Clicked thumbnail. Full webpage object:', webpage);

  // ルートの screenshot フィールドが null の場合、
  // screenshots 配列の最初の要素の _id を使用する
  const screenshotId =
    webpage.screenshot ||
    (webpage.screenshots && webpage.screenshots.length > 0
      ? webpage.screenshots[0]._id
      : null);

  console.log('[Tasks] Extracted screenshotId:', screenshotId);
  modalScreenshotId.value = screenshotId;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  modalScreenshotId.value = null;
};

// Debug function to clear store
const clearStore = () => {
  console.log('Clearing webpage store...');
  clearWebpageIds();
  console.log('Store cleared');
};

onMounted(() => {
  fetchWebpages();
  // Start auto-refresh interval
  intervalId = window.setInterval(fetchWebpages, 5000);
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

watch(
  createdWebpageIds,
  (newIds) => {
    if (newIds.length > 0 && !intervalId) {
      fetchWebpages();
      intervalId = window.setInterval(fetchWebpages, 5000);
    }
  },
  { deep: true },
);

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>

<style scoped>
.modal-box {
  max-height: 90vh;
}
</style>
