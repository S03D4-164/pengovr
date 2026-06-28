<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <h1 class="text-3xl font-bold mb-6">Payloads</h1>

    <!-- Fixed Navigation -->
    <FixedNav />

    <!-- Search Filter -->
    <div class="card bg-base-100 shadow-sm card-bordered mb-8">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="Search by MD5 or YARA rule name..."
            class="input input-bordered input-sm flex-1"
          />
          <button @click="handleSearch" class="btn btn-primary btn-sm">Search</button>
          <button @click="clearSearch" v-if="searchQuery" class="btn btn-ghost btn-sm">
            Clear
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto bg-base-100 rounded-box shadow">
      <div class="flex items-center justify-between p-2 mb-2 gap-2" v-if="data.docs.length > 0">
        <div class="text-base-content/70 text-sm">
          Total: {{ data.totalDocs }} payloads | Page {{ data.page }} of {{ data.totalPages }}
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
            <th class="w-2/7">Created</th>
            <th class="w-2/7">MD5</th>
            <th class="w-1/7">Size</th>
            <th class="w-1/7">YARA</th>
            <th class="w-1/7">Tags</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payload in data.docs" :key="payload._id" class="hover">
            <td class="text-base-content/70">
              {{ formatDate(payload.createdAt) }}
            </td>
            <td>
              <router-link
                :to="'/payloads/' + payload._id"
                class="link link-primary font-mono text-sm break-all"
                :title="payload.md5"
              >
                {{ payload.md5 }}
              </router-link>
            </td>
            <td class="text-sm">
              {{ formatBytes(payload.size || 0) }}
            </td>
            <td>
              <div
                v-if="payload.yara && payload.yara.rules && payload.yara.rules.length > 0"
                class="flex flex-wrap gap-1.5"
              >
                <span
                  v-for="(rule, index) in payload.yara.rules"
                  :key="index"
                  class="badge badge-success badge-sm text-sm"
                >
                  {{ rule.id }}
                </span>
              </div>
              <span v-else class="text-base-content/30 italic text-sm">N/A</span>
            </td>
            <td>
              <span v-if="payload.tag && payload.tag.length > 0" class="badge badge-ghost badge-sm">
                {{ payload.tag.length }} tags
              </span>
              <span v-else class="text-base-content/30 italic text-sm">N/A</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { payloadApi } from '../api';
import FixedNav from '../components/fixed-nav.vue';
import { formatDate } from '../utils/date-utils';
import { scrollToSection } from '../utils/scroll-utils';
import { formatBytes } from '../utils/format-utils';
import { getDisplayedPages, handlePageChange, handleLimitChange } from '../utils/pagination-utils';

export default {
  name: 'Payloads',
  components: {
    FixedNav,
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
    };
  },
  computed: {
    displayedPages() {
      return getDisplayedPages(this.currentPage, this.data.totalPages);
    },
  },
  async created() {
    await this.fetchPayloads();
  },
  methods: {
    async fetchPayloads() {
      this.loading = true;
      try {
        const result = await payloadApi.getPayloads(
          this.currentPage,
          this.limit,
          this.searchQuery.trim(),
        );
        console.log('Received payloads data:', result);

        if (result.docs) {
          this.data = result;
        } else {
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
        console.error('Failed to fetch payloads:', error);
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
    handleSearch() {
      this.currentPage = 1;
      this.fetchPayloads();
    },
    clearSearch() {
      this.searchQuery = '';
      this.currentPage = 1;
      this.fetchPayloads();
    },
    goToPage(page) {
      handlePageChange(page, this.data.totalPages, (newPage) => {
        this.currentPage = newPage;
        this.fetchPayloads();
      });
    },
    changeLimit(newLimit) {
      handleLimitChange(newLimit, (limit) => {
        this.limit = limit;
        this.currentPage = 1;
        this.fetchPayloads();
      });
    },
    formatBytes,
    formatDate,
    scrollToSection,
  },
};
</script>

<style scoped>
.container {
  /* スクロールバーの領域を常に確保し、コンテンツの横揺れを防止 */
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}

/* テーブル全体の枠線とヘッダーのカスタマイズ */
.table th,
.table td {
  border: 1px solid #eee;
}

[data-theme='dark'] .table th,
[data-theme='dark'] .table td {
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
