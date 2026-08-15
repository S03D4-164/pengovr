<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <h1 class="text-3xl font-bold mb-4">User Agents</h1>

    <div class="card bg-base-100 shadow-sm card-bordered mb-4">
      <div class="card-body">
        <div class="flex justify-between items-center mb-2">
          <h2 class="card-title text-sm opacity-70">Add New User Agent</h2>
          <div class="flex gap-2">
            <button @click="handleExport" class="btn btn-sm btn-outline">
              Export JSON
            </button>
            <button @click="triggerImport" class="btn btn-sm btn-outline">
              Import JSON
            </button>
            <input
              type="file"
              ref="fileInput"
              class="hidden"
              accept=".json"
              @change="handleImport"
            />
          </div>
        </div>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="flex gap-2">
            <input
              v-model="newAgent.name"
              type="text"
              placeholder="Enter user agent name"
              class="input input-bordered w-full"
              required
            />
            <button type="submit" class="btn btn-primary px-8">Save</button>
          </div>
          <textarea
            v-model="newAgent.userAgent"
            class="textarea textarea-bordered w-full font-mono text-sm"
            rows="3"
            placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
            required
          ></textarea>
        </form>
      </div>
    </div>

    <div v-if="error" class="alert alert-warning mb-4">
      <span>{{ error }}</span>
    </div>

    <div class="overflow-x-auto bg-base-100 rounded-box shadow">
      <div
        class="flex items-center justify-between p-2 mb-2 gap-2"
        v-if="userAgents.length > 0"
      >
        <div class="text-base-content/70 text-sm">
          Total: {{ total }} user agents | Page {{ currentPage }} of
          {{ totalPages }}
        </div>
        <div class="join">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="join-item btn btn-sm"
          >
            Previous
          </button>
          <button
            v-for="page in displayedPages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'join-item btn btn-sm',
              page === currentPage ? 'btn-primary' : '',
            ]"
          >
            {{ page }}
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="join-item btn btn-sm"
          >
            Next
          </button>
        </div>
        <div class="flex items-center gap-2 text-sm text-base-content/70">
          <label class="whitespace-nowrap">Per page:</label>
          <select
            v-model="limit"
            @change="changeLimit(limit)"
            class="select select-bordered select-sm"
          >
            <option :value="10">10</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

      <table v-if="userAgents.length > 0" class="table table-zebra w-full">
        <thead>
          <tr>
            <th class="col-edit">Edit</th>
            <th class="col-name">Name</th>
            <th class="col-ua">User Agent String</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in userAgents" :key="agent._id">
            <td class="col-edit">
              <template v-if="editingAgent?._id === agent._id">
                <button
                  @click="handleUpdate"
                  class="btn btn-primary btn-sm"
                  :disabled="saving"
                >
                  {{ saving ? 'Saving...' : 'Save' }}
                </button>
                <button @click="cancelEdit" class="btn btn-ghost btn-sm">
                  Cancel
                </button>
              </template>
              <template v-else>
                <button
                  @click="startEdit(agent)"
                  class="btn btn-primary btn-sm"
                >
                  Edit
                </button>
                <button
                  @click="deleteAgent(agent._id)"
                  class="btn btn-error btn-sm text-white"
                >
                  Delete
                </button>
              </template>
            </td>
            <td class="col-name">
              <template v-if="editingAgent?._id === agent._id">
                <input
                  v-model="editingAgent.name"
                  type="text"
                  class="input input-bordered input-sm w-full"
                />
              </template>
              <template v-else>
                <span
                  class="link link-primary font-bold"
                  style="cursor: pointer"
                  @click="startEdit(agent)"
                  >{{ agent.name }}</span
                >
              </template>
            </td>
            <td class="col-ua">
              <template v-if="editingAgent?._id === agent._id">
                <textarea
                  v-model="editingAgent.userAgent"
                  class="textarea textarea-bordered w-full text-sm font-mono"
                  rows="3"
                ></textarea>
              </template>
              <template v-else>
                <div class="text-sm font-mono break-all">
                  {{ agent.userAgent }}
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { userAgentApi } from '../api';
import {
  getDisplayedPages,
  handlePageChange,
  handleLimitChange,
} from '../utils/pagination-utils';

