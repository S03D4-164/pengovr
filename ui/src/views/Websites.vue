<template>
  <div class="container mx-auto max-w-[1280px] p-2">
    <!-- Fixed Navigation -->
    <FixedNav />

    <!-- Error Alert -->
    <div
      v-if="errorMessage"
      class="alert alert-error shadow-sm mb-6 flex justify-between items-center"
    >
      <div class="flex items-center gap-2">
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
        <span class="font-bold">{{ errorMessage }}</span>
      </div>
      <button
        @click="fetchWebsites"
        class="btn btn-sm btn-outline text-white border-white hover:bg-white hover:text-error"
      >
        Retry
      </button>
    </div>

    <div class="card">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <h1 class="text-3xl font-bold">Websites</h1>

          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="Search by URL..."
            class="input input-bordered input-sm flex-1"
          />
          <input
            v-model="startDate"
            type="date"
            class="input input-bordered input-sm w-36"
          />
          <input
            v-model="endDate"
            type="date"
            class="input input-bordered input-sm w-36"
          />
          <label class="flex items-center gap-2 cursor-pointer mb-1">
            <input
              type="checkbox"
              v-model="onlyTracking"
              @change="handleSearch"
              class="checkbox checkbox-primary checkbox-sm"
            />
            <span class="label-text text-sm font-bold whitespace-nowrap"
              >Tracking Only</span
            >
          </label>
          <button @click="handleSearch" class="btn btn-primary btn-sm">
            Search
          </button>
          <button
            @click="clearSearch"
            v-if="searchQuery || startDate || endDate || onlyTracking"
            class="btn btn-ghost btn-sm"
          >
            Clear
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto bg-base-100 rounded-box">
      <div
        class="flex items-center justify-between p-2 mb-2 gap-2"
        v-if="data.docs.length > 0"
      >
        <div class="text-base-content/70 text-sm">
          Total: {{ data.totalDocs }} websites | Page {{ data.page }} of
          {{ data.totalPages }}
        </div>
        <div class="join">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="join-item btn btn-sm"
          >
            Previous
          </button>
          <button
            v-for="page in displayedPages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'join-item btn btn-sm',
              page === currentPage ? 'btn-primary' : '',
            ]"
          >
            {{ page }}
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage >= data.totalPages"
            class="join-item btn btn-sm"
          >
            Next
          </button>
        </div>
        <div class="flex items-center gap-2 text-sm text-base-content/70">
          <label class="whitespace-nowrap">Per page:</label>
          <select
            v-model="limit"
            @change="changeLimit(limit)"
            class="select select-bordered select-sm"
          >
            <option :value="10">10</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>
      <table class="table w-full">
        <thead>
          <tr>
            <th class="w-1/4">Website</th>
            <th class="w-2/4">Last Webpage</th>
            <th class="w-1/4">Preview</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="website in data.docs" :key="website._id" class="hover">
            <td>
              <div class="flex flex-col gap-1">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <router-link
                    :to="'/websites/' + website._id"
                    class="link link-primary text-sm"
                    >{{ website._id }}</router-link
                  >
                  <div class="text-sm opacity-60">
                    {{ getRelativeTime(website.createdAt) }}
                    <span class="opacity-50 ml-1"
                      >({{ formatDate(website.createdAt) }})</span
                    >
                  </div>
                </div>
                <div class="text-base break-all" :title="website.url">
                  {{ displayUrl(website.url) }}
                </div>
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
                <div v-else-if="website.gsb?.lookup?.matches">
                  <span class="badge badge-success badge-md text-white"
                    >GSB Safe</span
                  >
                </div>
                <div v-else-if="website.gsb?.lookup?.error">
                  <span class="badge badge-error badge-md text-white">{{
                    website.gsb.lookup.error
                  }}</span>
                </div>
                <div v-if="website.track?.counter > 0" class="mt-1">
                  <span
                    class="badge badge-info badge-outline badge-md font-semibold"
                  >
                    Track: {{ website.track.counter }} tasks /
                    {{ website.track.period || 1 }}h
                  </span>
                </div>
              </div>
            </td>

            <td>
              <div v-if="website.last" class="flex flex-col gap-1">
                <div class="flex flex-col gap-0.5 mb-1">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <router-link
                      :to="'/webpages/' + website.last._id"
                      class="link link-secondary text-sm"
                      >{{ website.last._id }}</router-link
                    >
                    <div class="text-sm opacity-60">
                      {{ getRelativeTime(website.last.createdAt) }}
                      <span class="opacity-50 ml-1"
                        >({{ formatDate(website.last.createdAt) }})</span
                      >
                      <span
                        v-if="website.last.relatedDate"
                        class="opacity-70 ml-1"
                      >
                        / Rel: {{ getRelativeTime(website.last.relatedDate) }}
                        <span class="opacity-50 ml-1"
                          >({{ formatDate(website.last.relatedDate) }})</span
                        >
                      </span>
                    </div>
                  </div>
                  <div class="text-base truncate max-w-md">
                    {{ website.last.title || 'N/A' }}
                  </div>

                  <div
                    class="text-base break-all"
                    :class="
                      website.last.url && website.last.url !== website.url
                        ? 'text-warning opacity-100'
                        : 'opacity-100'
                    "
                    :title="website.last.url || website.last.input"
                  >
                    {{ displayUrl(website.last.url || website.last.input) }}
                  </div>
                </div>

                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <span :class="getStatusClass(website.last.status)">{{
                    website.last.status || 'N/A'
                  }}</span>
                  <span class="text-sm opacity-50">|</span>
                  <span class="text-sm text-primary font-medium"
                    >Req: {{ website.last.requests?.length || 0 }}</span
                  >
                  <span class="text-sm text-success font-medium"
                    >Res: {{ website.last.responses?.length || 0 }}</span
                  >
                  <template v-if="website.last.remoteAddress?.ip">
                    <span class="text-sm opacity-50">|</span>
                    <div class="text-sm">
                      IP: {{ website.last.remoteAddress.ip }}
                      <span
                        v-if="website.last.remoteAddress.geoip?.[0]?.country"
                        class="opacity-60"
                      >
                        ({{ website.last.remoteAddress.geoip[0].country }})
                      </span>
                    </div>
                  </template>
                </div>

                <div class="flex flex-wrap gap-1.5 mt-2">
                  <span
                    v-for="tech in website.last.wappalyzer"
                    :key="tech"
                    class="badge badge-outline badge-md"
                  >
                    {{ tech }}
                  </span>
                  <span
                    v-for="rule in website.last.yara?.rules"
                    :key="rule.id"
                    class="badge badge-error badge-md text-white border-none"
                  >
                    {{ rule.id }}
                  </span>
                </div>
              </div>
              <div
                v-else
                class="text-base-content/30 italic text-sm text-center"
              >
                No history
              </div>
            </td>

            <td class="text-center">
              <div
                v-if="website.last?.thumbnail"
                @click="openScreenshotsModal(website.last)"
                class="cursor-pointer block"
              >
                <img
                  :src="getThumbnailUrl(website.last.thumbnail)"
                  class="max-w-full max-h-32 rounded border border-base-300 shadow-sm mx-auto"
                  alt="Thumbnail"
                />
              </div>
              <div v-else class="text-sm opacity-30 italic">No image</div>
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

