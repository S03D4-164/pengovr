<template>
  <section class="page-card">
    <div class="section-header">
      <div>
        <h2>タスク詳細</h2>
        <p>タスクの状態とスクレイピング結果を確認します。</p>
      </div>
      <button class="button secondary" @click="goBack">一覧に戻る</button>
    </div>

    <div v-if="loading" class="empty-state">
      読み込み中...
    </div>

    <div v-else-if="task">
      <div class="card-item">
        <h3>{{ task.url }}</h3>
        <div class="field-group">
          <div>
            <strong>タスクID</strong>
            <div>{{ task.id }}</div>
          </div>
          <div>
            <strong>ステータス</strong>
            <div>
              <span :class="['status-chip', task.status]">{{ statusLabel(task.status) }}</span>
            </div>
          </div>
          <div>
            <strong>作成日時</strong>
            <div>{{ formatDate(task.createdAt) }}</div>
          </div>
          <div>
            <strong>最終更新</strong>
            <div>{{ task.updatedAt ? formatDate(task.updatedAt) : '-' }}</div>
          </div>
          <div v-if="task.error">
            <strong>エラー</strong>
            <div>{{ task.error }}</div>
          </div>
        </div>
      </div>

      <div class="page-card">
        <h3>進捗</h3>
        <div class="field-group">
          <div>
            <strong>状態</strong>
            <div>{{ statusLabel(task.status) }}</div>
          </div>
          <div>
            <strong>結果件数</strong>
            <div>{{ task.results?.length || 0 }}</div>
          </div>
        </div>
      </div>

      <div v-if="task.results && task.results.length > 0" class="card-list">
        <div v-for="result in task.results" :key="result._id" class="card-item">
          <div class="section-header">
            <div>
              <h3>{{ result.title || 'タイトルなし' }}</h3>
              <p>{{ result.url }}</p>
            </div>
            <button class="button secondary" @click="viewResult(result._id)">
              結果を見る
            </button>
          </div>

          <div class="field-group">
            <div>
              <strong>ステータス</strong>
              <div>{{ result.response?.status || '-' }}</div>
            </div>
            <div>
              <strong>読み込み時間</strong>
              <div>{{ result.response?.loadTime ?? '-' }} ms</div>
            </div>
            <div>
              <strong>スクレイピング日時</strong>
              <div>{{ formatDate(result.scrapedAt || result.createdAt || '') }}</div>
            </div>
          </div>

          <div v-if="result.screenshot">
            <img
              class="screenshot-preview"
              :src="`data:image/png;base64,${result.screenshot}`"
              alt="screenshot"
            />
          </div>

          <div v-if="result.content">
            <strong>コンテンツプレビュー</strong>
            <pre>{{ result.content.substring(0, 300) }}...</pre>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        結果がまだありません。
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { taskApi } from '../api';
import type { TaskDetailResponse } from '../types';

const route = useRoute();
const router = useRouter();
const task = ref<TaskDetailResponse | null>(null);
const loading = ref(true);

const loadTask = async () => {
  const id = route.params.id as string;
  if (!id) return;
  loading.value = true;
  try {
    const response = await taskApi.getTask(id);
    task.value = response;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/tasks');
};

const viewResult = (resultId: string) => {
  router.push(`/result/${resultId}`);
};

const statusLabel = (status: string) => {
  return {
    pending: '待機中',
    processing: '処理中',
    completed: '完了',
    failed: '失敗'
  }[status] || '不明';
};

const formatDate = (value: string) => {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
};

onMounted(loadTask);
</script>
