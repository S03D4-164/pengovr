<template>
  <div class="overflow-x-auto">
    <table class="table w-full min-w-[900px]">
      <thead>
        <tr>
          <th class="w-2/5">Webpage</th>
          <th class="w-2/5">Result</th>
          <th class="w-1/5">Preview</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="webpage in webpages" :key="webpage._id" class="hover">
          <td>
            <div class="flex flex-col gap-1">
              <div class="flex items-baseline gap-2 flex-wrap">
                <router-link
                  :to="`/webpages/${webpage._id}`"
                  class="link link-primary text-sm font-mono"
                  >ID: {{ webpage._id }}</router-link
                >
                <div class="text-sm opacity-60">
                  {{ getRelativeTime(webpage.createdAt) }}
                  <span class="opacity-50 ml-1"
                    >({{ formatDate(webpage.createdAt) }})</span
                  >
                  <span v-if="webpage.relatedDate" class="opacity-70 ml-1">
                    / Rel: {{ getRelativeTime(webpage.relatedDate) }}
                    <span class="opacity-50 ml-1"
                      >({{ formatDate(webpage.relatedDate) }})</span
                    >
                  </span>
                </div>
              </div>
              <div
                class="text-sm break-all opacity-80 mt-1"
                :title="webpage.input"
              >
                {{ displayUrl(webpage.input) }}
              </div>
              <div
                v-if="webpage.option"
                class="mt-2 overflow-hidden rounded border border-base-300 bg-base-200/30"
              >
                <table class="table table-sm w-full bg-transparent">
                  <tbody class="border-none">
                    <template v-for="(value, key) in webpage.option" :key="key">
                      <tr v-if="value" class="border-none">
                        <td
                          class="py-0.5 px-2 font-bold opacity-50 text-sm w-32 align-top uppercase border-none"
                        >
                          {{ key }}:
                        </td>
                        <td
                          class="py-0.5 px-2 text-sm break-all font-mono border-none leading-tight"
                        >
                          {{ value }}
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </td>
          <td>
            <div
              v-if="webpage.error"
              class="bg-error text-white text-sm font-bold px-2 py-1.5 rounded mb-3 break-all shadow-sm"
            >
              {{ webpage.error }}
            </div>
            <div class="text-base font-bold truncate max-w-md">
              {{ webpage.title || 'N/A' }}
            </div>
            <div class="flex flex-col gap-0.5 mb-2 mt-1">
              <div
                class="text-sm break-all"
                :class="
                  webpage.url && webpage.url !== webpage.input
                    ? 'text-warning font-semibold opacity-100'
                    : 'opacity-70'
                "
                :title="webpage.url"
              >
                {{ displayUrl(webpage.url) }}
              </div>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span :class="getStatusClass(webpage.status)">{{
                webpage.status || '???'
              }}</span>
              <span class="text-sm opacity-50">|</span>
              <span class="text-sm text-primary font-medium"
                >Req:
                {{
                  webpage.requestCount || webpage.requests?.length || 0
                }}</span
              >
              <span class="text-sm text-success font-medium"
                >Res:
                {{
                  webpage.responseCount || webpage.responses?.length || 0
                }}</span
              >
            </div>
            <div
              v-if="webpage.remoteAddress?.ip"
              class="text-sm opacity-70 font-mono mt-1"
            >
              IP: {{ webpage.remoteAddress.ip }}
              <span
                v-if="webpage.remoteAddress.geoip?.[0]?.country"
                class="opacity-60"
              >
                ({{ webpage.remoteAddress.geoip[0].country }})
              </span>
            </div>
            <div v-if="webpage.securityDetails" class="text-sm opacity-60 mt-1">
              🔒 {{ webpage.securityDetails.issuer }} ({{
                getRelativeTime(webpage.securityDetails.validFrom)
              }})
            </div>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span
                v-for="tech in webpage.wappalyzer"
                :key="tech"
                class="badge badge-outline badge-md"
                >{{ tech }}</span
              >
              <span
                v-for="rule in webpage.yara?.rules"
                :key="rule.id"
                class="badge badge-error badge-md text-white border-none"
                >{{ rule.id }}</span
              >
            </div>
          </td>
          <td class="text-center">
            <div
              v-if="webpage.thumbnail"
              @click="$emit('show-screenshot', webpage)"
              class="cursor-pointer block"
            >
              <img
                :src="getThumbnailUrl(webpage.thumbnail)"
                class="max-w-full max-h-32 rounded border border-base-300 shadow-sm mx-auto"
                alt="Thumbnail"
              />
            </div>
            <div v-else class="text-sm opacity-30 italic">No image</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { displayUrl } from '../utils/url-utils';
import { formatImageUrl } from '../utils/format-utils';

defineProps<{
  webpages: any[];
}>();

defineEmits(['show-screenshot']);

const getStatusClass = (status: number) => {
  const base = 'badge badge-md font-bold ';
  if (status >= 200 && status < 300) return base + 'badge-success text-white';
  if (status >= 300 && status < 400) return base + 'badge-warning';
  if (status >= 400 && status < 500) return base + 'badge-error text-white';
  if (status >= 500) return base + 'badge-error text-white';
  return base + 'badge-ghost';
};

const getThumbnailUrl = (thumbnail: string) => formatImageUrl(thumbnail);
</script>

<style scoped>
.table th,
.table td {
  border: 1px solid #eee;
  white-space: normal;
  word-break: break-all;
}
[data-theme='dark'] .table th,
[data-theme='dark'] .table td {
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
