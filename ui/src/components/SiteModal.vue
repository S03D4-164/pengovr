<template>
  <div class="modal" :class="{ 'modal-open': visible }">
    <div class="modal-box max-w-3xl">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-lg font-bold">Track Configuration</h3>
        <button @click="close" class="btn btn-sm btn-circle btn-ghost">✕</button>
      </div>

      <form @submit.prevent="saveSettings" class="space-y-4">
        <div class="form-control w-full">
          <label class="label p-1">
            <span class="label-text font-bold">URL</span>
          </label>
          <div class="bg-base-200 p-2 rounded text-xs break-all opacity-70">
            {{ websiteUrl }}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label p-1">
              <span class="label-text font-bold">Counter</span>
              <span class="label-text-alt opacity-60">0-72 tasks (0 = disabled)</span>
            </label>
            <div class="join w-full">
              <button
                type="button"
                @click="decrementCounter"
                :disabled="internalCounter <= 0"
                class="btn btn-outline btn-sm join-item"
              >
                -
              </button>
              <input
                v-model.number="internalCounter"
                type="number"
                class="input input-bordered input-sm join-item flex-1 text-center"
              />
              <button
                type="button"
                @click="incrementCounter"
                :disabled="internalCounter >= 72"
                class="btn btn-outline btn-sm join-item"
              >
                +
              </button>
            </div>
          </div>

          <div class="form-control w-full">
            <label class="label p-1">
              <span class="label-text font-bold">Period (hours)</span>
              <span class="label-text-alt opacity-60">Interval (1-24h)</span>
            </label>
            <div class="join w-full">
              <button
                type="button"
                @click="decrementPeriod"
                :disabled="internalPeriod <= 1"
                class="btn btn-outline btn-sm join-item"
              >
                -
              </button>
              <input
                v-model.number="internalPeriod"
                type="number"
                class="input input-bordered input-sm join-item flex-1 text-center"
              />
              <button
                type="button"
                @click="incrementPeriod"
                :disabled="internalPeriod >= 24"
                class="btn btn-outline btn-sm join-item"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div class="divider opacity-50 uppercase text-xs font-bold">Scraping Options</div>

        <ScrapingOptionsForm v-model="scrapingOptions" />

        <div class="modal-action">
          <div class="flex gap-2 w-full">
            <button type="submit" class="btn btn-primary btn-sm flex-1" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              Save Settings
            </button>
            <button type="button" @click="close" class="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-backdrop bg-black/60" @click="close"></div>
  </div>
</template>

<script>
import ScrapingOptionsForm from './ScrapingOptionsForm.vue';

export default {
  name: 'SiteModal',
  components: { ScrapingOptionsForm },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    websiteUrl: {
      type: String,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
    },
    period: {
      type: Number,
      default: 1,
    },
  },
  data() {
    return {
      saving: false,
      internalCounter: 0,
      internalPeriod: 0,
      scrapingOptions: {
        userAgent: '',
        language: 'ja',
        referrer: '',
        proxy: '',
        timeout: 30,
        delay: 5,
        disableScript: false,
        actions: '',
        extraHeaders: '',
      },
    };
  },
  watch: {
    counter(newVal) {
      this.internalCounter = newVal;
    },
    period(newVal) {
      this.internalPeriod = newVal;
    },
  },
  methods: {
    incrementCounter() {
      if (this.internalCounter < 72) {
        this.internalCounter++;
        this.$emit('update:counter', this.internalCounter);
      }
    },
    decrementCounter() {
      if (this.internalCounter > 0) {
        this.internalCounter--;
        this.$emit('update:counter', this.internalCounter);
      }
    },
    incrementPeriod() {
      if (this.internalPeriod < 24) {
        this.internalPeriod++;
        this.$emit('update:period', this.internalPeriod);
      }
    },
    decrementPeriod() {
      if (this.internalPeriod > 1) {
        this.internalPeriod--;
        this.$emit('update:period', this.internalPeriod);
      }
    },
    async saveSettings() {
      this.saving = true;
      try {
        this.$emit('save', {
          counter: this.internalCounter,
          period: this.internalPeriod,
          ...this.scrapingOptions,
        });
      } catch (error) {
        console.error('Error saving settings:', error);
      } finally {
        this.saving = false;
      }
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>
