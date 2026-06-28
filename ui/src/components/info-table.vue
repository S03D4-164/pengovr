<template>
  <div class="w-full overflow-hidden">
    <table class="table w-full" :class="[compact ? 'table-sm' : '', zebra ? 'table-zebra' : '']">
      <slot name="header"></slot>
      <tbody>
        <slot></slot>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'InfoTable',
  props: {
    compact: { type: Boolean, default: true },
    zebra: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.table :deep(th),
.table :deep(td) {
  border: 1px solid #eee;
  white-space: normal !important;
  word-break: break-all !important;
}

[data-theme='dark'] .table :deep(th),
[data-theme='dark'] .table :deep(td) {
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
