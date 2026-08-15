<template>
  <div class="container mx-auto max-w-[1280px] p-4" v-if="response">
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-3xl font-bold break-all">{{ response.url }}</h1>
      <BackBtn />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Request Information -->
      <div
        id="request-info"
        class="card bg-base-100 shadow-sm card-bordered"
        v-if="request"
      >
        <div class="card-body p-4">
          <h2 class="card-title text-base opacity-70">Request Information</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <tbody>
                <tr>
                  <th class="w-1/3 opacity-60">ID</th>
                  <td>
                    <router-link
                      :to="`/requests/${request._id}`"
                      class="link link-primary font-mono text-sm"
                      >{{ request._id }}</router-link
                    >
                  </td>
                </tr>
                <tr>
                  <th class="opacity-60">URL</th>
                  <td class="break-all text-sm">{{ request.url }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Method</th>
                  <td>
                    <span class="badge badge-ghost font-bold">{{
                      request.method
                    }}</span>
                  </td>
                </tr>
                <tr>
                  <th class="opacity-60">Resource Type</th>
                  <td class="text-sm">{{ request.resourceType }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Navigation</th>
                  <td>{{ request.isNavigationRequest ? 'Yes' : 'No' }}</td>
                </tr>
                <tr v-if="request.interceptionId">
                  <th class="opacity-60">Interception ID</th>
                  <td class="font-mono text-sm opacity-70">
                    {{ request.interceptionId }}
                  </td>
                </tr>
                <tr v-if="request.webpage">
                  <th class="opacity-60">Webpage</th>
                  <td>
                    <router-link
                      :to="`/webpages/${request.webpage._id}`"
                      class="link link-secondary text-sm font-mono"
                      >{{ request.webpage._id }}</router-link
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Response Information -->
      <div id="response-info" class="card bg-base-100 shadow-sm card-bordered">
        <div class="card-body p-4">
          <h2 class="card-title text-base opacity-70">Response Information</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <tbody>
                <tr>
                  <th class="w-1/3 opacity-60">ID</th>
                  <td class="font-mono text-sm opacity-70">
                    {{ response._id }}
                  </td>
                </tr>
                <tr>
                  <th class="opacity-60">Raw JSON</th>
                  <td>
                    <a
                      :href="`/api/responses/${response._id}`"
                      target="_blank"
                      class="link link-primary text-sm font-mono"
                      >/api/responses/{{ response._id }}</a
                    >
                  </td>
                </tr>
                <tr>
                  <th class="opacity-60">URL</th>
                  <td class="break-all text-sm">{{ response.url }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Status</th>
                  <td>
                    <span
                      :class="getStatusClass(response.status)"
                      class="badge badge-md font-bold text-white"
                    >
                      {{ response.status }} {{ response.statusText }}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th class="opacity-60">OK</th>
                  <td>{{ response.ok }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">MIME Type</th>
                  <td class="text-sm">{{ response.mimeType }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Encoding</th>
                  <td class="text-sm">{{ response.encoding }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Created</th>
                  <td class="text-sm">{{ formatDate(response.createdAt) }}</td>
                </tr>
                <tr>
                  <th class="opacity-60">Content Length</th>
                  <td>{{ response.text?.length || 0 }} bytes</td>
                </tr>
                <tr v-if="response.interceptionId">
                  <th class="opacity-60">Interception ID</th>
                  <td class="font-mono text-sm opacity-70">
                    {{ response.interceptionId }}
                  </td>
                </tr>
                <tr v-if="response.webpage">
                  <th class="opacity-60">Webpage</th>
                  <td>
                    <router-link
                      :to="`/webpages/${response.webpage._id}`"
                      class="link link-primary text-sm font-mono"
                      >{{ response.webpage._id }}</router-link
                    >
                  </td>
                </tr>
                <tr v-if="response.request">
                  <th class="opacity-60">Request</th>
                  <td>
                    <router-link
                      :to="`/requests/${response.request._id}`"
                      class="link link-primary text-sm font-mono"
                      >{{ response.request._id }}</router-link
                    >
                  </td>
                </tr>
                <tr v-if="response.payload">
                  <th class="opacity-60">Payload</th>
                  <td>
                    <router-link
                      :to="`/payloads/${response.payload._id || response.payload}`"
                      class="link link-primary text-sm font-mono"
                      >{{
                        response.payload._id || response.payload
                      }}</router-link
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Headers Section -->
    <div
      id="headers-section"
      class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
    >
      <div
        class="card bg-base-100 shadow-sm card-bordered"
        v-if="request?.headers && Object.keys(request.headers).length"
      >
        <div class="card-body p-4">
          <h2 class="card-title text-base opacity-70">Request Headers</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm table-zebra w-full">
              <tbody>
                <tr v-for="(value, key) in request.headers" :key="key">
                  <th class="opacity-70 w-1/3">{{ key }}</th>
                  <td class="break-all font-mono text-sm">{{ value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div
        class="card bg-base-100 shadow-sm card-bordered"
        v-if="response?.headers && Object.keys(response.headers).length"
      >
        <div class="card-body p-4">
          <h2 class="card-title text-base opacity-70">Response Headers</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm table-zebra w-full">
              <tbody>
                <tr v-for="(value, key) in response.headers" :key="key">
                  <th class="opacity-70 w-1/3">{{ key }}</th>
                  <td class="break-all font-mono text-sm">{{ value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Network & Security Section -->
    <NetworkSecurityCard
      v-if="response?.remoteAddress || response?.securityDetails"
      :remote-address="response.remoteAddress"
      :security-details="response.securityDetails"
      :technologies="response.wappalyzer"
      class="mb-8"
    />

    <!-- Body Section -->
    <BodyAnalysisCard
      v-if="response"
      id="body-section"
      :content="response.text"
      :target-id="response._id"
      :webpage-id="response.webpage?._id || response.webpage"
      target-type="response"
      :saved-yara="response.yara"
      :gemini-explanation="response.geminiExplanation"
      class="mb-8"
    />

    <!-- Fixed Navigation -->
    <FixedNav
      :targets="[
        { id: 'top', label: '↑', btnClass: 'btn-primary' },
        { id: 'body-section', label: 'BODY', btnClass: 'btn-outline text-sm' },
        { id: 'bottom', label: '↓', btnClass: 'btn-ghost' },
      ]"
    />
  </div>
</template>

<script>
import BackBtn from '../components/back-btn.vue';
import FixedNav from '../components/fixed-nav.vue';
import BodyAnalysisCard from '../components/body-analysis-card.vue';
import NetworkSecurityCard from '../components/network-security-card.vue';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';

export default {
  name: 'ResponseDetail',
  components: {
    NetworkSecurityCard,
    BackBtn,
    FixedNav,
    BodyAnalysisCard,
  },
  props: ['id'],
  data() {
    return {
      response: null,
      contentExpanded: false,
      request: null,
    };
  },
  async created() {
    await this.fetchResponse();
  },
  methods: {
    scrollToSection,
    formatDate,
    getRelativeTime,
    async fetchResponse() {
      try {
        const response = await fetch(`/api/responses/${this.id}`);
        this.response = await response.json();

        // Fetch request if requestId is provided in query params
        const requestId = this.$route.query.requestId;
        if (requestId) {
          await this.fetchRequest(requestId);
        }
      } catch (error) {
        console.error('Error fetching response:', error);
      }
    },
    async fetchRequest(requestId) {
      try {
        const response = await fetch(`/api/requests/${requestId}`);
        this.request = await response.json();
      } catch (error) {
        console.error('Error fetching request:', error);
      }
    },
    getStatusClass(status) {
      const base = 'badge badge-md font-bold ';
      if (status >= 200 && status < 300)
        return base + 'badge-success text-white';
      if (status >= 300 && status < 400) return base + 'badge-warning';
      if (status >= 400 && status < 500) return base + 'badge-error text-white';
      if (status >= 500) return base + 'badge-error text-white';
      return base + 'badge-ghost';
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

/* テーブル、カードの枠線カスタマイズ */

/* 長い行を折り返す設定 */
pre {
  white-space: pre-wrap;
  word-break: break-all;
}

/* ハイライト時の背景色と文字色を上書き */
:deep(pre[class*='language-']),
:deep(code[class*='language-']) {
  background: #0d1117 !important; /* 背景色（ダークグレー） */
  color: #d4d4d4 !important; /* 文字色 */
  text-shadow: none !important; /* Prism特有のシャドウを消去 */
  border: none !important;
  box-shadow: none !important;
}

/* Prismの特定のトークン（operatorなど）に付く背景色を消去 */
:deep(.token) {
  background: none !important;
}

/* アクティブ（選択中）なアウトラインボタンの塗りつぶしを回避し、白いボーダーを維持 */
.btn-outline.btn-active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: #ffffff !important;
  color: #ffffff !important;
}
</style>
