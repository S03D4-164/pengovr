<template>
  <div class="fixed bottom-10 right-10 flex flex-col gap-2 z-50">
    <a
      v-for="target in navTargets"
      :key="target.id"
      href="#"
      @click.prevent="scrollTo(target.id)"
      class="btn btn-sm shadow-lg"
      :class="target.btnClass"
    >
      {{ target.label }}
    </a>
  </div>
</template>

<script>
import { scrollToSection } from '../utils/scroll-utils';

export default {
  name: 'FixedNav',
  props: {
    targets: {
      type: Array,
      default: null,
    },
  },
  computed: {
    navTargets() {
      if (this.targets) return this.targets;
      return [
        { id: 'top', label: '↑', btnClass: 'btn-primary' },
        { id: 'bottom', label: '↓', btnClass: 'btn-secondary' },
      ];
    },
  },
  methods: {
    scrollTo(id) {
      scrollToSection(id);
    },
  },
};
</script>
