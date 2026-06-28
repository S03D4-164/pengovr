<template>
  <div class="modal-wrapper">
    <div class="modal" :class="{ 'modal-open': isVisible }" @click="hideModal">
      <div class="modal-box w-11/12 max-w-7xl p-0 bg-transparent shadow-none">
        <div v-if="!isReady" class="flex justify-center items-center min-h-[200px]">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div
          v-else-if="error"
          class="bg-error text-error-content p-6 rounded-lg text-center font-bold"
        >
          {{ error }}
        </div>
        <div v-else-if="currentScreenshot" class="relative">
          <img
            :src="formatImageUrl(currentScreenshot.screenshot)"
            alt="Full Screenshot"
            class="w-full h-auto rounded-lg shadow-2xl cursor-default"
            @click.stop
          />
        </div>
        <div v-else class="bg-base-200 p-10 rounded-lg text-center italic opacity-50">
          No screenshot data found.
        </div>
      </div>
      <!-- 背景をクリックした時に閉じるためのバックドロップを内部に移動、またはラッパー内で管理 -->
      <div class="modal-backdrop bg-black/80 cursor-pointer"></div>
    </div>
  </div>
</template>

<script>
import { screenshotApi } from '../api';
import { formatImageUrl } from '../utils/format-utils';

export default {
  name: 'ScreenshotModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    screenshotId: {
      type: [String, Object],
      default: null,
    },
  },
  data() {
    return {
      currentScreenshot: null,
      currentScreenshotId: null,
      error: null,
      isReady: false,
    };
  },
  computed: {
    isVisible() {
      console.log(
        'isVisible computed:',
        this.visible,
        'isReady:',
        this.isReady,
        'currentScreenshot:',
        !!this.currentScreenshot,
        'error:',
        !!this.error,
      );
      return this.visible;
    },
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.loadScreenshot();
      } else if (!newVal) {
        // モーダルが閉じられたときに状態をリセット
        this.currentScreenshot = null;
        this.currentScreenshotId = null;
        this.error = null;
        this.isReady = false;
      }
    },
    screenshotId(newId) {
      if (this.visible && newId && newId !== this.currentScreenshotId) {
        this.loadScreenshot();
      }
    },
  },
  methods: {
    async loadScreenshot() {
      console.log('loadScreenshot called. screenshotId:', this.screenshotId);

      if (!this.screenshotId) {
        console.warn('No screenshotId provided to modal.');
        this.currentScreenshot = null;
        this.isReady = true;
        return;
      }

      this.error = null;
      this.currentScreenshotId = this.screenshotId;
      this.isReady = false;

      try {
        // ObjectIdオブジェクト、または{_id: ...}オブジェクト、または文字列に対応
        const targetId =
          typeof this.screenshotId === 'object'
            ? this.screenshotId._id || this.screenshotId.toString()
            : this.screenshotId;

        console.log('Fetching screenshot with ID:', targetId);
        const screenshot = await screenshotApi.getScreenshot(targetId);
        console.log('Received screenshot from API:', screenshot);
        this.currentScreenshot = screenshot;
      } catch (error) {
        console.error('Failed to load screenshot:', error);
        this.error = 'Failed to load screenshot';
        this.currentScreenshot = null;
      } finally {
        this.isReady = true;
      }
    },
    hideModal() {
      this.$emit('close');
    },
    formatImageUrl,
  },
};
</script>

<style scoped></style>
