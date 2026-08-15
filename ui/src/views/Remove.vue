<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-3xl font-bold">Remove Related Data</h1>
      <BackBtn />
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="error" class="alert alert-error shadow-sm mb-6">
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
      <span>{{ error }}</span>
    </div>

    <div v-else>
      <div class="bg-base-200 p-4 rounded-box mb-8 border border-base-300">
        <h2 class="text-lg font-bold">
          Target:
          <span
            class="badge badge-outline badge-lg uppercase ml-2 brightness-75"
            >{{ targetType }}</span
          >
          <span class="font-mono text-sm ml-2 opacity-70">{{ targetId }}</span>
        </h2>
      </div>

      <!-- Main Target Deletion Option -->
      <div
        class="alert shadow-sm mb-8 flex items-center justify-between bg-warning/10 border-warning/20"
      >
        <div class="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6 text-warning"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 class="font-bold">Delete the {{ targetType }} itself</h3>
            <div class="text-sm">
              If checked, the main {{ targetType }} record will be permanently
              deleted after removing selected data.
            </div>
          </div>
        </div>
        <div class="flex-none">
          <input
            type="checkbox"
            v-model="removeTargetRecord"
            class="checkbox checkbox-warning"
          />
        </div>
      </div>

      <form @submit.prevent="handleRemove">
        <!-- Payloads Section -->
        <div v-if="payloads.length > 0" class="mb-10">
          <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span class="badge badge-primary">{{ payloads.length }}</span>
            Payloads
          </h3>
          <div
            class="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200"
          >
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th class="w-1/12 text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="allPayloadsSelected"
                      @change="toggleAllPayloads"
                    />
                  </th>
                  <th>Created</th>
                  <th>ID</th>
                  <th>MD5</th>
                  <th>Size</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="payload in payloads"
                  :key="payload._id"
                  class="hover"
                >
                  <td class="text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      v-model="selectedPayloads"
                      :value="payload._id"
                    />
                  </td>
                  <td class="text-sm opacity-70">
                    {{ formatDate(payload.createdAt) }}
                  </td>
                  <td>
                    <router-link
                      :to="'/payloads/' + payload._id"
                      class="link link-primary font-mono text-sm"
                      >{{ payload._id }}</router-link
                    >
                  </td>
                  <td class="font-mono text-sm opacity-70">
                    {{ payload.md5 }}
                  </td>
                  <td class="text-sm">{{ formatBytes(payload.size || 0) }}</td>
                  <td>
                    <span
                      v-if="payload.tag && payload.tag.length > 0"
                      class="badge badge-ghost badge-sm"
                      >{{ payload.tag.length }} tag(s)</span
                    >
                    <span v-else class="opacity-30 italic text-sm">N/A</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Responses Section -->
        <div v-if="responses.length > 0" class="mb-10">
          <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span class="badge badge-primary">{{ responses.length }}</span>
            Responses
          </h3>
          <div
            class="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200"
          >
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th class="w-1/12 text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="allResponsesSelected"
                      @change="toggleAllResponses"
                    />
                  </th>
                  <th>Created</th>
                  <th>ID</th>
                  <th>URL</th>
                  <th>Text Size</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="response in responses"
                  :key="response._id"
                  class="hover"
                >
                  <td class="text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      v-model="selectedResponses"
                      :value="response._id"
                    />
                  </td>
                  <td class="text-sm opacity-70">
                    {{ formatDate(response.createdAt) }}
                  </td>
                  <td>
                    <router-link
                      :to="'/responses/' + response._id"
                      class="link link-primary font-mono text-sm"
                      >{{ response._id }}</router-link
                    >
                  </td>
                  <td class="text-sm truncate max-w-md" :title="response.url">
                    {{ displayUrl(response.url) }}
                  </td>
                  <td class="text-sm">
                    {{ formatBytes(response.text?.length || 0) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Webpages Section -->
        <div v-if="webpages.length > 0" class="mb-10">
          <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span class="badge badge-primary">{{ webpages.length }}</span>
            Webpages
          </h3>
          <div
            class="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200"
          >
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th class="w-1/12 text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="allWebpagesSelected"
                      @change="toggleAllWebpages"
                    />
                  </th>
                  <th>Created</th>
                  <th>ID</th>
                  <th>URL</th>
                  <th>Content Length</th>
                  <th class="text-center">Thumbnail</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="webpage in webpages"
                  :key="webpage._id"
                  class="hover"
                >
                  <td class="text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      v-model="selectedWebpages"
                      :value="webpage._id"
                    />
                  </td>
                  <td class="text-sm opacity-70">
                    {{ formatDate(webpage.createdAt) }}
                  </td>
                  <td>
                    <router-link
                      :to="'/webpages/' + webpage._id"
                      class="link link-primary font-mono text-sm"
                      >{{ webpage._id }}</router-link
                    >
                  </td>
                  <td class="text-sm truncate max-w-md" :title="webpage.url">
                    {{ displayUrl(webpage.url) }}
                  </td>
                  <td class="text-sm">
                    {{ formatBytes(webpage.content?.length || 0) }}
                  </td>
                  <td class="text-center">
                    <img
                      v-if="webpage.thumbnail"
                      :src="getThumbnailUrl(webpage.thumbnail)"
                      class="h-12 w-20 object-cover rounded border border-base-300 mx-auto"
                      alt="thumb"
                    />
                    <span v-else class="opacity-30 italic text-sm">N/A</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Screenshots Section -->
        <div v-if="screenshots.length > 0" class="mb-10">
          <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span class="badge badge-primary">{{ screenshots.length }}</span>
            Screenshots
          </h3>
          <div
            class="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200"
          >
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th class="w-1/12 text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="allScreenshotsSelected"
                      @change="toggleAllScreenshots"
                    />
                  </th>
                  <th>Created</th>
                  <th>ID</th>
                  <th class="text-center">Preview</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="screenshot in screenshots"
                  :key="screenshot._id"
                  class="hover"
                >
                  <td class="text-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      v-model="selectedScreenshots"
                      :value="screenshot._id"
                    />
                  </td>
                  <td class="text-sm opacity-70">
                    {{ formatDate(screenshot.createdAt) }}
                  </td>
                  <td>
                    <router-link
                      :to="'/screenshots/' + screenshot._id"
                      class="link link-primary font-mono text-sm"
                      >{{ screenshot._id }}</router-link
                    >
                  </td>
                  <td class="text-center">
                    <img
                      v-if="screenshot.screenshot"
                      :src="getThumbnailUrl(screenshot.screenshot)"
                      class="h-16 w-32 object-cover rounded border border-base-300 mx-auto"
                      alt="preview"
                    />
                    <span v-else class="opacity-30 italic text-sm">N/A</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-if="noData"
          class="alert alert-ghost border border-base-300 italic mb-8"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-info shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>No related data found for this {{ targetType }}.</span>
        </div>

        <div class="flex flex-col gap-4 mb-16">
          <div
            class="flex items-center gap-4 p-4 bg-base-100 rounded-box border border-base-200 shadow-sm"
          >
            <button
              type="submit"
              class="btn btn-error text-white"
              :disabled="removing || !hasSelection"
            >
              <span v-if="removing" class="loading loading-spinner"></span>
              {{ removing ? 'Removing...' : 'Remove Selected' }}
            </button>
            <span class="text-sm opacity-60" v-if="hasSelection">
              Selected items will be permanently deleted.
            </span>
          </div>

          <div
            v-if="removeMessage"
            class="alert shadow-sm"
            :class="
              removeSuccess
                ? 'alert-success text-white font-bold'
                : 'alert-error text-white'
            "
          >
            <svg
              v-if="removeSuccess"
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <svg
              v-else
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
            <span>{{ removeMessage }}</span>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import BackBtn from '../components/back-btn.vue';
import { formatBytes, formatImageUrl } from '../utils/format-utils';
import { formatDate } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';

export default {
  name: 'Remove',
  components: {
    BackBtn,
  },
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => ['website', 'payload'].includes(value),
    },
    id: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      loading: true,
      error: null,
      targetType: this.type,
      targetId: this.id,
      payloads: [],
      responses: [],
      webpages: [],
      screenshots: [],
      selectedPayloads: [],
      selectedResponses: [],
      selectedWebpages: [],
      selectedScreenshots: [],
      removeTargetRecord: false,
      removing: false,
      removeMessage: '',
      removeSuccess: false,
    };
  },
  computed: {
    allPayloadsSelected() {
      return (
        this.payloads.length > 0 &&
        this.selectedPayloads.length === this.payloads.length
      );
    },
    allResponsesSelected() {
      return (
        this.responses.length > 0 &&
        this.selectedResponses.length === this.responses.length
      );
    },
    allWebpagesSelected() {
      return (
        this.webpages.length > 0 &&
        this.selectedWebpages.length === this.webpages.length
      );
    },
    allScreenshotsSelected() {
      return (
        this.screenshots.length > 0 &&
        this.selectedScreenshots.length === this.screenshots.length
      );
    },
    hasSelection() {
      return (
        this.selectedPayloads.length > 0 ||
        this.selectedResponses.length > 0 ||
        this.selectedWebpages.length > 0 ||
        this.selectedScreenshots.length > 0 ||
        this.removeTargetRecord
      );
    },
    noData() {
      return (
        this.payloads.length === 0 &&
        this.responses.length === 0 &&
        this.webpages.length === 0 &&
        this.screenshots.length === 0
      );
    },
  },
  async created() {
    await this.fetchRelatedData();
  },
  methods: {
    async fetchRelatedData() {
      this.loading = true;
      this.error = null;
      try {
        const url = `/api/remove/${this.targetType}/${this.targetId}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        this.payloads = data.payloads || [];
        this.responses = data.responses || [];
        this.webpages = data.webpages || [];
        this.screenshots = data.screenshots || [];

        // Default select all
        this.selectedPayloads = this.payloads.map((p) => p._id);
        this.selectedResponses = this.responses.map((r) => r._id);
        this.selectedWebpages = this.webpages.map((w) => w._id);
        this.selectedScreenshots = this.screenshots.map((s) => s._id);
      } catch (err) {
        this.error = `Failed to load related data: ${err.message}`;
        console.error(err);
      } finally {
        this.loading = false;
      }
    },
    toggleAllPayloads() {
      if (this.allPayloadsSelected) {
        this.selectedPayloads = [];
      } else {
        this.selectedPayloads = this.payloads.map((p) => p._id);
      }
    },
    toggleAllResponses() {
      if (this.allResponsesSelected) {
        this.selectedResponses = [];
      } else {
        this.selectedResponses = this.responses.map((r) => r._id);
      }
    },
    toggleAllWebpages() {
      if (this.allWebpagesSelected) {
        this.selectedWebpages = [];
      } else {
        this.selectedWebpages = this.webpages.map((w) => w._id);
      }
    },
    toggleAllScreenshots() {
      if (this.allScreenshotsSelected) {
        this.selectedScreenshots = [];
      } else {
        this.selectedScreenshots = this.screenshots.map((s) => s._id);
      }
    },
    async handleRemove() {
      this.removing = true;
      this.removeMessage = '';
      try {
        const response = await fetch(
          `/api/remove/${this.targetType}/${this.targetId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payloads: this.selectedPayloads,
              responses: this.selectedResponses,
              webpages: this.selectedWebpages,
              screenshots: this.selectedScreenshots,
              removeTarget: this.removeTargetRecord,
            }),
          },
        );
        const result = await response.json();
        if (response.ok) {
          this.removeSuccess = true;
          let msg = `Removed: ${result.removed?.payloads || 0} payloads, ${result.removed?.responses || 0} responses, ${result.removed?.webpages || 0} webpages, ${result.removed?.screenshots || 0} screenshots`;

          if (result.removed?.targetDeleted) {
            msg += ` and the ${this.targetType} record itself.`;
          }
          this.removeMessage = msg;

          if (this.removeTargetRecord) {
            this.removeMessage += ` Redirecting...`;
            setTimeout(() => {
              const redirectPath =
                this.targetType === 'website' ? '/websites' : '/payloads';
              this.$router.push(redirectPath);
            }, 2000);
            return;
          }

          // Refresh data
          await this.fetchRelatedData();
        } else {
          this.removeSuccess = false;
          this.removeMessage = result.error || 'Failed to remove';
        }
      } catch (err) {
        this.removeSuccess = false;
        this.removeMessage = err.message;
      } finally {
        this.removing = false;
      }
    },
    formatDate,
    formatBytes,
    displayUrl,
    getThumbnailUrl(thumbnail) {
      return formatImageUrl(thumbnail);
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
</style>
