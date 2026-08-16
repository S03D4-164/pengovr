<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Request Information -->
    <InfoCard
      v-if="request"
      title="Request Information"
    >
      <InfoTable>
        <tr>
          <th class="w-1/4 opacity-60">ID</th>
          <td class="text-base">
            <router-link
              v-if="requestIdRouterLink"
              :to="requestIdRouterLink"
              class="link link-primary text-base"
            >
              {{ request._id }}
            </router-link>
            <template v-else>{{ request._id }}</template>
          </td>
        </tr>

        <tr v-if="showRequestRawJson">
          <th class="opacity-60">Raw JSON</th>
          <td>
            <a
              :href="`/api/requests/${request._id}`"
              target="_blank"
              class="link link-primary text-base"
              >/api/requests/{{ request._id }}</a
            >
          </td>
        </tr>

        <tr>
          <th class="opacity-60">URL</th>
          <td class="break-all text-base">{{ request.url }}</td>
        </tr>

        <tr>
          <th class="opacity-60">Method</th>
          <td>
            <span class="badge badge-ghost font-bold">{{ request.method }}</span>
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
          <td class="text-base">{{ request.resourceType }}</td>
        </tr>

        <tr>
          <th class="opacity-60">Navigation</th>
          <td>{{ request.isNavigationRequest ? 'Yes' : 'No' }}</td>
        </tr>

        <tr v-if="request.createdAt">
          <th class="opacity-60">Created</th>
          <td class="text-base">{{ formatDate(request.createdAt) }}</td>
        </tr>

        <tr v-if="request.interceptionId">
          <th class="opacity-60">Interception ID</th>
          <td class="text-base opacity-70">{{ request.interceptionId }}</td>
        </tr>

        <tr v-if="request.webpage">
          <th class="opacity-60">Webpage</th>
          <td>
            <router-link
              :to="`/webpages/${request.webpage._id}`"
              class="link link-primary text-base"
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
              class="link link-primary text-base"
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
    <InfoCard
      v-if="response"
      title="Response Information"
    >
      <InfoTable>
        <tr>
          <th class="w-1/4 opacity-60">ID</th>
          <td class="text-base">
            <router-link
              v-if="responseIdRouterLink"
              :to="responseIdRouterLink"
              class="link link-primary text-base"
            >
              {{ response._id }}
            </router-link>
            <template v-else class="font-mono text-sm opacity-70">
              {{ response._id }}
            </template>
          </td>
        </tr>

        <tr v-if="showResponseRawJson">
          <th class="opacity-60">Raw JSON</th>
          <td>
            <a
              :href="`/api/responses/${response._id}`"
              target="_blank"
              class="link link-primary text-base"
              >/api/responses/{{ response._id }}</a
            >
          </td>
        </tr>

        <tr>
          <th class="opacity-60">URL</th>
          <td class="break-all text-base">{{ response.url }}</td>
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

        <tr v-if="response.encoding">
          <th class="opacity-60">Encoding</th>
          <td class="text-sm">{{ response.encoding }}</td>
        </tr>

        <tr v-if="response.createdAt">
          <th class="opacity-60">Created</th>
          <td class="text-sm">{{ formatDate(response.createdAt) }}</td>
        </tr>

        <tr>
          <th class="opacity-60">Content Length</th>
          <td>{{ response.text?.length || 0 }} bytes</td>
        </tr>

        <tr v-if="response.interceptionId">
          <th class="opacity-60">Interception ID</th>
          <td class="text-base opacity-70">{{ response.interceptionId }}</td>
        </tr>

        <tr v-if="response.webpage">
          <th class="opacity-60">Webpage</th>
          <td>
            <router-link
              :to="`/webpages/${response.webpage._id}`"
              class="link link-primary text-base"
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
              class="link link-primary text-base"
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
              class="link link-primary text-base"
            >
              {{ response.payload._id || response.payload }}
            </router-link>
          </td>
        </tr>
      </InfoTable>
    </InfoCard>
  </div>
</template>

<script>
import InfoCard from './info-card.vue';
import InfoTable from './info-table.vue';
import { formatDate } from '../utils/date-utils';

export default {
  name: 'RequestResponseInfo',
  components: {
    InfoCard,
    InfoTable,
  },
  props: {
    request: {
      type: Object,
      default: null,
    },
    response: {
      type: Object,
      default: null,
    },
    // オプション: Request IDのリンク先を指定（指定されない場合はリンクなし）
    requestIdRouterLink: {
      type: String,
      default: null,
    },
    // オプション: Response IDのリンク先を指定（指定されない場合はリンクなし）
    responseIdRouterLink: {
      type: String,
      default: null,
    },
    // Request Raw JSONの表示有無
    showRequestRawJson: {
      type: Boolean,
      default: false,
    },
    // Response Raw JSONの表示有無
    showResponseRawJson: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    formatDate,
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
