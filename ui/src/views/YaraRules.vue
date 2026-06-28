<template>
  <div class="container mx-auto max-w-[1280px] p-4">
    <h1 class="text-3xl font-bold mb-6">YARA Rules</h1>

    <div class="card bg-base-100 shadow-sm card-bordered mb-4">
      <div class="card-body">
        <div class="flex justify-between items-center mb-2">
          <h2 class="card-title text-sm opacity-70">Add New YARA Rule</h2>
          <div class="flex gap-2">
            <button @click="handleExport" class="btn btn-sm btn-outline">Export JSON</button>
            <button @click="triggerImport" class="btn btn-sm btn-outline">Import JSON</button>
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
              v-model="newRule.name"
              type="text"
              placeholder="Enter rule name"
              class="input input-bordered w-full"
              required
            />
            <button type="submit" class="btn btn-primary px-8">Save</button>
          </div>
          <div class="flex flex-col lg:flex-row gap-4">
            <textarea
              v-model="newRule.rule"
              class="textarea textarea-bordered flex-[2] font-mono text-sm"
              rows="10"
              placeholder='rule ExampleRule {
  strings:
    $my_text_string = "text here"
    $my_hex_string = { E2 34 A1 C8 23 FB }
  condition:
    $my_text_string or $my_hex_string
}'
              required
            ></textarea>
            <textarea
              v-model="newRule.actions"
              class="textarea textarea-bordered flex-1 font-mono text-sm"
              rows="10"
              placeholder="Actions (optional):
click&gt;#selector
fill&gt;#input&gt;value
press&gt;#input&gt;Enter"
            ></textarea>
          </div>
        </form>
      </div>
    </div>

    <!-- Search Filter -->
    <div class="card bg-base-100 shadow-sm card-bordered mb-4">
      <div class="card-body p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <input
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            placeholder="Search by name or rule content..."
            class="input input-bordered input-sm flex-1"
          />
          <button @click="handleSearch" class="btn btn-primary btn-sm">Search</button>
          <button @click="clearSearch" v-if="searchQuery" class="btn btn-ghost btn-sm">
            Clear
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-4 text-sm p-4 rounded shadow-sm">
      <pre class="whitespace-pre-wrap font-mono">{{ error }}</pre>
    </div>

    <div class="overflow-x-auto bg-base-100 rounded-box shadow">
      <div class="flex items-center justify-between p-2 mb-2 gap-2" v-if="yaraRules.length > 0">
        <div class="text-base-content/70 text-sm">
          Total: {{ total }} rules | Page {{ currentPage }} of {{ totalPages }}
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
            :class="['join-item btn btn-sm', page === currentPage ? 'btn-primary' : '']"
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
          <label>Per page:</label>
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

      <table v-if="yaraRules.length > 0" class="table table-zebra w-full">
        <thead>
          <tr>
            <th class="col-date">Created At</th>
            <th class="col-rule">Rule</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in yaraRules" :key="rule._id">
            <td class="col-date">
              <div class="text-sm opacity-60 mb-2">{{ formatDate(rule.createdAt) }}</div>
              <template v-if="editingRule?._id === rule._id">
                <label class="label cursor-pointer justify-start gap-2 mb-2">
                  <input type="checkbox" v-model="editingRule.valid" class="checkbox checkbox-md" />
                  <span class="label-text">Valid</span>
                </label>
              </template>
              <template v-else>
                <div
                  class="badge badge-md mb-4"
                  :class="rule.valid ? 'badge-success' : 'badge-error text-white'"
                >
                  {{ rule.valid ? 'Valid' : 'Invalid' }}
                </div>
              </template>

              <div class="flex flex-col gap-2">
                <template v-if="editingRule?._id === rule._id">
                  <button @click="handleUpdate" class="btn btn-primary btn-sm" :disabled="saving">
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                  <button @click="cancelEdit" class="btn btn-ghost btn-sm">Cancel</button>
                </template>
                <template v-else>
                  <button @click="startEdit(rule)" class="btn btn-primary btn-sm">Edit</button>
                  <button @click="deleteRule(rule._id)" class="btn btn-error btn-sm text-white">
                    Delete
                  </button>
                </template>
              </div>
            </td>

            <td class="col-rule">
              <template v-if="editingRule?._id === rule._id">
                <input
                  v-model="editingRule.name"
                  type="text"
                  class="input input-bordered input-sm w-full mb-2"
                />
              </template>
              <template v-else>
                <div
                  class="link link-primary font-bold mb-2 block"
                  style="cursor: pointer"
                  @click="startEdit(rule)"
                >
                  {{ rule.name }}
                </div>
              </template>
              <template v-if="editingRule?._id === rule._id">
                <textarea
                  v-model="editingRule.rule"
                  class="textarea textarea-bordered w-full font-mono text-sm"
                  rows="6"
                ></textarea>
              </template>
              <template v-else>
                <div
                  class="bg-base-200 p-2 rounded font-mono text-sm break-all max-h-40 overflow-y-auto"
                >
                  {{ truncateRule(rule.rule) }}
                </div>
              </template>
            </td>
            <td class="col-actions">
              <template v-if="editingRule?._id === rule._id">
                <textarea
                  v-model="editingRule.actions"
                  class="textarea textarea-bordered w-full font-mono text-sm"
                  rows="4"
                  placeholder="Actions (optional):"
                ></textarea>
              </template>
              <template v-else>
                <div class="font-mono text-sm opacity-70 break-all">
                  {{ rule.actions || '-' }}
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { yaraApi } from '../api';
import { formatDate } from '../utils/date-utils';
import { validateRule } from '../utils/yara-utils';
import { getDisplayedPages, handlePageChange, handleLimitChange } from '../utils/pagination-utils';