interface UserAgent {
  _id: string;
  name: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

const userAgents = ref<UserAgent[]>([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const currentPage = ref(1);
const limit = ref(10);
const total = ref(0);
const totalPages = ref(1);
const newAgent = ref({
  name: '',
  userAgent: '',
});
const editingAgent = ref<UserAgent | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const fetchUserAgents = async () => {
  try {
    loading.value = true;
    const response = await userAgentApi.getUserAgents(
      currentPage.value,
      limit.value,
    );
    userAgents.value = response.results;
    total.value = response.total;
    totalPages.value = response.totalPages;
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch user agents';
  } finally {
    loading.value = false;
  }
};

const goToPage = (page: number) => {
  handlePageChange(page, totalPages.value, (newPage: number) => {
    currentPage.value = newPage;
    fetchUserAgents();
  });
};

const changeLimit = (newLimit: number) => {
  handleLimitChange(newLimit, (newLimitVal: number) => {
    limit.value = newLimitVal;
    currentPage.value = 1;
    fetchUserAgents();
  });
};

const handleSubmit = async () => {
  try {
    error.value = '';
    await userAgentApi.createUserAgent(
      newAgent.value.name,
      newAgent.value.userAgent,
    );
    newAgent.value = { name: '', userAgent: '' };
    currentPage.value = 1;
    await fetchUserAgents();
  } catch (err: any) {
    error.value = err.message || 'Failed to create user agent';
  }
};

const deleteAgent = async (id: string) => {
  if (!confirm('Are you sure you want to delete this user agent?')) return;

  try {
    error.value = '';
    await userAgentApi.deleteUserAgent(id);
    await fetchUserAgents();
  } catch (err: any) {
    error.value = err.message || 'Failed to delete user agent';
  }
};

const startEdit = (agent: UserAgent) => {
  editingAgent.value = { ...agent };
};

const cancelEdit = () => {
  editingAgent.value = null;
};

const handleUpdate = async () => {
  if (!editingAgent.value) return;

  try {
    saving.value = true;
    error.value = '';
    await userAgentApi.updateUserAgent(
      editingAgent.value._id,
      editingAgent.value.name,
      editingAgent.value.userAgent,
    );
    editingAgent.value = null;
    await fetchUserAgents();
  } catch (err: any) {
    error.value = err.message || 'Failed to update user agent';
  } finally {
    saving.value = false;
  }
};

const handleExport = async () => {
  try {
    // Fetch all for export (using a large limit)
    const response = await userAgentApi.getUserAgents(1, 1000);
    const dataToExport = response.results.map(
      ({ name, userAgent }: UserAgent) => ({
        name,
        userAgent,
      }),
    );

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user_agents_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    error.value = 'Failed to export: ' + err.message;
  }
};

const triggerImport = () => {
  fileInput.value?.click();
};

const handleImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const importedData = JSON.parse(content);

      if (!Array.isArray(importedData)) {
        throw new Error('Imported data must be an array');
      }

      loading.value = true;
      let successCount = 0;
      for (const item of importedData) {
        if (item.name && item.userAgent) {
          await userAgentApi.createUserAgent(item.name, item.userAgent);
          successCount++;
        }
      }

      alert(`Successfully imported ${successCount} user agents.`);
      currentPage.value = 1;
      await fetchUserAgents();
    } catch (err: any) {
      error.value = 'Import failed: ' + err.message;
    } finally {
      loading.value = false;
      target.value = ''; // Reset file input
    }
  };
  reader.readAsText(file);
};

const displayedPages = computed(() => {
  return getDisplayedPages(currentPage.value, totalPages.value);
});

onMounted(() => {
  fetchUserAgents();
});
</script>

<style scoped>
.container {
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}

/* テーブル全体の枠線とヘッダーのカスタマイズ */

.col-edit {
  width: 15%;
}
.col-name {
  width: 25%;
}
.col-ua {
  width: 60%;
}
</style>
