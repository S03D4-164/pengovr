<template>
  <div class="container mx-auto max-w-[1280px] p-2">
    <!-- Fixed Navigation -->
    <FixedNav />

    <!-- Filter Message -->
    <div v-if="filterMessage" class="alert alert-info text-sm">
      {{ filterMessage }}
    </div>

    <div class="card">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <h1 class="text-3xl font-bold">Webpages</h1>

          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="Search URL or title..."
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
          <button @click="handleSearch" class="btn btn-primary btn-sm">
            Search
          </button>
          <button
            @click="clearSearch"
            v-if="searchQuery || startDate || endDate"
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
          Total: {{ data.totalDocs }} webpages | Page {{ data.page }} of
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
      <WebpageTable
        :webpages="data.docs"
        @show-screenshot="showFullScreenshot"
      />
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
import { webpageApi } from '../api';
import FixedNav from '../components/fixed-nav.vue';
import ScreenshotModal from '../components/screenshot-modal.vue';
import WebpageTable from '../components/webpage-table.vue';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';
import { formatImageUrl } from '../utils/format-utils';

export default {
  name: 'Webpages',
  components: {
    FixedNav,
    ScreenshotModal,
    WebpageTable,
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
      currentPage: 1,
      limit: 10,
      searchQuery: '',
      startDate: '',
      endDate: '',
      showModal: false,
      modalScreenshotId: null,
      modalWebpage: null,
      payloadId: '',
      yaraRuleId: '',
      filterMessage: '',
    };
  },
  computed: {
    displayedPages() {
      const pages = [];
      const maxVisible = 5;
      let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(this.data.totalPages, start + maxVisible - 1);

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
    // Check for payloadId query parameter
    if (this.$route.query.payloadId) {
      this.payloadId = this.$route.query.payloadId;
      this.filterMessage = `Filtering webpages containing payload: ${this.payloadId}`;
      this.searchQuery = this.payloadId;
    }
    // Check for yaraRuleId query parameter
    if (this.$route.query.yaraRuleId) {
      this.yaraRuleId = this.$route.query.yaraRuleId;
      if (this.filterMessage) {
        this.filterMessage += ` and YARA rule: ${this.yaraRuleId}`;
      } else {
        this.filterMessage = `Filtering webpages matching YARA rule: ${this.yaraRuleId}`;
      }
    }
    await this.fetchWebpages();
  },
  methods: {
    formatDate,
    async fetchWebpages() {
      try {
        const response = await webpageApi.getWebpages(
          this.currentPage,
          this.limit,
          this.searchQuery,
          this.startDate,
          this.endDate,
          this.payloadId, // Add payloadId parameter
          this.yaraRuleId, // Add yaraRuleId parameter
        );
        this.data = response;
      } catch (error) {
        console.error('Error fetching webpages:', error);
      }
    },
    goToPage(page) {
      if (page < 1 || page > this.data.totalPages) return;
      this.currentPage = page;
      this.fetchWebpages();
    },
    changeLimit(newLimit) {
      this.limit = newLimit;
      this.currentPage = 1;
      this.fetchWebpages();
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchWebpages();
    },
    clearSearch() {
      this.searchQuery = '';
      this.startDate = '';
      this.endDate = '';
      this.currentPage = 1;
      this.fetchWebpages();
    },
    displayUrl,
    getRelativeTime,
    getStatusClass(status) {
      const base = 'badge badge-md font-bold ';
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
    showFullScreenshot(webpage) {
      console.log(
        '[Webpages] Clicked thumbnail. Full webpage object:',
        webpage,
      );
      // フィールド名の揺れを確認する代わりに、実用的なフォールバックを適用
      const screenshotId =
        webpage?.screenshot ||
        (webpage?.screenshots?.length > 0 ? webpage.screenshots[0]._id : null);
      console.log('[Webpages] Extracted screenshotId:', screenshotId);

      this.modalScreenshotId = screenshotId;
      this.showModal = true;
    },
    closeModal() {
      this.showModal = false;
      this.modalScreenshotId = null;
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
