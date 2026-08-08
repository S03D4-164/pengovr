<template>
  <div
    class="container mx-auto max-w-[1280px] p-4"
    :style="{ visibility: isContentVisible ? 'visible' : 'hidden' }"
  >
    <div v-if="webpage">
      <div class="flex items-center justify-between mb-6 gap-4">
        <h1 class="text-4xl font-bold break-all">{{ webpage.input }}</h1>
        <BackBtn />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Basic Information -->
        <InfoCard title="Basic Information">
          <InfoTable>
            <tr>
              <th class="w-1/4 opacity-60">ID</th>
              <td>
                <router-link
                  :to="`/webpages/${webpage._id}`"
                  class="link link-primary font-mono text-base"
                >
                  {{ webpage._id }}
                </router-link>
              </td>
            </tr>
            <tr>
              <th class="opacity-60">Raw JSON</th>
              <td>
                <a
                  :href="`/api/webpages/${webpage._id}`"
                  target="_blank"
                  class="link link-primary text-sm font-mono"
                  >/api/webpages/{{ webpage._id }}</a
                >
              </td>
            </tr>
            <tr>
              <th class="opacity-60">Created</th>
              <td class="text-base">
                {{ formatDate(webpage.createdAt) }}
                <span class="opacity-50 italic text-sm ml-1"
                  >({{ getRelativeTime(webpage.createdAt) }})</span
                >
              </td>
            </tr>
            <tr v-if="website">
              <th class="opacity-60">Website</th>
              <td class="break-all">
                <router-link
                  :to="`/websites/${website._id}`"
                  class="link link-primary font-mono text-base"
                >
                  {{ displayUrl(website.url) }}
                </router-link>
              </td>
            </tr>
          </InfoTable>

          <h3 class="text-sm font-bold opacity-50 uppercase mt-6 mb-2">
            Scraping Options
          </h3>
          <InfoTable
            v-if="webpage.option && Object.keys(webpage.option).length"
          >
            <template v-for="(value, key) in webpage.option" :key="key">
              <tr v-if="value">
                <th class="w-1/4 opacity-60 uppercase text-sm">{{ key }}</th>
                <td class="font-mono text-sm">{{ value }}</td>
              </tr>
            </template>
          </InfoTable>
        </InfoCard>

        <!-- Screenshots -->
        <InfoCard title="Screenshots">
          <div v-if="webpage.thumbnail" class="mb-4">
            <img
              :src="`data:image/png;base64,${webpage.thumbnail}`"
              alt="Thumbnail"
              class="max-w-full h-auto rounded border border-base-300 shadow-sm cursor-pointer hover:border-primary transition-all block mx-auto"
              @click="
                openScreenshotsModal(
                  webpage.screenshot?._id || webpage.screenshot,
                )
              "
            />
          </div>

          <div v-if="webpage.screenshots?.length" class="mb-6">
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="(screenshot, index) in webpage.screenshots"
                :key="screenshot.full?._id || screenshot._id"
                class="screenshot-item"
              >
                <div class="text-sm opacity-50 font-bold uppercase text-center">
                  #{{ index }}
                </div>
                <img
                  :src="getThumbnailUrl(screenshot.thumbnail)"
                  alt="Screenshot"
                  class="w-full h-16 object-cover rounded border border-base-300 cursor-pointer hover:border-primary transition-colors"
                  @click="
                    openScreenshotsModal(
                      screenshot.full?._id || screenshot.full || screenshot._id,
                    )
                  "
                />
              </div>
            </div>
          </div>

          <h3 class="text-sm font-bold opacity-50 uppercase mt-4 mb-2">
            Analysis Result
          </h3>
          <InfoTable>
            <tr>
              <th class="w-1/6 opacity-60">URL</th>
              <td class="break-all text-sm">
                <span
                  :class="
                    webpage.url && webpage.url !== webpage.input
                      ? 'text-warning font-semibold'
                      : ''
                  "
                >
                  {{ displayUrl(webpage.url) }}
                </span>
              </td>
            </tr>
            <tr>
              <th class="opacity-60">Title</th>
              <td class="text-base">{{ webpage.title || 'N/A' }}</td>
            </tr>
            <tr>
              <th class="opacity-60">Status</th>
              <td>
                <span
                  :class="getStatusClass(webpage.status)"
                  class="badge text-white"
                >
                  {{ webpage.status || '???' }}
                </span>
              </td>
            </tr>
            <tr v-if="webpage.error">
              <th class="opacity-60">Error</th>
              <td class="text-error text-sm font-bold">{{ webpage.error }}</td>
            </tr>
          </InfoTable>

          <!-- HAR File Download -->
          <div
            v-if="webpage.harfile"
            class="mt-6 pt-4 border-t border-base-300 flex items-center gap-4"
          >
            <span class="text-sm font-bold opacity-50 uppercase">HAR File</span>
            <button
              @click="downloadHarFile"
              class="btn btn-sm btn-outline btn-error"
            >
              Download (.zip / infected)
            </button>
          </div>
        </InfoCard>
      </div>

      <div class="mb-4">
        <!-- Network & Security Info -->
        <NetworkSecurityCard
          v-if="webpage.remoteAddress || webpage.securityDetails"
          :remote-address="webpage.remoteAddress"
          :security-details="webpage.securityDetails"
          :technologies="webpage.wappalyzer"
        />
      </div>

      <!-- Requests Table -->
      <InfoCard
        id="requests"
        class="mb-8"
        v-if="webpage.requests?.length || webpage.responses?.length"
        :title="`Requests & Responses (Req: ${webpage.requests?.length || 0}, Res: ${webpage.responses?.length || 0})`"
      >
        <template #actions>
          <div class="flex flex-wrap gap-2 items-center">
            <!-- Filters -->
            <input
              v-model="filterIp"
              type="text"
              placeholder="Filter IP..."
              class="input input-bordered input-xs w-32"
            />
            <input
              v-model="filterText"
              type="text"
              placeholder="Filter Body Text..."
              class="input input-bordered input-xs w-48"
            />
            <label class="label cursor-pointer gap-1 p-0 select-none">
              <span class="label-text text-xs">Nav Only</span>
              <input
                v-model="filterNavigationOnly"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-xs"
              />
            </label>

            <!-- Pagination Controls -->
            <div class="join ml-2" v-if="totalRequestPages > 1">
              <button
                class="join-item btn btn-xs"
                @click="requestPage--"
                :disabled="requestPage <= 1"
              >
                «
              </button>
              <button class="join-item btn btn-xs no-animation cursor-default">
                Page {{ requestPage }} / {{ totalRequestPages }}
                <span class="opacity-50 ml-1"
                  >({{ filteredMatchedRequests.length }} items)</span
                >
              </button>
              <button
                class="join-item btn btn-xs"
                @click="requestPage++"
                :disabled="requestPage >= totalRequestPages"
              >
                »
              </button>
            </div>
            <div v-else class="text-xs opacity-50 ml-2">
              {{ filteredMatchedRequests.length }} items
            </div>

            <button
              @click="resetRequestFilters"
              class="btn btn-xs btn-ghost"
              v-if="filterIp || filterText || filterNavigationOnly"
            >
              Clear
            </button>
          </div>
        </template>

        <InfoTable zebra class="bg-base-200/10 rounded">
          <template #header>
            <tr>
              <th class="w-1/12">#</th>
              <th class="w-5/12">URL</th>
              <th class="w-1/12">Status</th>
              <th class="w-2/12">Remote / Country</th>
              <th class="w-1/12">Size</th>
              <th class="w-2/12">YARA / Payload</th>
            </tr>
          </template>
          <tr
            v-for="(item, idx) in paginatedRequests"
            :key="item.request?._id || item.response?._id"
          >
            <td>
              <router-link
                v-if="item.request"
                :to="
                  item.response
                    ? `/requests/${item.request._id}?responseId=${item.response._id}`
                    : `/requests/${item.request._id}`
                "
                class="btn btn-primary btn-sm font-mono"
                >{{ (requestPage - 1) * requestLimit + idx + 1 }}</router-link
              >
              <span v-else class="opacity-30 px-3">{{
                (requestPage - 1) * requestLimit + idx + 1
              }}</span>
            </td>
            <td class="max-w-md">
              <div class="flex flex-col gap-0.5">
                <div
                  class="text-sm break-all font-medium"
                  :class="{ 'text-primary': item.request?.isNavigationRequest }"
                >
                  {{ displayUrl(item.request?.url || item.response?.url, 200) }}
                </div>
                <div
                  v-if="item.request"
                  class="flex items-center gap-2 opacity-80 text-sm"
                >
                  <span>
                    {{ item.request.method }} {{ item.request.resourceType }}
                  </span>
                  <span
                    v-if="item.request?.failure?.errorText"
                    class="badge badge-error badge-sm text-white font-bold"
                    :title="item.request.failure.errorText"
                  >
                    {{ item.request.failure.errorText }}
                  </span>
                </div>
              </div>
            </td>
            <td>
              <router-link
                v-if="item.response?._id"
                :to="`/responses/${item.response._id}`"
                :class="getStatusClass(item.response.status)"
                class="badge badge-md text-white hover:opacity-80 transition-opacity"
                >{{ item.response.status }}</router-link
              >
            </td>
            <td class="text-sm opacity-70">
              <div v-if="item.response?.remoteAddress?.ip">
                {{ item.response.remoteAddress.ip }}
                <span
                  v-if="item.response?.remoteAddress?.geoip?.[0]?.country"
                  class="ml-1 opacity-60"
                >
                  ({{ item.response.remoteAddress.geoip[0].country }})
                </span>
              </div>
            </td>
            <td class="text-sm opacity-70">
              <span v-if="item.response?.text">
                {{ formatBytes(item.response.text.length) }}
              </span>
            </td>
            <td>
              <div class="flex flex-col gap-1">
                <div
                  v-if="item.response?.yara?.rules?.length"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="rule in item.response.yara.rules"
                    :key="rule.id"
                    class="badge badge-error badge-md text-white border-none"
                  >
                    {{ rule.id }}
                  </span>
                </div>
                <router-link
                  v-if="item.response?.payload"
                  :to="`/payloads/${item.response.payload._id || item.response.payload}`"
                  class="badge badge-warning badge-md text-white font-bold border-none"
                >
                  PAYLOAD
                </router-link>
              </div>
            </td>
          </tr>
        </InfoTable>
      </InfoCard>

      <!-- Body Section -->
      <BodyAnalysisCard
        v-if="webpage.content"
        id="contents"
        :content="webpage.content"
        :target-id="webpage._id"
        target-type="webpage"
        :saved-yara="webpage.yara"
        :ai-explanation="webpage.aiExplanation"
        :payloads="webpage.payloads"
        class="mb-12"
      />

      <FixedNav
        :targets="[
          { id: 'top', label: '↑', btnClass: 'btn-primary' },
          { id: 'requests', label: 'REQ', btnClass: 'btn-outline text-sm' },
          { id: 'contents', label: 'BODY', btnClass: 'btn-outline text-sm' },
          { id: 'bottom', label: '↓', btnClass: 'btn-ghost' },
        ]"
      />
    </div>
    <ScreenshotModal
      :visible="showScreenshotsModal"
      :screenshot-id="currentScreenshotId"
      @close="hideScreenshotsModal"
    />
  </div>
