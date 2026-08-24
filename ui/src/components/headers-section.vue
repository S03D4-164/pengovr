<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <InfoCard
      v-if="requestHeaders && Object.keys(requestHeaders).length"
      title="Request Headers"
    >
      <InfoTable :compact="false">
        <tr v-for="(value, key) in requestHeaders" :key="`req-${key}`">
          <th class="opacity-70 w-1/3 text-sm uppercase">{{ key }}</th>
          <td class="break-all text-base">{{ value }}</td>
        </tr>
      </InfoTable>
    </InfoCard>

    <InfoCard
      v-if="responseHeaders && Object.keys(responseHeaders).length"
      title="Response Headers"
    >
      <InfoTable :compact="false">
        <tr v-for="(value, key) in responseHeaders" :key="`res-${key}`">
          <th class="opacity-70 w-1/3 text-sm uppercase">{{ key }}</th>
          <td class="break-all text-base">{{ value }}</td>
        </tr>
      </InfoTable>
    </InfoCard>
  </div>
</template>

<script>
import InfoCard from './info-card.vue';
import InfoTable from './info-table.vue';

export default {
  name: 'HeadersSection',
  components: {
    InfoCard,
    InfoTable,
  },
  props: {
    requestHeaders: {
      type: Object,
      default: () => ({}),
    },
    responseHeaders: {
      type: Object,
      default: () => ({}),
    },
  },
};
</script>
