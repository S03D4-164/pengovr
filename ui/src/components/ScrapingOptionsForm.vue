<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
    <!-- Dynamically generated form fields -->
    <template v-for="optionDef in visibleOptions" :key="optionDef.key">
      <!-- Text/Number inputs -->
      <template v-if="optionDef.type === 'text' || optionDef.type === 'number'">
        <label class="inline-label" v-if="optionDef.type === 'text'">
          <span class="label-text">{{ optionDef.label }}</span>
          <input
            :value="options[optionDef.key]"
            @input="options[optionDef.key] = $event.target.value"
            :type="optionDef.type"
            :placeholder="optionDef.placeholder"
            class="input input-bordered w-full"
          />
        </label>
        <label class="inline-label" v-else-if="optionDef.type === 'number'">
          <span class="label-text">{{ optionDef.label }}</span>
          <input
            :value="options[optionDef.key]"
            @input="options[optionDef.key] = Number($event.target.value)"
            type="number"
            :min="optionDef.min"
            :max="optionDef.max"
            :step="optionDef.step"
            class="input input-bordered"
          />
        </label>
      </template>

      <!-- Select inputs -->
      <template v-else-if="optionDef.type === 'select'">
        <label class="inline-label">
          <span class="label-text">{{ optionDef.label }}</span>
          <select
            :value="options[optionDef.key]"
            @change="options[optionDef.key] = $event.target.value"
            class="select select-bordered font-mono w-full"
          >
            <option value="">-- Select --</option>
            <option
              v-for="opt in optionDef.options"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>
      </template>

      <!-- Checkbox inputs -->
      <template v-else-if="optionDef.type === 'checkbox'">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-2 p-1">
            <input
              type="checkbox"
              :checked="options[optionDef.key]"
              @change="options[optionDef.key] = $event.target.checked"
              class="checkbox checkbox-primary checkbox-sm"
            />
            <span class="label-text font-bold mr-3">{{ optionDef.label }}</span>
          </label>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { userAgentApi } from '../api';
import {
  SCRAPING_OPTIONS,
  type OptionDefinition,
} from '../config/scrapingOptions';

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits(['update:modelValue']);

const options = ref({ ...props.modelValue });
const scrapingOptionsConfig = ref<OptionDefinition[]>([...SCRAPING_OPTIONS]);

// Visible options (split into grid columns)
const visibleOptions = computed(() => scrapingOptionsConfig.value);

// Watch for changes and emit
const handleChange = () => {
  emit('update:modelValue', { ...options.value });
};

// Load user agents
const loadUserAgents = async () => {
  try {
    const response = await userAgentApi.getAllUserAgents();
    const userAgentOption = scrapingOptionsConfig.value.find(
      (opt) => opt.key === 'userAgent',
    );
    if (userAgentOption && response.results?.length) {
      userAgentOption.options = response.results.map((ua) => ({
        value: ua.userAgent,
        label: ua.name,
      }));
      if (!options.value.userAgent && response.results.length > 0) {
        options.value.userAgent = response.results[0].userAgent;
      }
    }
  } catch (err) {
    console.error('Failed to fetch user agents:', err);
  }
};

onMounted(loadUserAgents);

// Watch for external changes
import { watch } from 'vue';
watch(
  () => props.modelValue,
  (newVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(options.value)) {
      options.value = { ...newVal };
    }
  },
  { deep: true },
);

// Watch for internal changes
watch(options, handleChange, { deep: true });
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
