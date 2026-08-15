<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <!-- Fixed Navigation -->
    <FixedNav />

    <h1 class="text-3xl font-bold mb-2">Responses</h1>

    <!-- Filter Message -->
    <div v-if="filterMessage" class="alert alert-info mb-2 text-sm">
      {{ filterMessage }}
    </div>

    <div class="card">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">URL</span></label
            >
            <input
              v-model="urlRegex"
              @keyup.enter="handleSearch"
              placeholder="Filter URL regex..."
              class="input input-bordered input-sm w-50"
            />
          </div>
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">Text</span></label
            >
            <input
              v-model="textRegex"
              @keyup.enter="handleSearch"
              placeholder="Filter content regex..."
              class="input input-bordered input-sm w-50"
            />
          </div>
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">IP</span></label
            >
            <input
              v-model="ipRegex"
              @keyup.enter="handleSearch"
              placeholder="Filter IP regex  ..."
              class="input input-bordered input-sm w-50"
            />
          </div>
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">YARA</span></label
            >
            <input
              v-model="yaraRegex"
              @keyup.enter="handleSearch"
              placeholder="Filter YARA regex..."
              class="input input-bordered input-sm w-50"
            />
          </div>
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">Start</span></label
            >
            <input
              v-model="startDate"
              type="date"
              class="input input-bordered input-sm w-36"
            />
          </div>
          <div class="form-control">
            <label class="label p-1"
              ><span class="label-text text-sm">End</span></label
            >
            <input
              v-model="endDate"
              type="date"
              class="input input-bordered input-sm w-36"
            />
          </div>
          <button @click="handleSearch" class="btn btn-primary btn-sm">
            Search
          </button>
          <button
            @click="downloadCsv"
            class="btn btn-accent btn-sm"
            :disabled="isDownloading || data.docs.length === 0"
          >
            {{ isDownloading ? 'Exporting...' : 'Export CSV' }}
          </button>
          <button
            @click="clearSearch"
            v-if="
              startDate ||
              endDate ||
              urlRegex ||
              textRegex ||
              ipRegex ||
              yaraRegex
            "
            class="btn btn-ghost btn-sm"
          >
            Clear
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <div
        class="flex items-center justify-between p-2 mb-2 gap-2"
        v-if="data.docs.length > 0"
      >
        <div class="text-base-content/70 text-sm">
          Total: {{ data.totalDocs }} responses | Page {{ data.page }} of
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
        <thead class="bg-base-300">
          <tr>
            <th class="w-2/7">Created</th>
            <th class="w-3/7">Response</th>
            <th class="w-2/7">Related</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="response in data.docs" :key="response._id" class="hover">
            <td class="text-base">
              {{ formatDate(response.createdAt) }}
            </td>
            <td>
              <div class="flex flex-col gap-1">
                <router-link
                  :to="`/responses/${response._id}`"
                  class="link link-primary text-base"
                  >{{ response._id }}</router-link
                >
                <div
                  class="text-base font-medium break-all"
                  :title="response.url"
                >
                  {{ displayUrl(response.url) }}
                </div>
                <div class="flex items-center gap-2 text-base">
                  <span :class="getStatusClass(response.status)">
                    {{ response.status }} {{ response.statusText }}
                  </span>
                  <span class="opacity-50">|</span>
                  <span>{{ response.text?.length || 0 }} bytes</span>
                  <span class="opacity-50">|</span>
                  <span>
                    {{ response.remoteAddress?.ip || '-' }}
                    <span v-if="response.remoteAddress?.geoip?.length">
                      ({{ response.remoteAddress.geoip[0]?.country || '' }})
                    </span>
                  </span>
                </div>
                <div
                  v-if="response.yara?.rules?.length"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="rule in response.yara.rules"
                    :key="rule.id"
                    class="badge badge-error badge-sm text-white border-none brightness-90"
                  >
                    {{ rule.id }}
                  </span>
                </div>
              </div>
            </td>
            <td>
              <div class="flex flex-col gap-1" v-if="response.webpage">
                <router-link
                  :to="`/webpages/${response.webpage._id}`"
                  class="link link-secondary text-base"
                  >{{ response.webpage._id }}</router-link
                >
                <div class="break-all text-base" :title="response.webpage.url">
                  {{ displayUrl(response.webpage.url) }}
                </div>
                <router-link
                  v-if="response.payload"
                  :to="`/payloads/${response.payload._id || response.payload}`"
                  class="badge badge-error badge-sm text-white mt-1"
                >
                  Payload
                </router-link>
              </div>
              <div v-else class="text-xs opacity-30 italic">
                No associated webpage
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { responseApi } from '../api';
import FixedNav from '../components/fixed-nav.vue';
import { formatDate } from '../utils/date-utils';
import { scrollToSection } from '../utils/scroll-utils';
import { downloadBlob } from '../utils/file-utils';
import { displayUrl } from '../utils/url-utils';
import {
  getDisplayedPages,
  handlePageChange,
  handleLimitChange,
} from '../utils/pagination-utils';

