<template>
  <div class="container mx-auto max-w-[1280px] p-4" v-if="payload">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">Payload Details</h1>
      <BackBtn />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- Metadata Card -->
      <div class="card bg-base-100 shadow-sm card-bordered">
        <div class="card-body">
          <h2 class="card-title text-sm opacity-70">Metadata</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <tbody>
                <tr>
                  <th class="text-base-content/50 w-1/3">ID</th>
                  <td class="font-mono text-sm break-all">{{ payload._id }}</td>
                </tr>
                <tr>
                  <th class="opacity-50">Raw JSON</th>
                  <td>
                    <a
                      :href="`/api/payloads/${payload._id}`"
                      target="_blank"
                      class="link link-primary text-sm font-mono"
                      >/api/payloads/{{ payload._id }}</a
                    >
                  </td>
                </tr>
                <tr>
                  <th class="opacity-50">MD5</th>
                  <td class="font-mono text-sm">{{ payload.md5 }}</td>
                </tr>
                <tr>
                  <th class="opacity-50">Size</th>
                  <td>{{ formatBytes(payload.payload?.length || 0) }}</td>
                </tr>
                <tr v-if="payload.fileType">
                  <th class="opacity-50">Type</th>
                  <td>
                    <span class="badge badge-ghost badge-sm">{{
                      payload.fileType
                    }}</span>
                  </td>
                </tr>
                <tr>
                  <th class="opacity-50">Created</th>
                  <td class="text-sm">{{ formatDate(payload.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-actions justify-end mt-4 gap-2">
            <button
              @click="downloadPayload"
              class="btn btn-error btn-sm text-white"
            >
              Download (PW: infected)
            </button>
          </div>
        </div>
      </div>

      <!-- YARA & Tags Card -->
      <div class="space-y-6">
        <div class="card bg-base-100 shadow-sm card-bordered">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h2 class="card-title text-sm opacity-70">Analysis & Tags</h2>
              <button
                @click="handleYaraScan"
                class="btn btn-accent btn-sm"
                :disabled="isScanning"
              >
                {{ isScanning ? 'Scanning...' : 'YARA Scan' }}
              </button>
            </div>

            <div v-if="yaraError" class="alert alert-error text-sm py-2 mb-4">
              {{ yaraError }}
            </div>

            <div
              v-if="payload.yara?.rules?.length"
              class="flex flex-wrap gap-1 mb-4"
            >
              <span
                v-for="rule in payload.yara.rules"
                :key="rule.id"
                class="badge badge-error badge-sm"
              >
                {{ rule.id }}
              </span>
            </div>

            <div v-if="yaraResults" class="mt-4 pt-4 border-t border-base-200">
              <h3 class="text-sm font-bold opacity-50 uppercase mb-2">
                Manual Scan Results
              </h3>
              <div
                v-if="yaraResults.length === 0"
                class="text-sm italic opacity-50"
              >
                No matches found.
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <span
                  v-for="match in yaraResults"
                  :key="match.id"
                  class="badge badge-accent badge-sm"
                >
                  {{ match.id }}
                </span>
              </div>
            </div>

            <div v-if="payload.tag?.length" class="space-y-2">
              <div
                v-for="(tag, index) in payload.tag"
                :key="index"
                class="mockup-code before:hidden px-4 py-0 text-sm overflow-hidden"
              >
                <pre
                  class="whitespace-pre-wrap break-all"
                ><code>{{ JSON.stringify(tag, null, 2) }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- QR Code Section -->
        <div class="card bg-base-100 shadow-sm card-bordered">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h2 class="card-title text-sm opacity-70">QR Code Decoder</h2>
              <button @click="handleDecodeQr" class="btn btn-primary btn-sm">
                Decode Image
              </button>
            </div>
            <div
              v-if="qrCodeError"
              class="alert alert-warning text-sm py-2 mb-4"
            >
              {{ qrCodeError }}
            </div>
            <div
              v-if="qrCodeData"
              class="mockup-code before:hidden px-4 py-2 text-sm bg-base-200"
            >
              <pre><code>Result: {{ qrCodeData.data }}</code></pre>
              <pre><code>Version: {{ qrCodeData.version }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
      <!-- Hex Dump Section -->
      <div
        class="lg:col-span-3 card bg-base-100 shadow-sm card-bordered"
        v-if="payload.payload"
      >
        <div class="card-body">
          <div class="flex items-center justify-between mb-4">
            <h2 class="card-title text-sm opacity-70">
              Hex Dump ({{ showFullHex ? 'Full' : 'First 256 bytes' }})
            </h2>
            <button
              @click="showFullHex = !showFullHex"
              class="btn btn-ghost btn-sm border-base-300"
            >
              {{ showFullHex ? 'Show Less' : 'Show Full' }}
            </button>
          </div>
          <div class="bg-base-200 rounded p-4 overflow-x-auto">
            <pre
              class="font-mono text-sm leading-relaxed"
            ><code>{{ hexDump(payload.payload) }}</code></pre>
          </div>
        </div>
      </div>

      <!-- VirusTotal Card -->
      <div class="lg:col-span-2 card bg-base-100 shadow-sm card-bordered">
        <div class="card-body p-4">
          <div class="flex items-center justify-between mb-2">
            <h2 class="card-title text-sm opacity-70">VirusTotal</h2>
            <button
              @click="queueVTSearch"
              :disabled="vtLoading"
              class="btn btn-info btn-sm text-white"
            >
              {{ vtLoading ? 'Searching...' : 'Search VT' }}
            </button>
          </div>
          <div v-if="vtMessage" class="alert alert-info py-2 text-sm mb-2">
            <span>{{ vtMessage }}</span>
          </div>
          <div
            class="mockup-code before:hidden px-4 py-2 text-sm max-h-[400px] overflow-y-auto bg-base-300"
          >
            <pre><code>{{ JSON.stringify(payload.vt || {}, null, 2) }}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 mb-10">
      <router-link
        :to="{ path: '/webpages', query: { payloadId: id } }"
        class="btn btn-info btn-sm text-white"
      >
        View Related Webpages
      </router-link>
      <router-link
        :to="{ path: '/responses', query: { payloadId: id } }"
        class="btn btn-info btn-sm text-white"
      >
        View Related Responses
      </router-link>
      <router-link
        :to="'/remove/payload/' + id"
        class="btn btn-error btn-sm text-white"
        >Delete Data</router-link
      >
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { scanContent, initYara } from '../utils/yara-utils';
import BackBtn from '../components/back-btn.vue';
import jsQR from 'jsqr';
import * as zip from '@zip.js/zip.js';
import { formatDate } from '../utils/date-utils';
import { formatBytes } from '../utils/format-utils';

export default {
  name: 'PayloadDetail',
  components: {
    BackBtn,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const route = useRoute();
    const payload = ref(null);
    const vtLoading = ref(false);
    const vtMessage = ref('');

    const yaraResults = ref(null);
    const yaraError = ref('');
    const isScanning = ref(false);

    const qrCodeData = ref(null);
    const qrCodeError = ref('');

    const handleYaraScan = async () => {
      if (!payload.value || !payload.value.payload) return;

      isScanning.value = true;
      yaraResults.value = null;
      yaraError.value = '';

      try {
        // Decode base64 to Uint8Array for binary scan
        const binaryString = atob(payload.value.payload);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        yaraResults.value = await scanContent(bytes);
      } catch (err) {
        console.error('YARA scan error:', err);
        yaraError.value = 'Scan failed: ' + (err.message || String(err));
      } finally {
        isScanning.value = false;
      }
    };

    const isImageFile = computed(() => {
      if (!payload.value || !payload.value.payload) return false;
      return payload.value.payload.includes('PNG');
    });

    const decodeQrCode = async () => {
      if (!payload.value || !payload.value.payload) return;

      qrCodeData.value = null;
      qrCodeError.value = '';

      try {
        const base64Data = payload.value.payload;
        const image = new Image();

        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src =
            'data:' +
            (payload.value.fileType || 'image/png') +
            ';base64,' +
            base64Data;
        });

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        console.log(code);
        if (code) {
          qrCodeData.value = {
            data: code.data,
            version: code.version,
            location: code.location,
          };
        } else {
          qrCodeError.value = 'No QR code found in image';
        }
      } catch (err) {
        qrCodeError.value = 'Failed to decode QR code: ' + err.message;
      }
    };

    const handleDecodeQr = () => {
      decodeQrCode();
    };

    const queueVTSearch = async () => {
      vtLoading.value = true;
      vtMessage.value = '';
      try {
        const response = await fetch(`/api/payloads/${props.id}/vt-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (response.ok) {
          vtMessage.value = 'VT search queued';
        } else {
          vtMessage.value = data.error || 'Failed to queue VT search';
        }
      } catch (err) {
        vtMessage.value = err.message || 'Failed to queue VT search';
      } finally {
        vtLoading.value = false;
      }
    };

    const loadPayload = async () => {
      try {
        const response = await fetch(`/api/payloads/${props.id}`);
        payload.value = await response.json();
      } catch (err) {
        console.error('Failed to load payload:', err);
      }
    };

    const decodePayload = (base64String) => {
      try {
        return atob(base64String);
      } catch (e) {
        return 'Invalid base64 data';
      }
    };

    const showFullHex = ref(false);

    const hexDump = (base64String, maxBytes = 256) => {
      try {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(
          showFullHex.value
            ? binaryString.length
            : Math.min(binaryString.length, maxBytes),
        );
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const lines = [];
        for (let i = 0; i < bytes.length; i += 16) {
          const chunk = bytes.slice(i, i + 16);
          const offset = i.toString(16).padStart(8, '0');
          const hexBytes = Array.from(chunk).map((b) =>
            b.toString(16).padStart(2, '0'),
          );
          const hexPairs = [];
          for (let j = 0; j < hexBytes.length; j += 2) {
            hexPairs.push(hexBytes[j] + (hexBytes[j + 1] || ''));
          }
          const hex = hexBytes.join(' ').padEnd(47, ' ');
          const ascii = Array.from(chunk)
            .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
            .join('');
          lines.push(`${offset}  ${hex}  |${ascii}|`);
        }

        if (!showFullHex.value && binaryString.length > maxBytes) {
          lines.push(`... (${binaryString.length - maxBytes} more bytes)`);
        }

        return lines.join('\n');
      } catch (e) {
        return 'Invalid base64 data';
      }
    };

    const downloadPayload = async () => {
      if (!payload.value || !payload.value.payload) return;

      try {
        const base64Data = payload.value.payload;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const zipWriter = new zip.ZipWriter(
          new zip.BlobWriter('application/zip'),
          {
            password: 'infected',
            encryptionStrength: 3,
          },
        );

        const fileName = `payload_${payload.value._id || 'download'}`;
        await zipWriter.add(fileName, new zip.BlobReader(new Blob([bytes])));
        const zipBlob = await zipWriter.close();

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}_password_infected.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to download payload:', err);
        alert('Failed to download payload: ' + err.message);
      }
    };

    onMounted(() => {
      loadPayload();
      initYara();
    });

    return {
      payload,
      formatBytes,
      formatDate,
      decodePayload,
      hexDump,
      showFullHex,
      vtLoading,
      vtMessage,
      yaraResults,
      yaraError,
      isScanning,
      handleYaraScan,
      queueVTSearch,
      isImageFile,
      qrCodeData,
      qrCodeError,
      handleDecodeQr,
      downloadPayload,
      id: props.id,
    };
  },
};
</script>

<style scoped>
.container {
  /* スクロールバーの領域を常に確保し、コンテンツの横揺れを防止 */
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}

/* テーブル、カード、コードブロックの枠線カスタマイズ */
.table th,
.table td,
.card-bordered,
.mockup-code {
  border: 1px solid #eee;
}

[data-theme='dark'] .table th,
[data-theme='dark'] .table td,
[data-theme='dark'] .card-bordered,
[data-theme='dark'] .mockup-code {
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