<script>
import { websiteApi } from '../api';
import FixedNav from '../components/fixed-nav.vue';
import ScreenshotModal from '../components/screenshot-modal.vue';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';
import { formatImageUrl } from '../utils/format-utils';
import {
  getDisplayedPages,
  handlePageChange,
  handleLimitChange,
} from '../utils/pagination-utils';

export default {
  name: 'Websites',
  components: {
    FixedNav,
    ScreenshotModal,
  },
  data() {
    return {
      data: {
        docs: [],
        totalDocs: 0,
        page: 1,
        totalPages: 0,
        hasPrevPage: false,
        hasNextPage: false,
      },
      loading: true,
      currentPage: 1,
      limit: 10,
      searchQuery: '',
      startDate: '',
      endDate: '',
      onlyTracking: false,
      showModal: false,
      modalScreenshotId: null,
      modalWebpage: null,
      errorMessage: null,
    };
  },
  computed: {
    displayedPages() {
      return getDisplayedPages(this.currentPage, this.data.totalPages);
    },
  },
  async created() {
    await this.fetchWebsites();
  },
  methods: {
    scrollToSection,
    formatDate,
    getRelativeTime,
    displayUrl,
    async fetchWebsites() {
      this.loading = true;
      this.errorMessage = null;
      try {
        console.log('Fetching websites with params:', {
          page: this.currentPage,
          search: this.searchQuery,
          startDate: this.startDate,
          endDate: this.endDate,
          onlyTracking: this.onlyTracking,
        });
        const response = await websiteApi.getWebsites(
          this.currentPage,
          this.limit,
          this.searchQuery,
          this.startDate,
          this.endDate,
          this.onlyTracking,
        );
        console.log('Websites response:', response);
        this.data = response;
      } catch (error) {
        console.error('Error fetching websites:', error);
        const details =
          error.response?.data?.details ||
          error.response?.data?.error ||
          error.message ||
          'Unknown error';
        this.errorMessage = `Failed to load websites: ${details}`;
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchWebsites();
    },
    clearSearch() {
      this.searchQuery = '';
      this.startDate = '';
      this.endDate = '';
      this.onlyTracking = false;
      this.currentPage = 1;
      this.fetchWebsites();
    },
    goToPage(page) {
      handlePageChange(page, this.data.totalPages, (newPage) => {
        this.currentPage = newPage;
        this.fetchWebsites();
      });
    },
    changeLimit(newLimit) {
      handleLimitChange(newLimit, (limit) => {
        this.limit = limit;
        this.currentPage = 1;
        this.fetchWebsites();
      });
    },
    getStatusClass(status) {
      const base = 'badge badge-sm font-bold ';
      if (status >= 200 && status < 300)
        return base + 'badge-success text-white';
      if (status >= 300 && status < 400) return base + 'badge-warning';
      if (status >= 400 && status < 500) return base + 'badge-error text-white';
      if (status >= 500) return base + 'badge-error text-white';
      return base + 'badge-ghost';
    },
    getThumbnailUrl(thumbnail) {
      return formatImageUrl(thumbnail);
    },
    closeModal() {
      this.showModal = false;
      this.modalScreenshotId = null;
      this.modalWebpage = null;
    },
    openScreenshotsModal(webpage) {
      console.log(
        '[Websites] Clicked thumbnail. Full webpage object:',
        webpage,
      );
      // メインのスクリーンショットを優先し、なければギャラリーの最初の1枚をフォールバックとして使用
      const screenshotId =
        webpage?.screenshot ||
        (webpage?.screenshots?.length > 0 ? webpage.screenshots[0]._id : null);
      console.log('[Websites] Extracted screenshotId:', screenshotId);

      this.modalScreenshotId = screenshotId;
      this.modalWebpage = null;
      this.showModal = true;
    },
    scrollToSection,
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