export default {
  name: 'Responses',
  components: { FixedNav },
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
      isDownloading: false,
      startDate: '',
      endDate: '',
      urlRegex: '',
      textRegex: '',
      ipRegex: '',
      yaraRegex: '',
      payloadId: '',
      yaraRuleId: '',
      filterMessage: '',
    };
  },
  computed: {
    displayedPages() {
      return getDisplayedPages(this.currentPage, this.data.totalPages);
    },
  },
  async created() {
    // Check for payloadId query parameter
    if (this.$route.query.payloadId) {
      this.payloadId = this.$route.query.payloadId;
      this.filterMessage = `Filtering responses for payload: ${this.payloadId}`;
    }
    // Check for yaraRuleId query parameter
    if (this.$route.query.yaraRuleId) {
      this.yaraRuleId = this.$route.query.yaraRuleId;
      if (this.filterMessage) {
        this.filterMessage += ` and YARA rule: ${this.yaraRuleId}`;
      } else {
        this.filterMessage = `Filtering responses matching YARA rule: ${this.yaraRuleId}`;
      }
    }
    await this.fetchResponses();
  },
  methods: {
    scrollToSection,
    displayUrl,
    async fetchResponses() {
      try {
        const args = [
          this.currentPage,
          this.limit,
          '', // search
          this.startDate,
          this.endDate,
          this.urlRegex,
          this.textRegex,
          this.ipRegex,
          this.yaraRegex,
          this.payloadId, // Add payloadId parameter
          this.yaraRuleId, // Add yaraRuleId parameter
        ];
        console.log('Fetching responses with arguments array:', args);

        const response = await responseApi.getResponses(...args);
        // APIから返されたレスポンス全体をログ出力
        console.log('API Response data:', response);
        this.data = response;
      } catch (error) {
        console.error('Error fetching responses:', error);
      }
    },
    async downloadCsv() {
      this.isDownloading = true;
      try {
        // 現在の検索フィルタを使用して一括取得 (最大1000件)
        const response = await responseApi.getResponses(
          1,
          1000,
          '',
          this.startDate,
          this.endDate,
          this.urlRegex,
          this.textRegex,
          this.ipRegex,
          this.yaraRegex,
          this.payloadId, // Add payloadId parameter
          this.yaraRuleId, // Add yaraRuleId parameter
        );
        const docs = response.docs;

        if (!docs || docs.length === 0) {
          alert('No data found to export.');
          return;
        }

        const headers = [
          'createdat',
          'id',
          'url',
          'ip',
          'reverse dns',
          'BGP',
          'country',
          'yara',
          'SSL Issuer',
        ];

        const rows = docs.map((doc) => {
          const bgp =
            doc.remoteAddress?.bgp
              ?.map((b) => `AS${b.asn} ${b.name}`)
              .join('; ') || '';
          const yara = doc.yara?.rules?.map((r) => r.id).join('; ') || '';
          const country = doc.remoteAddress?.geoip?.[0]?.country || '';

          return [
            doc.createdAt,
            doc._id,
            doc.url,
            doc.remoteAddress?.ip || '',
            doc.remoteAddress?.reverse?.join('; ') || '',
            bgp,
            country,
            yara,
            doc.securityDetails?.issuer || '',
          ].map((val) => `"${String(val).replace(/"/g, '""')}"`); // CSVのエスケープ処理
        });

        const csvContent = [
          headers.join(','),
          ...rows.map((r) => r.join(',')),
        ].join('\n');
        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        downloadBlob(
          blob,
          `responses_export_${new Date().toISOString().split('T')[0]}.csv`,
        );
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
      } finally {
        this.isDownloading = false;
      }
    },
    goToPage(page) {
      handlePageChange(page, this.data.totalPages, (newPage) => {
        this.currentPage = newPage;
        this.fetchResponses();
      });
    },
    changeLimit(newLimit) {
      handleLimitChange(newLimit, (limit) => {
        this.limit = limit;
        this.currentPage = 1;
        this.fetchResponses();
      });
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchResponses();
    },
    clearSearch() {
      this.startDate = '';
      this.endDate = '';
      this.urlRegex = '';
      this.textRegex = '';
      this.ipRegex = '';
      this.yaraRegex = '';
      this.currentPage = 1;
      this.fetchResponses();
    },
    formatDate,
    getStatusClass(status) {
      const base = 'badge badge-md font-bold brightness-90 ';
      if (status >= 200 && status < 300)
        return base + 'badge-success text-white';
      if (status >= 300 && status < 400) return base + 'badge-warning';
      if (status >= 400 && status < 500) return base + 'badge-error text-white';
      if (status >= 500) return base + 'badge-error text-white';
      return base + 'badge-ghost';
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
