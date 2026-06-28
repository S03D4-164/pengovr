<template>
  <button @click="goBack" class="btn btn-sm btn-outline gap-2">
    <span class="text-lg">«</span>
    Back
  </button>
</template>

<script>
export default {
  methods: {
    goBack() {
      this.$router.back();
    },
  },
};
</script>