const yaraRules = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const currentPage = ref(1);
const limit = ref(10);
const searchQuery = ref('');
const total = ref(0);
const totalPages = ref(1);
const newRule = ref({
  name: '',
  rule: '',
  actions: '',
  valid: true,
});
const editingRule = ref(null);
const fileInput = ref(null);

const fetchYaraRules = async () => {
  try {
    loading.value = true;
    const response = await yaraApi.getYaraRules(
      currentPage.value,
      limit.value,
      searchQuery.value.trim(),
    );
    yaraRules.value = response.results;
    total.value = response.total;
    totalPages.value = response.totalPages;
  } catch (err) {
    error.value = err.message || 'Failed to fetch YARA rules';
  } finally {
    loading.value = false;
  }
};

const goToPage = (page) => {
  handlePageChange(page, totalPages.value, (newPage) => {
    currentPage.value = newPage;
    fetchYaraRules();
  });
};

const changeLimit = (newLimit) => {
  handleLimitChange(newLimit, (newLimitVal) => {
    limit.value = newLimitVal;
    currentPage.value = 1;
    fetchYaraRules();
  });
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchYaraRules();
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1;
  fetchYaraRules();
};

const handleSubmit = async () => {
  try {
    error.value = '';

    // Validate YARA syntax before saving
    await validateRule(newRule.value.rule);

    await yaraApi.createYaraRule(
      newRule.value.name,
      newRule.value.rule,
      newRule.value.actions,
      newRule.value.valid,
    );
    newRule.value = { name: '', rule: '', actions: '', valid: true };
    currentPage.value = 1;
    await fetchYaraRules();
  } catch (err) {
    error.value = err.message || 'Failed to create YARA rule';
  }
};

const deleteRule = async (id) => {
  if (!confirm('Are you sure you want to delete this rule?')) return;

  try {
    error.value = '';
    await yaraApi.deleteYaraRule(id);
    await fetchYaraRules();
  } catch (err) {
    error.value = err.message || 'Failed to delete YARA rule';
  }
};

const startEdit = (rule) => {
  editingRule.value = { ...rule };
};

const cancelEdit = () => {
  editingRule.value = null;
};

const handleUpdate = async () => {
  if (!editingRule.value) return;

  try {
    saving.value = true;
    error.value = '';

    // Validate YARA syntax before updating
    await validateRule(editingRule.value.rule);

    await yaraApi.updateYaraRule(
      editingRule.value._id,
      editingRule.value.name,
      editingRule.value.rule,
      editingRule.value.actions,
      editingRule.value.valid,
    );
    editingRule.value = null;
    await fetchYaraRules();
  } catch (err) {
    error.value = err.message || 'Failed to update YARA rule';
  } finally {
    saving.value = false;
  }
};

const truncateRule = (rule) => {
  if (!rule) return '';
  if (rule.length > 200) {
    return rule.substring(0, 197) + '...';
  }
  return rule;
};

const handleExport = async () => {
  try {
    // Fetch all for export (using a large limit)
    const response = await yaraApi.getYaraRules(1, 1000);
    const dataToExport = response.results.map(({ name, rule, actions, valid }) => ({
      name,
      rule,
      actions,
      valid,
    }));

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yara_rules_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = 'Failed to export: ' + err.message;
  }
};

const triggerImport = () => {
  fileInput.value?.click();
};

const handleImport = async (event) => {
  const target = event.target;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result;
      const importedData = JSON.parse(content);

      if (!Array.isArray(importedData)) {
        throw new Error('Imported data must be an array');
      }

      loading.value = true;
      let successCount = 0;
      let skipCount = 0;
      for (const item of importedData) {
        if (item.name && item.rule) {
          try {
            await yaraApi.createYaraRule(item.name, item.rule, item.actions, item.valid);
            successCount++;
          } catch (err) {
            // 既存のルール名エラーの場合はスキップ
            if (err.message.includes('already exists')) {
              skipCount++;
              continue;
            }
            throw err; // それ以外のエラーは上位のcatchに投げる
          }
        }
      }
      alert(
        `Import completed: ${successCount} rules added, ${skipCount} rules skipped (already exists).`,
      );
      currentPage.value = 1;
      await fetchYaraRules();
    } catch (err) {
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
  fetchYaraRules();
});
</script>

<style scoped>
.container {
  scrollbar-gutter: stable;
  overflow-y: auto;
  min-height: 100vh;
}

/* テーブル全体の枠線とヘッダーのカスタマイズ */
.table th,
.table td,
.textarea,
.input {
  border: 1px solid #eee;
}

[data-theme='dark'] .table th,
[data-theme='dark'] .table td,
[data-theme='dark'] .textarea,
[data-theme='dark'] .input {
  border-color: rgba(255, 255, 255, 0.5);
}

.col-date {
  width: 20%;
}
.col-rule {
  width: 60%;
}
.col-actions {
  width: 20%;
}
</style>
