<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <h1 class="text-3xl font-bold mb-6">Screenshots</h1>

    <!-- Fixed Navigation -->
    <FixedNav />

    <!-- Search Filter -->
    <div class="card bg-base-100 shadow-sm card-bordered mb-8">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="Search by tag..."
            class="input input-bordered input-sm flex-1"
          />
          <input v-model="startDate" type="date" class="input input-bordered input-sm w-36" />
          <input v-model="endDate" type="date" class="input input-bordered input-sm w-36" />
          <button @click="handleSearch" class="btn btn-primary btn-sm">Search</button>
          <button
            @click="downloadZip"
            class="btn btn-accent btn-sm"
            :disabled="isDownloading || data.docs.length === 0"
          >
            {{ isDownloading ? 'Creating ZIP...' : 'Download ZIP' }}
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

    <div class="overflow-x-auto bg-base-100 rounded-box shadow">
      <div class="flex items-center justify-between p-2 mb-2 gap-2" v-if="data.docs.length > 0">
        <div class="text-base-content/70 text-sm">
          Total: {{ data.totalDocs }} screenshots | Page {{ data.page }} of {{ data.totalPages }}
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
            :class="['join-item btn btn-sm', page === currentPage ? 'btn-primary' : '']"
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
          <label>Per page:</label>
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
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th class="w-1/5">Created</th>
            <th class="w-1/5">ID</th>
            <th class="w-2/5">Tag</th>
            <th class="w-1/5 text-center">Preview</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="screenshot in data.docs" :key="screenshot._id" class="hover">
            <td class="text-base-content/70">
              {{ formatDate(screenshot.createdAt) }}
            </td>
            <td>
              <router-link :to="'/screenshots/' + screenshot._id" class="link link-primary">{{
                screenshot._id
              }}</router-link>
            </td>
            <td>
              <span class="break-all">{{ screenshot.tag || 'N/A' }}</span>
            </td>
            <td class="text-center">
              <div
                v-if="screenshot.screenshot"
                class="inline-block cursor-pointer"
                @click="openModal(screenshot._id)"
              >
                <img
                  :src="formatImageUrl(screenshot.screenshot)"
                  alt="Preview"
                  class="w-40 h-[90px] object-cover border border-base-300 hover:border-primary transition-colors duration-300 rounded"
                  loading="lazy"
                />
              </div>
              <span v-else class="text-base-content/50 italic">No preview</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Screenshot Modal -->
    <ScreenshotModal :visible="showModal" :screenshot-id="modalScreenshotId" @close="closeModal" />
  </div>
</template>

<script>
import { screenshotApi } from '../api';
import * as zip from '@zip.js/zip.js';
import FixedNav from '../components/fixed-nav.vue';
import ScreenshotModal from '../components/screenshot-modal.vue';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate } from '../utils/date-utils';
import { downloadBlob } from '../utils/file-utils';
import { formatImageUrl } from '../utils/format-utils';
import { getDisplayedPages, handlePageChange, handleLimitChange } from '../utils/pagination-utils';

export default {
  name: 'Screenshots',
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
      isDownloading: false,
      searchQuery: '',
      startDate: '',
      endDate: '',
      showModal: false,
      modalScreenshotId: null,
    };
  },
  computed: {
    displayedPages() {
      return getDisplayedPages(this.currentPage, this.data.totalPages);
    },
  },
  async created() {
    await this.fetchScreenshots();
  },
  methods: {
    scrollToSection,
    formatDate,
    formatImageUrl,
    async fetchScreenshots() {
      this.loading = true;
      try {
        const result = await screenshotApi.getScreenshots(
          this.currentPage,
          this.limit,
          this.searchQuery.trim(),
          this.startDate,
          this.endDate,
        );
        console.log('Received screenshots data:', result);

        if (result.docs) {
          this.data = result;
        } else {
          // Fallback if API doesn't support pagination
          this.data = {
            docs: result,
            totalDocs: result.length,
            page: 1,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          };
        }
      } catch (error) {
        console.error('Failed to fetch screenshots:', error);
        this.data = {
          docs: [],
          totalDocs: 0,
          page: 1,
          totalPages: 0,
          hasPrevPage: false,
          hasNextPage: false,
        };
      } finally {
        this.loading = false;
      }
    },
    async downloadZip() {
      this.isDownloading = true;
      try {
        // 検索クエリに一致する全データを取得（ページネーションを無視して大きなlimitを指定）
        const response = await screenshotApi.getScreenshots(
          1,
          1000,
          this.searchQuery.trim(),
          this.startDate,
          this.endDate,
        );
        const screenshots = response.docs;

        if (screenshots.length === 0) {
          alert('No screenshots found to download.');
          return;
        }

        const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));

        for (const s of screenshots) {
          if (!s.screenshot) continue;

          // Base64データをバイナリに変換
          const base64Data = s.screenshot.includes('base64,')
            ? s.screenshot.split(',')[1]
            : s.screenshot;

          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          await zipWriter.add(`${s._id}.png`, new zip.Uint8ArrayReader(bytes));
        }

        const zipBlob = await zipWriter.close();
        downloadBlob(zipBlob, `screenshots_${this.searchQuery || 'all'}.zip`);
      } catch (err) {
        console.error('Failed to create ZIP:', err);
        alert('Failed to download: ' + err.message);
      } finally {
        this.isDownloading = false;
      }
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchScreenshots();
    },
    clearSearch() {
      this.searchQuery = '';
      this.startDate = '';
      this.endDate = '';
      this.currentPage = 1;
      this.fetchScreenshots();
    },
    goToPage(page) {
      handlePageChange(page, this.data.totalPages, (newPage) => {
        this.currentPage = newPage;
        this.fetchScreenshots();
      });
    },
    changeLimit(newLimit) {
      handleLimitChange(newLimit, (limit) => {
        this.limit = limit;
        this.currentPage = 1;
        this.fetchScreenshots();
      });
    },
    openModal(screenshotId) {
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
/* テーブル全体の枠線とヘッダーのカスタマイズ */
.table th,
.table td {
  border: 1px solid #eee;
}

[data-theme='dark'] .table th,
[data-theme='dark'] .table td {
  border-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
