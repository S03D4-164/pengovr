import { ref } from 'vue';

// Global store for created webpage IDs
const createdWebpageIds = ref<string[]>([]);

export const useWebpageStore = () => {
  const addWebpageId = (id: string) => {
    if (!createdWebpageIds.value.includes(id)) {
      createdWebpageIds.value.push(id);
    }
  };

  const getWebpageIds = () => {
    return createdWebpageIds.value;
  };

  const clearWebpageIds = () => {
    createdWebpageIds.value = [];
  };

  return {
    createdWebpageIds,
    addWebpageId,
    getWebpageIds,
    clearWebpageIds
  };
};
