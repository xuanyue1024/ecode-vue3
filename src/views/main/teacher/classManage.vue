<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  SearchOutlined, 
  ReloadOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  CopyOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { 
  getClassPage, 
  addClass, 
  updateClass, 
  deleteClasses 
} from '@/api/class'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()

// Search
const searchForm = reactive({
  pageNo: 1,
  pageSize: 10,
  name: ''
})

const loading = ref(false)
const classList = ref([])
const total = ref(0)
const selectedRowKeys = ref<string[]>([])

// Dialog
const modalVisible = ref(false)
const modalTitle = ref('')
const confirmLoading = ref(false)
const formRef = ref()
const classForm = reactive({
  id: '',
  name: ''
})

const rules = {
  name: [
    { required: true, message: '请输入班级名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ]
}

const columns = [
  {
    title: '班级名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '邀请码',
    dataIndex: 'invitationCode',
    key: 'invitationCode',
  },
  {
    title: '加入人数',
    dataIndex: 'joinNumber',
    key: 'joinNumber',
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    key: 'createTime',
    customRender: ({ text }: { text: string }) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : ''
  },
  {
    title: '操作',
    key: 'action',
    width: 250
  }
]

onMounted(() => {
  getClassList()
})

const getClassList = async () => {
  loading.value = true
  try {
    const res = await getClassPage({
      pageNo: searchForm.pageNo,
      pageSize: searchForm.pageSize,
      name: searchForm.name || '',
      isAsc: false,
      sortBy: ''
    })
    if (res.data.code === 200) {
      classList.value = res.data.data.records
      total.value = res.data.data.total
    } else {
      message.error(res.data.msg || '获取班级列表失败')
    }
  } catch (error) {
    console.error('获取班级列表错误:', error)
    message.error('获取班级列表失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.name = ''
  searchForm.pageNo = 1
  getClassList()
}

const onSelectChange = (keys: string[]) => {
  selectedRowKeys.value = keys
}

const handleAdd = () => {
  modalTitle.value = '新增班级'
  classForm.id = ''
  classForm.name = ''
  modalVisible.value = true
}

const handleEdit = (row: any) => {
  modalTitle.value = '编辑班级'
  classForm.id = row.id
  classForm.name = row.name
  modalVisible.value = true
}

const handleDelete = (row: any) => {
  Modal.confirm({
    title: '确认删除',
    icon: () => h(ExclamationCircleOutlined),
    content: '确认删除该班级吗？',
    onOk: async () => {
      try {
        const res = await deleteClasses([row.id])
        if (res.data.code === 200) {
          message.success('删除成功')
          getClassList()
        } else {
          message.error(res.data.msg || '删除失败')
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
    content: '确认删除选中的班级吗？',
    onOk: async () => {
      try {
        const res = await deleteClasses(selectedRowKeys.value)
        if (res.data.code === 200) {
          message.success('删除成功')
          selectedRowKeys.value = []
          getClassList()
        } else {
          message.error(res.data.msg || '删除失败')
        }
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleOk = async () => {
  try {
    await formRef.value.validate()
    confirmLoading.value = true
    if (classForm.id) {
      const res = await updateClass(classForm)
      if (res.data.code === 200) {
        message.success('修改成功')
        modalVisible.value = false
        getClassList()
      } else {
        message.error(res.data.msg || '修改失败')
      }
    } else {
      const res = await addClass(classForm.name)
      if (res.data.code === 200) {
        message.success('新增成功')
        modalVisible.value = false
        getClassList()
      } else {
        message.error(res.data.msg || '新增失败')
      }
    }
  } catch (error) {
    console.error('提交表单错误:', error)
  } finally {
    confirmLoading.value = false
  }
}

const copyInviteCode = (code: string) => {
  navigator.clipboard.writeText(code).then(() => {
    message.success('邀请码已复制')
  }).catch(() => {
    message.error('复制失败')
  })
}

const handleViewDetail = (row: any) => {
  router.push({
    path: `/teacher/classDetail/${row.id}`,
    query: {
      name: row.name,
      teacherName: userStore.username,
      activeTab: 'problems'
    }
  })
}

const handleTableChange = (pagination: any) => {
  searchForm.pageNo = pagination.current
  searchForm.pageSize = pagination.pageSize
  getClassList()
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
                placeholder="请输入班级名称" 
                allow-clear 
                @pressEnter="getClassList"
                style="width: 250px"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="getClassList" :loading="loading">
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
              新增班级
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
        :data-source="classList"
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
          <template v-if="column.key === 'invitationCode'">
            <a-space>
              <a-typography-text code>{{ record.invitationCode }}</a-typography-text>
              <a-tooltip title="复制邀请码">
                <a-button type="text" size="small" @click="copyInviteCode(record.invitationCode)">
                  <template #icon><CopyOutlined /></template>
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
          <template v-if="column.key === 'action'">
            <a-space divider type="vertical">
              <a-button type="link" size="small" @click="handleViewDetail(record)">查看详情</a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      @ok="handleOk"
      :confirmLoading="confirmLoading"
    >
      <a-form
        ref="formRef"
        :model="classForm"
        :rules="rules"
        layout="vertical"
      >
        <a-form-item label="班级名称" name="name">
          <a-input v-model:value="classForm.name" placeholder="请输入班级名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
/* Removed custom styles */
</style>
