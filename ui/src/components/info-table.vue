<template>
  <div class="w-full overflow-hidden">
    <table
      class="table w-full"
      :class="[compact ? 'table-sm' : '', zebra ? 'table-zebra' : '']"
    >
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

<style scoped></style>
