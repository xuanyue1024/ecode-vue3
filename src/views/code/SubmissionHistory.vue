<template>
  <div class="submission-history">
    <div class="history-header">
      <h3>代码提交历史</h3>
      <a-tooltip title="刷新" placement="top">
        <a-button type="text" @click="fetchSubmissions">
          <template #icon><ReloadOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>
    
    <div v-if="loading" class="history-loading">
      <a-skeleton active :paragraph="{ rows: 5 }" />
    </div>
    
    <div v-else-if="submissions.length === 0" class="no-data">
      <FileOutlined style="font-size: 48px; margin-bottom: 16px; color: #DCDFE6;" />
      <p>暂无提交记录</p>
    </div>
    
    <div v-else class="table-wrapper">
      <a-table
        :data-source="submissions"
        :columns="columns"
        :pagination="false"
        row-key="id"
        :row-class-name="rowClassName"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'languageType'">
            <a-tag :color="getLanguageTagColor(record.languageType)">
              {{ record.languageType }}
            </a-tag>
          </template>
          <template v-if="column.key === 'passCount'">
            <div class="pass-count">
              <span :class="getPassCountClass(record.passCount)">
                {{ record.passCount }}/4
              </span>
            </div>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="viewCode(record)">
              查看代码
            </a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 代码查看对话框 -->
    <a-modal
      v-model:open="codeDialogVisible"
      title="提交代码详情"
      width="70%"
      class="code-dialog"
      @ok="useThisCode"
      ok-text="使用此代码"
      cancel-text="关闭"
    >
      <div v-if="selectedSubmission" class="code-detail-header">
        <div>
          <span class="detail-label">提交时间：</span>
          <span>{{ selectedSubmission.submitTime }}</span>
        </div>
        <div>
          <span class="detail-label">语言：</span>
          <a-tag :color="getLanguageTagColor(selectedSubmission.languageType)">
            {{ selectedSubmission.languageType }}
          </a-tag>
        </div>
        <div>
          <span class="detail-label">通过测试：</span>
          <span :class="getPassCountClass(selectedSubmission.passCount)">
            {{ selectedSubmission.passCount }}/4
          </span>
        </div>
      </div>
      <div ref="codeEditorRef" class="code-editor"></div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, FileOutlined } from '@ant-design/icons-vue'
import { getCodeSubmissions } from '@/api/code'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  classId: number | string
  classProblemId: number | string
  currentLanguage?: string
}>()

const emit = defineEmits(['use-code'])

const submissions = ref<any[]>([])
const loading = ref(false)
const codeDialogVisible = ref(false)
const selectedSubmission = ref<any>(null)
const codeEditorRef = ref<HTMLElement | null>(null)
let codeEditor: monaco.editor.IStandaloneCodeEditor | null = null

const columns = [
  {
    title: '提交时间',
    dataIndex: 'submitTime',
    key: 'submitTime',
    width: 150,
    ellipsis: true
  },
  {
    title: '语言',
    dataIndex: 'languageType',
    key: 'languageType',
    width: 80,
  },
  {
    title: '通过',
    dataIndex: 'passCount',
    key: 'passCount',
    width: 60,
    align: 'center'
  },
  {
    title: '操作',
    key: 'action',
    width: 90,
    align: 'center'
  },
]

const fetchSubmissions = async () => {
  loading.value = true
  try {
    const response = await getCodeSubmissions(Number(props.classId), Number(props.classProblemId))
    if (response.data.code === 200) {
      submissions.value = response.data.data
    } else {
      message.error(response.data.msg || '获取提交记录失败')
    }
  } catch (error) {
    console.error('获取提交记录失败:', error)
    message.error('获取提交记录失败')
  } finally {
    loading.value = false
  }
}

const getLanguageTagColor = (language: string) => {
  const languageMap: Record<string, string> = {
    'java': 'blue',
    'python3': 'green',
    'cpp': 'orange',
    'nodejs': 'cyan',
    'go': 'red'
  }
  return languageMap[language] || 'default'
}

const getPassCountClass = (count: number) => {
  if (count === 4) return 'text-success'
  if (count >= 2) return 'text-warning'
  return 'text-danger'
}

const rowClassName = (record: any) => {
  if (record.passCount === 4) {
    return 'success-row'
  }
  return ''
}

const viewCode = (submission: any) => {
  selectedSubmission.value = submission
  codeDialogVisible.value = true
  
  nextTick(() => {
    if (codeEditor) {
      codeEditor.dispose()
    }
    
    if (codeEditorRef.value) {
      codeEditor = monaco.editor.create(codeEditorRef.value, {
        value: submission.codeText,
        language: getMonacoLanguage(submission.languageType),
        theme: 'vs',
        readOnly: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 14
      })
    }
  })
}

const getMonacoLanguage = (language: string) => {
  const languageMap: Record<string, string> = {
    'java': 'java',
    'python3': 'python',
    'cpp': 'cpp',
    'nodejs': 'javascript',
    'go': 'go'
  }
  return languageMap[language] || language
}

const useThisCode = () => {
  if (selectedSubmission.value) {
    emit('use-code', {
      code: selectedSubmission.value.codeText,
      language: selectedSubmission.value.languageType
    })
    codeDialogVisible.value = false
    message.success('已加载选中的代码')
  }
}

onMounted(() => {
  fetchSubmissions()
})

watch(() => codeDialogVisible.value, (val) => {
  if (!val && codeEditor) {
    codeEditor.dispose()
    codeEditor = null
  }
})
</script>

<style scoped>
.submission-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 10px;
  text-align: left;
  flex-shrink: 0;
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.no-data {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #909399;
  font-size: 14px;
}

.history-loading {
  padding: 20px;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
}

.pass-count {
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-success {
  color: #67C23A;
  font-weight: 500;
}

.text-warning {
  color: #E6A23C;
  font-weight: 500;
}

.text-danger {
  color: #F56C6C;
  font-weight: 500;
}

.code-detail-header {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #EBEEF5;
}

.detail-label {
  font-weight: 500;
  margin-right: 8px;
  color: #606266;
}

.code-editor {
  height: 500px;
  border: 1px solid #EBEEF5;
  border-radius: 4px;
}

:deep(.success-row) {
  background-color: #f0f9eb;
}

:deep(.ant-table-row) {
  cursor: pointer;
}
</style>