</template>

<script>
import BackBtn from '../components/back-btn.vue';
import InfoCard from '../components/info-card.vue';
import InfoTable from '../components/info-table.vue';
import FixedNav from '../components/fixed-nav.vue';
import ScreenshotModal from '../components/screenshot-modal.vue';
import BodyAnalysisCard from '../components/body-analysis-card.vue';
import NetworkSecurityCard from '../components/network-security-card.vue';
import { webpageApi, websiteApi } from '../api';
import { scrollToSection } from '../utils/scroll-utils';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';
import { md5Hash, sha256Hash } from '../utils/crypto-utils';
import { getMimeTypeEmoji } from '../utils/ui-utils';
import { downloadBlob } from '../utils/file-utils';
import { formatImageUrl, formatBytes } from '../utils/format-utils';

export default {
  name: 'WebpageDetail',
  components: {
    BackBtn,
    FixedNav,
    InfoCard,
    InfoTable,
    ScreenshotModal,
    BodyAnalysisCard,
    NetworkSecurityCard,
  },
  props: ['id'],
  data() {
    return {
      webpage: null,
      website: null,
      showScreenshotsModal: false,
      currentScreenshotId: null,
      scrollTarget: 'top',
      faviconHashes: {},
      isContentVisible: false,
      isUnmounted: false,
      // Request table states
      requestPage: 1,
      requestLimit: 100,
      filterIp: '',
      filterText: '',
      filterNavigationOnly: false,
    };
  },
  async created() {
    // fetchWebpage 内で fetchWebsite を呼ぶようにするか、
    // 直列 await を避けることで表示までのブロッキングを減らします
    this.fetchWebpage().then(() => {
      this.fetchWebsite();
    });
  },
  unmounted() {
    this.isUnmounted = true;
  },
  beforeRouteLeave(to, from, next) {
    // Save scroll position to sessionStorage before leaving
    const scrollY = window.scrollY;
    console.log('Saving scroll position:', scrollY);
    sessionStorage.setItem('webpageDetailScrollY', scrollY.toString());
    next();
  },
  computed: {
    matchedRequests() {
      if (!this.webpage?.requests && !this.webpage?.responses) return [];

      const matched = [];
      const usedResponses = new Set();

      // 1. まずrequestsとresponsesをマッチング
      if (this.webpage?.requests) {
        for (const request of this.webpage.requests) {
          let matchedResponse = null;

          // 1. interceptionIdで一致を確認
          if (request.interceptionId && this.webpage.responses) {
            matchedResponse = this.webpage.responses.find(
              (r) =>
                r.interceptionId === request.interceptionId &&
                !usedResponses.has(r._id),
            );
          }

          // 2. interceptionIdがない場合はURLで一致
          if (!matchedResponse && this.webpage.responses) {
            matchedResponse = this.webpage.responses.find(
              (r) => r.url === request.url && !usedResponses.has(r._id),
            );
          }

          if (matchedResponse) {
            usedResponses.add(matchedResponse._id);
          }

          matched.push({
            request,
            response: matchedResponse,
          });
        }
      }

      // 2. マッチしなかったresponsesを追加
      if (this.webpage?.responses) {
        for (const response of this.webpage.responses) {
          if (!usedResponses.has(response._id)) {
            matched.push({
              request: null,
              response,
            });
          }
        }
      }

      return matched;
    },
    filteredMatchedRequests() {
      const matched = this.matchedRequests;
      if (!this.filterIp && !this.filterText && !this.filterNavigationOnly)
        return matched;

      const ipLower = this.filterIp.toLowerCase();
      const textLower = this.filterText.toLowerCase();

      return matched.filter((item) => {
        const ip = item.response?.remoteAddress?.ip || '';
        const body = item.response?.text || '';
        const url = (
          item.request?.url ||
          item.response?.url ||
          ''
        ).toLowerCase();

        const matchesIp = !this.filterIp || ip.toLowerCase().includes(ipLower);
        const matchesText =
          !this.filterText ||
          body.toLowerCase().includes(textLower) ||
          url.includes(textLower);
        const matchesNavigation =
          !this.filterNavigationOnly || !!item.request?.isNavigationRequest;

        return matchesIp && matchesText && matchesNavigation;
      });
    },
    totalRequestPages() {
      return (
        Math.ceil(this.filteredMatchedRequests.length / this.requestLimit) || 1
      );
    },
    paginatedRequests() {
      const start = (this.requestPage - 1) * this.requestLimit;
      return this.filteredMatchedRequests.slice(
        start,
        start + this.requestLimit,
      );
    },
  },
  watch: {
    filteredMatchedRequests() {
      this.requestPage = 1; // フィルター変更時にページ番号をリセット
    },
    // webpageデータがロードされたらスクロール復元を試みる
    webpage: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.$nextTick(() => {
            const scrollY = parseInt(
              sessionStorage.getItem('webpageDetailScrollY') || '0',
            );
            if (scrollY > 100) {
              // 小さなスクロールなら即表示
              console.log('Restoring scroll position:', scrollY);
              setTimeout(() => {
                // コンポーネントがアンマウントされている場合は状態を更新しない（parentNodeエラー防止）
                if (this.isUnmounted) return;
                window.scrollTo(0, scrollY);
                sessionStorage.removeItem('webpageDetailScrollY');
                this.isContentVisible = true;
              }, 50);
            } else {
              this.isContentVisible = true;
            }
          });
        }
      },
    },
  },
  methods: {
    displayUrl,
    formatBytes,
    getMimeTypeEmoji,
    formatDate,
    getRelativeTime,
    scrollToSection(target) {
      scrollToSection(target);
    },
    resetRequestFilters() {
      this.filterIp = '';
      this.filterText = '';
      this.filterNavigationOnly = false;
      this.requestPage = 1;
    },
    async fetchWebpage() {
      try {
        console.log('Fetching webpage with ID:', this.id);
        this.webpage = await webpageApi.getWebpage(this.id);
        console.log('Webpage data received:', this.webpage);
        if (this.webpage.screenshots) {
          console.log(
            'Screenshots in webpage:',
            this.webpage.screenshots.map((ss) => ({
              _id: ss._id,
              full: ss.full,
            })),
          );
        }
        /*
        console.log('Fetched webpage data:', this.webpage);
        console.log('Screenshots array:', this.webpage.screenshots);
        console.log('Main screenshot:', this.webpage.screenshot);
        console.log('YARA data:', this.webpage.yara);
        */

        // Check if screenshots are properly populated
        if (this.webpage.screenshots?.length > 0) {
          console.log(
            'First screenshot full field:',
            this.webpage.screenshots[0].full,
          );
          //console.log('First screenshot full.screenshot:', this.webpage.screenshots[0].full?.screenshot);
        }

        // Compute favicon hashes
        if (this.webpage.favicon?.length > 0) {
          await this.computeFaviconHashes();
        }
      } catch (error) {
        console.error('Error fetching webpage:', error);
      }
    },
    async computeFaviconHashes() {
      for (let i = 0; i < this.webpage.favicon.length; i++) {
        const fav = this.webpage.favicon[i];
        if (fav.favicon) {
          this.faviconHashes[i] = {
            md5: md5Hash(fav.favicon),
            sha256: await sha256Hash(fav.favicon),
          };
        }
      }
    },
    async fetchWebsite() {
      try {
        if (!this.webpage?.input) return;
        console.log('Fetching website for URL:', this.webpage.input);
        try {
          const b64input = btoa(this.webpage.input)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          this.website = await websiteApi.getWebsiteByUrl(b64input);
          console.log('Website data received:', this.website);
        } catch (e) {
          console.log('No website found for this URL or error fetching', e);
          this.website = null;
        }
      } catch (error) {
        console.error('Error fetching website:', error);
        this.website = null;
      }
    },
    getThumbnailUrl(thumbnail) {
      return formatImageUrl(thumbnail);
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
    openScreenshotsModal(screenshotId) {
      console.log(
        'WebpageDetail openScreenshotsModal called with ID:',
        screenshotId,
      );

      // Debug: Check which screenshot object this ID belongs to
      const foundScreenshot = this.webpage.screenshots?.find(
        (ss) =>
          ss.full?._id?.toString() === screenshotId ||
          ss._id?.toString() === screenshotId,
      );

      if (foundScreenshot) {
        console.log('Found screenshot object:', {
          _id: foundScreenshot._id,
          full: foundScreenshot.full?._id,
          fullScreenshot: foundScreenshot.full?.screenshot
            ? 'present'
            : 'missing',
        });
      } else {
        console.warn('Screenshot object not found for ID:', screenshotId);
        console.log(
          'Available screenshots:',
          this.webpage.screenshots?.map((ss) => ({
            _id: ss._id,
            full: ss.full?._id,
          })),
        );
      }

      this.currentScreenshotId = screenshotId;
      this.showScreenshotsModal = true;
      console.log(
        'WebpageDetail showScreenshotsModal set to true, currentScreenshotId:',
        this.currentScreenshotId,
      );
    },
    hideScreenshotsModal() {
      this.showScreenshotsModal = false;
      this.currentScreenshotId = null;
    },
    async downloadHarFile() {
      if (!this.webpage?.harfile) {
        console.error('No HAR file available for download');
        return;
      }

      try {
        const response = await fetch(
          `/api/webpages/${this.webpage._id}/harfile`,
        );

        if (!response.ok) {
          throw new Error(
            `Failed to download HAR file: ${response.statusText}`,
          );
        }

        const blob = await response.blob();
        downloadBlob(blob, `${this.webpage._id}.har.zip`);

        console.log('HAR file downloaded successfully');
      } catch (error) {
        console.error('Error downloading HAR file:', error);
        // Could show user-friendly error message here
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
.card-bordered,
.mockup-code {
  border: 1px solid #eee;
  white-space: normal;
  word-break: break-all;
}

[data-theme='dark'] .card-bordered,
[data-theme='dark'] .mockup-code {
  border-color: rgba(255, 255, 255, 0.5);
}

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
