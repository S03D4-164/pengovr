<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <div v-if="request">
      <div class="flex items-center justify-between mb-6 gap-4">
        <h1 class="text-3xl font-bold break-all">{{ request.url }}</h1>
        <BackBtn />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Request Information -->
        <InfoCard title="Request Information">
          <InfoTable>
            <tr>
              <th class="w-1/4 opacity-60">ID</th>
              <td class="font-mono text-sm opacity-70">{{ request._id }}</td>
            </tr>
            <tr>
              <th class="opacity-60">Raw JSON</th>
              <td>
                <a
                  :href="`/api/requests/${request._id}`"
                  target="_blank"
                  class="link link-primary text-sm font-mono"
                  >/api/requests/{{ request._id }}</a
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
            <tr v-if="request.postData">
              <th class="opacity-60">Post Data</th>
              <td>
                <pre
                  class="whitespace-pre-wrap break-all text-xs font-mono bg-base-200 p-2 rounded max-h-48 overflow-y-auto"
                  >{{ request.postData }}</pre
                >
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
            <tr>
              <th class="opacity-60">Created</th>
              <td class="text-sm">{{ formatDate(request.createdAt) }}</td>
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
                  class="link link-primary text-sm font-mono"
                >
                  {{ request.webpage._id }}
                </router-link>
              </td>
            </tr>
            <tr v-if="request.response">
              <th class="opacity-60">Response</th>
              <td>
                <router-link
                  :to="`/responses/${request.response._id}`"
                  class="link link-primary text-sm font-mono"
                >
                  {{ request.response._id }}
                </router-link>
              </td>
            </tr>
            <tr v-if="request.failure?.errorText">
              <th class="opacity-60 text-error">Error</th>
              <td class="text-error font-bold text-sm">
                {{ request.failure.errorText }}
              </td>
            </tr>
            <tr v-if="request.failure?.reason">
              <th class="opacity-60">Failure Reason</th>
              <td class="text-sm">{{ request.failure.reason }}</td>
            </tr>
          </InfoTable>
        </InfoCard>

        <!-- Response Information -->
        <InfoCard title="Response Information" v-if="response">
          <InfoTable>
            <tr>
              <th class="w-1/4 opacity-60">ID</th>
              <td>
                <router-link
                  :to="`/responses/${response._id}`"
                  class="link link-primary text-sm font-mono"
                >
                  {{ response._id }}
                </router-link>
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
                  class="badge badge-sm text-white"
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
                >
                  {{ response.webpage._id }}
                </router-link>
              </td>
            </tr>
            <tr v-if="response.request">
              <th class="opacity-60">Request</th>
              <td>
                <router-link
                  :to="`/requests/${response.request._id}`"
                  class="link link-primary text-sm font-mono"
                >
                  {{ response.request._id }}
                </router-link>
              </td>
            </tr>
            <tr v-if="response.payload">
              <th class="opacity-60">Payload</th>
              <td>
                <router-link
                  :to="`/payloads/${response.payload._id || response.payload}`"
                  class="link link-primary text-sm font-mono"
                >
                  {{ response.payload._id || response.payload }}
                </router-link>
              </td>
            </tr>
          </InfoTable>
        </InfoCard>
      </div>

      <!-- Headers Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <InfoCard
          title="Request Headers"
          v-if="request.headers && Object.keys(request.headers).length"
        >
          <InfoTable zebra :compact="false">
            <tr v-for="(value, key) in request.headers" :key="key">
              <th class="opacity-70 w-1/3 text-sm uppercase">{{ key }}</th>
              <td class="break-all font-mono text-sm">{{ value }}</td>
            </tr>
          </InfoTable>
        </InfoCard>

        <InfoCard
          title="Response Headers"
          v-if="
            response && response.headers && Object.keys(response.headers).length
          "
        >
          <InfoTable zebra :compact="false">
            <tr v-for="(value, key) in response.headers" :key="key">
              <th class="opacity-70 w-1/3 text-sm uppercase">{{ key }}</th>
              <td class="break-all font-mono text-sm">{{ value }}</td>
            </tr>
          </InfoTable>
        </InfoCard>
      </div>

      <!-- Remote Address -->
      <NetworkSecurityCard
        v-if="response?.remoteAddress"
        :remote-address="response.remoteAddress"
        :security-details="response.securityDetails"
        :technologies="response.wappalyzer"
        class="mb-8"
      />

      <!-- Body Section (Response Content) -->
      <BodyAnalysisCard
        v-if="response"
        id="body-section"
        :content="response.text"
        :target-id="response._id"
        :webpage-id="response.webpage?._id || response.webpage"
        target-type="response"
        :saved-yara="response.yara"
        :gemini-explanation="response.geminiExplanation"
        class="mb-12"
      />

      <FixedNav
        :targets="[
          { id: 'top', label: '↑', btnClass: 'btn-primary' },
          {
            id: 'body-section',
            label: 'BODY',
            btnClass: 'btn-outline text-sm',
          },
          { id: 'bottom', label: '↓', btnClass: 'btn-ghost' },
        ]"
      />
    </div>
  </div>
</template>

<script>
import BackBtn from '../components/back-btn.vue';
import InfoCard from '../components/info-card.vue';
import InfoTable from '../components/info-table.vue';
import FixedNav from '../components/fixed-nav.vue';
import BodyAnalysisCard from '../components/body-analysis-card.vue';
import NetworkSecurityCard from '../components/network-security-card.vue';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';

export default {
  name: 'RequestDetail',
  components: {
    BackBtn,
    InfoCard,
    InfoTable,
    FixedNav,
    NetworkSecurityCard,
    BodyAnalysisCard,
  },
  props: ['id'],
  data() {
    return {
      request: null,
      response: null,
    };
  },
  async created() {
    await this.fetchRequest();
  },
  mounted() {
    // Watch for request data to load before restoring scroll position
    this.$watch(
      'request',
      (newVal) => {
        if (newVal) {
          const scrollY = history.state?.scrollY || 0;
          if (scrollY > 0) {
            this.$nextTick(() => {
              setTimeout(() => {
                window.scrollTo(0, scrollY);
                // Clear the saved position
                history.replaceState({ ...history.state, scrollY: 0 }, '');
              }, 100);
            });
          }
        }
      },
      { immediate: true },
    );
  },
  methods: {
    displayUrl,
    formatDate,
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
    async fetchRequest() {
      try {
        const response = await fetch(`/api/requests/${this.id}`);
        this.request = await response.json();

        // Fetch response if responseId is provided in query params
        const responseId = this.$route.query.responseId;
        if (responseId) {
          await this.fetchResponse(responseId);
        }
      } catch (error) {
        console.error('Error fetching request:', error);
      }
    },
    async fetchResponse(responseId) {
      try {
        const response = await fetch(`/api/responses/${responseId}`);
        this.response = await response.json();
      } catch (error) {
        console.error('Error fetching response:', error);
      }
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

.table th,
.table td,
.card-bordered,
.mockup-code {
  border: 1px solid #eee;
  white-space: normal;
  word-break: break-all;
}

[data-theme='dark'] .table th,
[data-theme='dark'] .table td,
[data-theme='dark'] .card-bordered,
[data-theme='dark'] .mockup-code {
  border-color: rgba(255, 255, 255, 0.5);
}

pre {
  white-space: pre-wrap;
  word-break: break-all;
}

/* ハイライト時の背景色と文字色を上書き（例：ダークテーマ風） */
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

.btn-outline.btn-active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: #ffffff !important;
  color: #ffffff !important;
}
</style>
