<template>
  <div class="container mx-auto max-w-[1280px] p-4" v-if="response">
    <div class="flex items-center justify-between mb-4 gap-4">
      <h1 class="text-3xl font-bold break-all">{{ response.url }}</h1>
      <BackBtn />
    </div>

    <RequestResponseInfo
      class="mb-8"
      :request="request"
      :response="response"
      :show-response-raw-json="true"
    />

    <!-- Headers Section -->
    <HeadersSection
      id="headers-section"
      class="mb-8"
      :request-headers="request?.headers || {}"
      :response-headers="response?.headers || {}"
    />

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
import HeadersSection from '../components/headers-section.vue';
import RequestResponseInfo from '../components/request-response-info.vue';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';

export default {
  name: 'ResponseDetail',
  components: {
    NetworkSecurityCard,
    BackBtn,
    FixedNav,
    BodyAnalysisCard,
    HeadersSection,
    RequestResponseInfo,
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
