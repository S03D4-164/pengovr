<template>
  <InfoCard :title="title" v-if="remoteAddress || securityDetails">
    <InfoTable>
      <tr v-if="remoteAddress?.ip">
        <th class="w-1/6 opacity-60">IP</th>
        <td class="text-sm">{{ remoteAddress.ip }}</td>
      </tr>
      <tr v-if="remoteAddress?.port">
        <th class="opacity-60">Port</th>
        <td>{{ remoteAddress.port }}</td>
      </tr>

      <!-- Security Details -->
      <template v-if="securityDetails">
        <tr>
          <th class="opacity-60">Issuer</th>
          <td class="text-sm">{{ securityDetails.issuer }}</td>
        </tr>
        <tr>
          <th class="opacity-60">Protocol</th>
          <td class="text-sm">{{ securityDetails.protocol }}</td>
        </tr>
        <tr v-if="securityDetails.subjectName">
          <th class="opacity-60">Subject</th>
          <td class="text-sm">{{ securityDetails.subjectName }}</td>
        </tr>
        <tr>
          <th class="opacity-60">Validity</th>
          <td class="text-sm leading-relaxed">
            {{ formatDate(securityDetails.validFrom) }}
            <span class="opacity-70 italic"
              >({{ getRelativeTime(securityDetails.validFrom) }})</span
            >
            to {{ formatDate(securityDetails.validTo) }}
            <span class="opacity-70 italic"
              >({{ getRelativeTime(securityDetails.validTo) }})</span
            >
          </td>
        </tr>
      </template>

      <!-- Network Details (Reverse DNS, BGP, GeoIP) -->
      <tr v-if="remoteAddress?.reverse?.length">
        <th class="opacity-60">Reverse DNS</th>
        <td class="text-sm font-mono">
          {{ remoteAddress.reverse.join(', ') }}
        </td>
      </tr>
      <tr v-if="remoteAddress?.bgp?.length">
        <th class="opacity-60">BGP</th>
        <td>
          <div
            v-for="(bgp, idx) in remoteAddress.bgp"
            :key="idx"
            class="text-sm mb-1"
          >
            <span>ASN {{ bgp.asn }}</span>
            <span v-if="bgp.name" class="opacity-80"> - {{ bgp.name }}</span>
            <span v-if="bgp.org" class="opacity-70 text-sm ml-1"
              >({{ bgp.org }})</span
            >
          </div>
        </td>
      </tr>
      <tr v-if="remoteAddress?.geoip?.length">
        <th class="opacity-70">GeoIP</th>
        <td>
          <div
            v-for="(geo, idx) in remoteAddress.geoip"
            :key="idx"
            class="text-sm"
          >
            {{ geo.country }}
            <span v-if="geo.country_long" class="opacity-70">
              - {{ geo.country_long }}</span
            >
            <span v-if="geo.continent_code" class="opacity-50 text-sm ml-1"
              >[{{ geo.continent_code }}]</span
            >
          </div>
        </td>
      </tr>

      <!-- DNS Details -->
      <tr v-if="remoteAddress?.dns">
        <th class="opacity-60">DNS Details</th>
        <td class="text-sm leading-relaxed">
          <div v-if="remoteAddress.dns.domain">
            <strong>Domain:</strong> {{ remoteAddress.dns.domain }}
          </div>
          <div v-if="remoteAddress.dns.records?.A?.length">
            <strong>A:</strong> {{ remoteAddress.dns.records.A.join(', ') }}
          </div>
          <div v-if="remoteAddress.dns.records?.AAAA?.length">
            <strong>AAAA:</strong>
            {{ remoteAddress.dns.records.AAAA.join(', ') }}
          </div>
          <div v-if="remoteAddress.dns.records?.MX?.length">
            <strong>MX:</strong>
            {{
              remoteAddress.dns.records.MX.map((m) =>
                typeof m === 'string' ? m : `${m.exchange} (${m.priority})`,
              ).join(', ')
            }}
          </div>
          <div v-if="remoteAddress.dns.records?.NS?.length">
            <strong>NS:</strong> {{ remoteAddress.dns.records.NS.join(', ') }}
          </div>
          <div v-if="remoteAddress.dns.records?.TXT?.length">
            <strong>TXT:</strong> {{ remoteAddress.dns.records.TXT.join(', ') }}
          </div>
          <div v-if="remoteAddress.dns.records?.CNAME">
            <strong>CNAME:</strong> {{ remoteAddress.dns.records.CNAME }}
          </div>
          <div v-if="remoteAddress.dns.lookupTime">
            <strong>Lookup Time:</strong> {{ remoteAddress.dns.lookupTime }}ms
          </div>
          <div
            v-if="remoteAddress.dns.errors?.length"
            class="text-error font-bold"
          >
            <strong>Errors:</strong> {{ remoteAddress.dns.errors.join(', ') }}
          </div>
        </td>
      </tr>
    </InfoTable>

    <!-- Technologies -->
    <div v-if="technologies?.length" class="mt-6 pt-4 border-t border-base-300">
      <h4 class="text-sm font-bold opacity-50 uppercase mb-2">Technologies</h4>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="tech in technologies"
          :key="tech"
          class="badge badge-outline badge-md"
        >
          {{ tech }}
        </span>
      </div>
    </div>
  </InfoCard>
</template>

<script>
import InfoCard from './info-card.vue';
import InfoTable from './info-table.vue';
import { formatDate, getRelativeTime } from '../utils/date-utils';

export default {
  name: 'NetworkSecurityCard',
  components: { InfoCard, InfoTable },
  props: {
    title: { type: String, default: 'Remote Address & Security' },
    remoteAddress: { type: Object, default: null },
    securityDetails: { type: Object, default: null },
    technologies: { type: Array, default: () => [] },
  },
  methods: { formatDate, getRelativeTime },
};
</script>
