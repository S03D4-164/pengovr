<template>
  <div class="container mx-auto max-w-[1280px] p-4" v-if="website">
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-3xl font-bold break-all">Website Detail</h1>
      <BackBtn />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Basic Information -->
      <InfoCard title="Basic Information" class="h-full">
        <InfoTable :compact="false">
          <tr>
            <th class="w-1/3 opacity-60">ID</th>
            <td>
              <span class="text-base">{{ website._id }}</span>
            </td>
          </tr>
          <tr>
            <th class="opacity-60">URL</th>
            <td>
              <span class="text-base font-semibold break-all">{{
                displayUrl(website.url)
              }}</span>
            </td>
          </tr>
          <tr>
            <th class="opacity-60">Raw JSON</th>
            <td>
              <a
                :href="`/api/websites/${website._id}`"
                target="_blank"
                class="link link-primary text-base"
                >/api/websites/{{ website._id }}</a
              >
            </td>
          </tr>
          <tr>
            <th class="opacity-60">Created</th>
            <td class="text-base">
              {{ formatDate(website.createdAt) }}
              <span class="opacity-50 italic text-sm ml-1"
                >({{ getRelativeTime(website.createdAt) }})</span
              >
            </td>
          </tr>
          <tr>
            <th class="opacity-60">Updated</th>
            <td class="text-base">
              {{ formatDate(website.updatedAt) }}
              <span class="opacity-50 italic text-sm ml-1"
                >({{ getRelativeTime(website.updatedAt) }})</span
              >
            </td>
          </tr>
        </InfoTable>
      </InfoCard>

      <!-- Track & GSB Area -->
      <div class="space-y-6">
        <InfoCard v-if="website.track" title="Track Configuration">
          <template #actions>
            <button @click="startEditingTrack" class="btn btn-sm btn-outline">
              Edit
            </button>
          </template>
          <InfoTable :compact="false">
            <tr>
              <th class="w-1/3 opacity-60">Counter</th>
              <td class="text-base">{{ website.track.counter || 0 }}</td>
            </tr>
            <tr>
              <th class="opacity-60">Period</th>
              <td class="text-base">{{ website.track.period || 1 }} hours</td>
            </tr>
          </InfoTable>
        </InfoCard>

        <InfoCard title="Safe Browsing (GSB)">
          <div class="flex flex-col gap-4">
            <InfoTable :compact="false">
              <tr>
                <th class="w-1/3 opacity-60">Status</th>
                <td>
                  <div
                    v-if="website.gsb?.lookup?.matches?.length > 0"
                    class="flex flex-wrap gap-1"
                  >
                    <span
                      v-for="(warning, idx) in website.gsb.lookup.matches"
                      :key="idx"
                      class="badge badge-error badge-md text-white"
                    >
                      {{ warning.threatType }}
                    </span>
                  </div>
                  <span
                    v-else-if="website.gsb?.lookup?.matches"
                    class="badge badge-success badge-md text-white"
                    >GSB Safe</span
                  >
                  <span
                    v-else-if="website.gsb?.lookup?.error"
                    class="badge badge-error badge-md text-white"
                    >{{ website.gsb.lookup.error }}</span
                  >
                  <span v-else class="badge badge-ghost badge-md"
                    >Not checked</span
                  >
                </td>
              </tr>
            </InfoTable>
            <div class="px-4 pb-2 flex items-center gap-2 justify-end">
              <span
                v-if="gsbMessage"
                class="text-xs font-bold"
                :class="gsbSuccess ? 'text-success' : 'text-error'"
                >{{ gsbMessage }}</span
              >
              <button
                @click="runGSBLookup"
                :disabled="gsbLoading"
                class="btn btn-sm btn-secondary"
              >
                <span
                  v-if="gsbLoading"
                  class="loading loading-spinner loading-sm"
                ></span>
                {{ gsbLoading ? 'Checking...' : 'Check GSB' }}
              </button>
            </div>
          </div>
        </InfoCard>
      </div>
    </div>

    <!-- Related Webpages and Groups -->
    <div class="grid grid-cols-1 gap-6 mb-8">
      <InfoCard v-if="relatedWebpages.length > 0" title="Related Webpages">
        <!-- Pagination Controls -->
        <div
          class="flex items-center justify-between p-2 mb-2 gap-2"
          v-if="totalPages > 0"
        >
          <div class="text-base-content/70 text-sm">
            Total: {{ totalWebpages }} webpages | Page {{ currentPage }} of
            {{ totalPages }}
          </div>
          <div class="join">
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage <= 1"
              class="join-item btn btn-sm"
            >
              «
            </button>
            <button
              v-for="page in displayedPages"
              :key="page"
              @click="goToPage(page)"
              :class="[
                'join-item btn btn-sm',
                page === currentPage ? 'btn-active' : '',
              ]"
            >
              {{ page }}
            </button>
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage >= totalPages"
              class="join-item btn btn-sm"
            >
              »
            </button>
          </div>
          <div class="flex items-center gap-2 text-sm text-base-content/70">
            <label>Per page:</label>
            <select
              v-model="limit"
              @change="changeLimit(limit)"
              class="select select-bordered select-sm"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>
        <WebpageTable
          :webpages="relatedWebpages"
          @show-screenshot="showFullScreenshot"
        />
      </InfoCard>

      <InfoCard v-if="website.group && website.group.length > 0" title="Groups">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="group in website.group"
            :key="group"
            class="badge badge-outline badge-sm"
          >
            {{ group }}
          </span>
        </div>
      </InfoCard>
    </div>

    <div class="mt-4 mb-16 flex justify-end">
      <router-link
        :to="'/remove/website/' + id"
        class="btn btn-error btn-outline btn-sm"
        >Delete Data</router-link
      >
    </div>

    <!-- Fixed Navigation -->
    <FixedNav
      :targets="[
        { id: 'top', label: '↑', btnClass: 'btn-primary' },
        { id: 'bottom', label: '↓', btnClass: 'btn-secondary' },
      ]"
    />

    <!-- Site Modal -->
    <SiteModal
      :visible="showSiteModal"
      :website-url="website.url"
      :counter="website.track?.counter || 0"
      :period="website.track?.period || 1"
      @close="closeSiteModal"
      @save="saveSiteModalSettings"
    />

    <!-- Screenshot Modal -->
    <ScreenshotModal
      :visible="showModal"
      :screenshot-id="modalScreenshotId"
      @close="closeModal"
    />
  </div>
