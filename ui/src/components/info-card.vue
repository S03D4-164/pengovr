<template>
  <div class="card bg-base-100 shadow-sm card-bordered">
    <div class="card-body p-4">
      <div
        v-if="title || $slots.actions"
        class="flex items-center justify-between mb-3 flex-wrap gap-2"
      >
        <h2 v-if="title" class="card-title opacity-70 uppercase tracking-wider text-sm font-bold">
          {{ title }}
        </h2>
        <div v-if="$slots.actions" class="flex gap-2 items-center">
          <slot name="actions"></slot>
        </div>
      </div>
      <div class="flex-1">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InfoCard',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
};
</script>
