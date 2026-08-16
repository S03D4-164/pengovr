<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <div v-if="request">
      <div class="flex items-center justify-between mb-6 gap-4">
        <h1 class="text-3xl font-bold break-all">{{ request.url }}</h1>
        <BackBtn />
      </div>

      <!-- Request and Response Information -->
      <RequestResponseInfo
        class="mb-8"
        :request="request"
        :response="response"
        :show-request-raw-json="true"
      />

      <!-- Headers Section -->
      <HeadersSection
        class="mb-8"
        :request-headers="request.headers || {}"
        :response-headers="response?.headers || {}"
      />

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
          { id: 'bottom', label: '↓', btnClass: 'btn-secondary' },
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
import HeadersSection from '../components/headers-section.vue';
import RequestResponseInfo from '../components/request-response-info.vue';
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
    HeadersSection,
    RequestResponseInfo,
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