</template>

<script>
import BackBtn from '../components/back-btn.vue';
import ScreenshotModal from '../components/screenshot-modal.vue';
import WebpageTable from '../components/webpage-table.vue';
import SiteModal from '../components/SiteModal.vue';
import InfoCard from '../components/info-card.vue';
import InfoTable from '../components/info-table.vue';
import FixedNav from '../components/fixed-nav.vue';
import { websiteApi, webpageApi } from '../api';
import { displayUrl } from '../utils/url-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { formatImageUrl } from '../utils/format-utils';

export default {
  name: 'WebsiteDetail',
  components: {
    BackBtn,
    ScreenshotModal,
    WebpageTable,
    SiteModal,
    InfoCard,
    InfoTable,
    FixedNav,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      website: null,
      loading: true,
      error: null,
      saving: false,
      relatedWebpages: [],
      showModal: false,
      modalWebpage: null,
      modalScreenshotId: null,
      showSiteModal: false,
      currentPage: 1,
      limit: 10,
      totalWebpages: 0,
      totalPages: 1,
      gsbLoading: false,
      gsbMessage: '',
      gsbSuccess: false,
      gsbTaskId: '',
      gsbPollingInterval: null,
    };
  },
  computed: {
    displayedPages() {
      const pages = [];
      const maxVisible = 5;
      let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(this.totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    },
  },
  async created() {
    await this.fetchWebsite();
  },
  beforeUnmount() {
    // Clean up polling when component is unmounted
    if (this.gsbPollingInterval) {
      clearInterval(this.gsbPollingInterval);
      this.gsbPollingInterval = null;
    }
  },
  methods: {
    displayUrl,
    formatDate,
    getRelativeTime,
    async fetchWebsite() {
      this.loading = true;
      try {
        this.website = await websiteApi.getWebsite(this.id);

        // 関連するWebpageを取得
        if (this.website.url) {
          await this.fetchRelatedWebpages(this.website.url);
        }
      } catch (error) {
        console.error('Error fetching website:', error);
        this.error = 'Failed to fetch website details';
      } finally {
        this.loading = false;
      }
    },
    async fetchRelatedWebpages(websiteUrl, page = 1) {
      try {
        console.log(
          `[fetchRelatedWebpages] Request: URL="${websiteUrl}", Page=${page}, Limit=${this.limit}`,
        );

        const apiPath = `/api/webpages?page=${page}&limit=${this.limit}&input=${encodeURIComponent(websiteUrl)}`;
        const data = await fetch(apiPath).then((res) => res.json());

        console.log('[fetchRelatedWebpages] Received data:', data);
        this.relatedWebpages = data.docs || [];
        this.totalWebpages = data.totalDocs || 0;
        this.totalPages = data.totalPages || 1;
        this.currentPage = page;
      } catch (error) {
        console.error('Error fetching related webpages:', error);
        this.relatedWebpages = [];
        this.totalWebpages = 0;
        this.totalPages = 1;
      }
    },
    goToPage(page) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
      if (this.website?.url) {
        this.fetchRelatedWebpages(this.website.url, page);
      }
    },
    changeLimit(newLimit) {
      this.limit = newLimit;
      this.currentPage = 1;
      if (this.website?.url) {
        this.fetchRelatedWebpages(this.website.url, 1);
      }
    },
    getStatusClass(status) {
      const base = 'badge badge-md font-bold ';
      if (status >= 200 && status < 300) return base + 'badge-success';
      if (status >= 300 && status < 400) return base + 'badge-warning';
      if (status >= 400 && status < 500) return base + 'badge-error';
      if (status >= 500) return base + 'badge-error';
      return base + 'badge-ghost';
    },
    startEditingTrack() {
      this.showSiteModal = true;
    },
    getThumbnailUrl(thumbnail) {
      return formatImageUrl(thumbnail);
    },
    showFullScreenshot(webpage) {
      console.log(
        '[WebsiteDetail] Clicked thumbnail. Full webpage object:',
        webpage,
      );
      // メインのスクリーンショットを優先し、なければギャラリーの最初の1枚を使用
      const screenshotId =
        webpage?.screenshot ||
        (webpage?.screenshots?.length > 0 ? webpage.screenshots[0]._id : null);
      console.log('[WebsiteDetail] Extracted screenshotId:', screenshotId);

      this.modalScreenshotId = screenshotId;
      this.showModal = true;
    },
    closeModal() {
      this.showModal = false;
      this.modalScreenshotId = null;
    },
    closeSiteModal() {
      this.showSiteModal = false;
    },
    async saveSiteModalSettings(settings) {
      try {
        const { counter, period, ...option } = settings;
        const response = await fetch(`/api/websites/${this.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track: {
              counter,
              period,
              option,
            },
          }),
        });

        // Update local data
        this.website.track.counter = counter;
        this.website.track.period = period;
        this.website.track.option = option;

        this.showSiteModal = false;
        console.log('Track settings saved successfully');
      } catch (error) {
        console.error('Error saving track settings:', error);
        alert('Failed to save track settings');
      }
    },
    async runGSBLookup() {
      if (!this.website?._id || !this.website?.url) {
        this.gsbMessage = 'Website info missing';
        this.gsbSuccess = false;
        return;
      }

      this.gsbLoading = true;
      this.gsbMessage = '';
      try {
        const response = await fetch(
          `/api/websites/${this.website._id}/gsb-lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          this.gsbTaskId = data.taskId;
          this.gsbMessage = 'Task queued, waiting for result...';
          this.gsbSuccess = true;
          console.log('GSB lookup task queued:', this.gsbTaskId);

          // Start polling for result
          this.pollGSBResult(this.gsbTaskId);
        } else {
          const error = await response.json();
          console.error('Failed to queue GSB lookup:', error);
          this.gsbMessage = 'Queue failed';
          this.gsbSuccess = false;
        }
      } catch (error) {
        console.error('Error running GSB lookup:', error);
        this.gsbMessage = 'Error occurred';
        this.gsbSuccess = false;
      } finally {
        this.gsbLoading = false;
      }
    },
    pollGSBResult(taskId) {
      // Clear any existing polling
      if (this.gsbPollingInterval) {
        clearInterval(this.gsbPollingInterval);
      }

      // Poll every 2 seconds to fetch updated website data
      this.gsbPollingInterval = setInterval(async () => {
        try {
          const updatedWebsite = await fetch(
            `/api/websites/${this.website._id}`,
          ).then((res) => res.json());

          // Check if GSB result has been populated
          if (updatedWebsite.gsb && updatedWebsite.gsb.lookup) {
            clearInterval(this.gsbPollingInterval);
            this.gsbPollingInterval = null;

            // Update website data with result
            this.website = updatedWebsite;
            this.gsbMessage = 'GSB check completed';
            this.gsbSuccess = true;
          }
          // If pending, continue polling
        } catch (err) {
          console.error('Error polling GSB result:', err);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        if (this.gsbPollingInterval) {
          clearInterval(this.gsbPollingInterval);
          this.gsbPollingInterval = null;
          this.gsbMessage = 'Polling timeout - check result manually';
        }
      }, 300000);
    },
  },
};
</script>

<style scoped>
.container {
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}
</style>
