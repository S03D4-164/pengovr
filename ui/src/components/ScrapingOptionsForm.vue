<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
    <div class="space-y-2">
      <label class="inline-label">
        <span class="label-text">UA</span>
        <select
          v-model="options.userAgent"
          :disabled="userAgentsLoading"
          class="select select-bordered select-sm w-full font-mono text-sm"
        >
          <option v-for="ua in userAgents" :key="ua._id" :value="ua.userAgent">
            {{ ua.name }}
          </option>
        </select>
      </label>

      <label class="inline-label">
        <span class="label-text">Lang</span>
        <select v-model="options.language" class="select select-bordered select-sm w-full">
          <option value="ja">ja</option>
          <option value="en">en</option>
          <option value="zh">zh</option>
        </select>
      </label>

      <label class="inline-label">
        <span class="label-text">Referrer</span>
        <input
          v-model="options.referrer"
          placeholder="https://..."
          class="input input-bordered input-sm w-full"
        />
      </label>

      <label class="inline-label">
        <span class="label-text">Proxy</span>
        <input
          v-model="options.proxy"
          placeholder="ip:port"
          class="input input-bordered input-sm w-full"
        />
      </label>

      <label class="inline-label">
        <span class="label-text">Timeout (s)</span>
        <input
          type="number"
          v-model.number="options.timeout"
          max="300"
          min="30"
          step="30"
          class="input input-bordered input-sm w-full"
        />
      </label>

      <label class="inline-label">
        <span class="label-text">Delay (s)</span>
        <input
          type="number"
          v-model.number="options.delay"
          max="60"
          min="0"
          step="5"
          class="input input-bordered input-sm w-full"
        />
      </label>
    </div>

    <div class="space-y-2">
      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-3 p-1">
          <input
            type="checkbox"
            v-model="options.disableScript"
            class="checkbox checkbox-primary checkbox-sm"
          />
          <span class="label-text font-bold">Disable Script</span>
        </label>
      </div>

      <div class="form-control">
        <span class="label-text font-bold mb-1">Actions</span>
        <textarea
          v-model="options.actions"
          rows="2"
          class="textarea textarea-bordered w-full font-mono text-sm"
          placeholder="click>#id"
        ></textarea>
      </div>

      <div class="form-control">
        <span class="label-text font-bold mb-1">Extra Headers</span>
        <textarea
          v-model="options.extraHeaders"
          rows="2"
          placeholder="Header: Value"
          class="textarea textarea-bordered w-full font-mono text-sm"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { userAgentApi } from '../api';

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits(['update:modelValue']);

const options = ref({ ...props.modelValue });
const userAgents = ref<any[]>([]);
const userAgentsLoading = ref(false);

watch(
  options,
  (newVal) => {
    // 親に通知
    emit('update:modelValue', { ...newVal });
  },
  { deep: true },
);

watch(
  () => props.modelValue,
  (newVal) => {
    // 無限ループ防止: 値が本当に違う時だけ同期する
    if (JSON.stringify(newVal) !== JSON.stringify(options.value)) {
      options.value = { ...newVal };
    }
  },
  { deep: true },
);

const fetchUserAgents = async () => {
  try {
    userAgentsLoading.value = true;
    const response = await userAgentApi.getAllUserAgents();
    userAgents.value = response.results;
    if (response.results.length > 0 && !options.value.userAgent) {
      options.value.userAgent = response.results[0].userAgent;
    }
  } catch (err) {
    console.error('Failed to fetch user agents:', err);
  } finally {
    userAgentsLoading.value = false;
  }
};

onMounted(fetchUserAgents);
</script>

<style scoped>
.inline-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline-label span {
  min-width: 80px;
  flex-shrink: 0;
  font-weight: bold;
  font-size: 0.875rem;
  opacity: 0.7;
}
</style>
