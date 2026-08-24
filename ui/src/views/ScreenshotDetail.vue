<template>
  <div class="container mx-auto max-w-[1280px] p-4" v-if="screenshot">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">Screenshot Details</h1>
      <BackBtn />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- Metadata Card -->
      <div class="card bg-base-100 shadow-sm card-bordered">
        <div class="card-body">
          <h2 class="card-title text-sm opacity-70">Metadata</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <tbody>
                <tr>
                  <th class="text-base-content/50 w-1/3">ID</th>
                  <td class="font-mono text-sm break-all">
                    {{ screenshot._id }}
                  </td>
                </tr>
                <tr>
                  <th class="opacity-50">Raw JSON</th>
                  <td>
                    <a
                      :href="`/api/screenshots/${screenshot._id}`"
                      target="_blank"
                      class="link link-primary text-sm font-mono"
                      >/api/screenshots/{{ screenshot._id }}</a
                    >
                  </td>
                </tr>
                <tr v-if="screenshot.md5">
                  <th class="opacity-50">MD5</th>
                  <td class="font-mono text-sm">{{ screenshot.md5 }}</td>
                </tr>
                <tr v-if="screenshot.createdAt">
                  <th class="text-base-content/50">Created</th>
                  <td>{{ formatDate(screenshot.createdAt) }}</td>
                </tr>
                <tr v-if="screenshot.updatedAt">
                  <th class="text-base-content/50">Updated</th>
                  <td>{{ formatDate(screenshot.updatedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tags Card -->
      <div
        class="card bg-base-100 shadow-sm card-bordered"
        v-if="screenshot.tag && screenshot.tag.length > 0"
      >
        <div class="card-body">
          <h2 class="card-title text-sm opacity-70">Tags</h2>
          <div class="space-y-2">
            <div
              v-for="(tag, index) in screenshot.tag"
              :key="index"
              class="mockup-code before:hidden px-4 py-0 text-sm overflow-hidden"
            >
              <pre
                class="whitespace-pre-wrap break-all"
              ><code>{{ JSON.stringify(tag, null, 2) }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Section -->
    <div class="bg-base-200 rounded-box p-4 flex flex-col items-center">
      <div class="relative cursor-pointer group" @click="showModal = true">
        <img
          :src="formatImageUrl(screenshot.screenshot)"
          alt="Screenshot Preview"
          class="max-w-full max-h-32 h-auto rounded shadow-lg border border-preview group-hover:border-primary mx-auto block"
        />
      </div>
    </div>

    <!-- Screenshot Modal -->
    <ScreenshotModal
      :visible="showModal"
      :screenshot-id="id"
      @close="showModal = false"
    />
  </div>

  <!-- Loading State -->
  <div
    v-else-if="loading"
    class="flex flex-col items-center justify-center min-h-[50vh] gap-4"
  >
    <span class="loading loading-spinner loading-lg text-primary"></span>
    <p class="text-base-content/60">Loading screenshot details...</p>
  </div>

  <!-- Error State -->
  <div v-else class="container mx-auto p-4">
    <div class="alert alert-error max-w-lg mx-auto">
      <svg
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
      <span>Screenshot not found or failed to load.</span>
      <div class="flex-none">
        <BackBtn class="btn-sm" />
      </div>
    </div>
  </div>
</template>

<script>
import { screenshotApi } from '../api';
import ScreenshotModal from '../components/screenshot-modal.vue';
import BackBtn from '../components/back-btn.vue';
import { formatDate } from '../utils/date-utils';
import { formatImageUrl } from '../utils/format-utils';

export default {
  name: 'ScreenshotDetail',
  components: {
    BackBtn,
    ScreenshotModal,
  },
  props: ['id'],
  data() {
    return {
      screenshot: null,
      loading: true,
      error: null,
      showModal: false,
    };
  },
  async created() {
    await this.fetchScreenshot();
  },
  watch: {
    id() {
      this.fetchScreenshot();
    },
  },
  methods: {
    formatDate,
    formatImageUrl,
    async fetchScreenshot() {
      if (!this.id) return;

      this.loading = true;
      this.error = null;

      try {
        this.screenshot = await screenshotApi.getScreenshot(this.id);
      } catch (error) {
        console.error('Failed to fetch screenshot:', error);
        this.error = 'Failed to load screenshot';
        this.screenshot = null;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.container {
  /* スクロールバーの領域を確保し、ガタつきを防止 */
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}
</style>
