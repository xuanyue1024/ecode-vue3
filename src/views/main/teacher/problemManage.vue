<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  SearchOutlined, 
  ReloadOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { 
  getProblemPage, 
  deleteProblems 
} from '@/api/problem'
import { getTagsByIds } from '@/api/tag'
import dayjs from 'dayjs'

const router = useRouter()

const searchForm = reactive({
  pageNo: 1,
  pageSize: 10,
  name: ''
})

const loading = ref(false)
const problemList = ref<any[]>([])
const total = ref(0)
const selectedRowKeys = ref<string[]>([])
const selectedProblems = ref<any[]>([])

const columns = [
  {
    title: '题目标题',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: '难度',
    dataIndex: 'grade',
    key: 'grade',
    width: 100
  },
  {
    title: '标签',
    dataIndex: 'tags',
    key: 'tags',
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    key: 'createTime',
    width: 180,
    customRender: ({ text }: { text: string }) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : ''
  },
  {
    title: '操作',
    key: 'action',
    width: 150
  }
]

onMounted(() => {
  getProblemList()
})

const getProblemList = async () => {
  loading.value = true
  try {
    const res = await getProblemPage(searchForm)
    if (res.data.code === 200) {
      const problems = res.data.data.records
      total.value = res.data.data.total

      // Fetch tags for each problem
      const tagPromises = problems.map(async (problem: any) => {
        if (problem.tagIds && problem.tagIds.length > 0) {
          try {
            const tagRes = await getTagsByIds(problem.tagIds)
            if (tagRes.data.code === 200) {
              problem.tags = tagRes.data.data
            } else {
              problem.tags = []
            }
          } catch (error) {
            console.error('获取题目标签失败:', error)
            problem.tags = []
          }
        } else {
          problem.tags = []
        }
        return problem
      })

      problemList.value = await Promise.all(tagPromises)
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
    message.error('获取题目列表失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.name = ''
  searchForm.pageNo = 1
  getProblemList()
}

const onSelectChange = (keys: string[], rows: any[]) => {
  selectedRowKeys.value = keys
  selectedProblems.value = rows
}

const handleAdd = () => {
  router.push('/problemManage/add')
}

const handleEdit = (row: any) => {
  router.push(`/problemManage/edit/${row.id}`)
}

const handleDelete = (row: any) => {
  Modal.confirm({
    title: '确认删除',
    icon: () => h(ExclamationCircleOutlined),
    content: '确认删除该题目吗？',
    onOk: async () => {
      try {
        const res = await deleteProblems([row.id])
        if (res.data.code === 200) {
          message.success('删除成功')
          getProblemList()
        }
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleBatchDelete = () => {
  if (selectedRowKeys.value.length === 0) return
  Modal.confirm({
    title: '确认删除',
    icon: () => h(ExclamationCircleOutlined),
    content: '确认删除选中的题目吗？此操作不可恢复',
    onOk: async () => {
      try {
        const res = await deleteProblems(selectedRowKeys.value)
        if (res.data.code === 200) {
          message.success('删除成功')
          selectedRowKeys.value = []
          selectedProblems.value = []
          getProblemList()
        }
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleTableChange = (pagination: any) => {
  searchForm.pageNo = pagination.current
  searchForm.pageSize = pagination.pageSize
  getProblemList()
}

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'EASY': return 'success'
    case 'GENERAL': return 'warning'
    case 'DIFFICULT': return 'error'
    default: return 'default'
  }
}

const getGradeText = (grade: string) => {
  switch (grade) {
    case 'EASY': return '简单'
    case 'GENERAL': return '中等'
    case 'DIFFICULT': return '困难'
    default: return '未知'
  }
}
</script>

<template>
  <div style="padding: 24px">
    <a-card :bordered="false" style="margin-bottom: 24px">
      <a-row justify="space-between" align="middle">
        <a-col>
          <a-form layout="inline" :model="searchForm">
            <a-form-item>
              <a-input 
                v-model:value="searchForm.name" 
                placeholder="请输入题目名称" 
                allow-clear
                @pressEnter="getProblemList"
                style="width: 250px"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="getProblemList">
                  <template #icon><SearchOutlined /></template>
                  搜索
                </a-button>
                <a-button @click="resetSearch">
                  <template #icon><ReloadOutlined /></template>
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-col>
        <a-col>
          <a-space>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增题目
            </a-button>
            <a-button 
              danger 
              @click="handleBatchDelete" 
              :disabled="selectedRowKeys.length === 0"
            >
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
      <a-table
        :columns="columns"
        :data-source="problemList"
        :row-selection="{ selectedRowKeys: selectedRowKeys, onChange: onSelectChange }"
        :pagination="{
          current: searchForm.pageNo,
          pageSize: searchForm.pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'grade'">
            <a-tag :color="getGradeColor(record.grade)">
              {{ getGradeText(record.grade) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'tags'">
            <a-space size="small" wrap>
              <a-tag v-for="tag in record.tags" :key="tag.id">
                {{ tag.name }}
              </a-tag>
            </a-space>
          </template>
          <template v-if="column.key === 'action'">
            <a-space divider type="vertical">
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
/* Removed custom styles */
</style>
