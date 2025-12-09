<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  SearchOutlined, 
  PlusOutlined, 
  MoreOutlined,
  UserOutlined,
  TeamOutlined,
  KeyOutlined,
  CopyOutlined,
  CloseOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { 
  getStudentClassPage, 
  joinClass, 
  quitClass, 
  getClassMembers, 
  getStudentClassProblemPage 
} from '@/api/class'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const classList = ref<any[]>([])
const searchForm = reactive({
  name: ''
})

// Join Class
const joinVisible = ref(false)
const invitationCode = ref('')
const joinLoading = ref(false)

// Members
const memberVisible = ref(false)
const memberLoading = ref(false)
const memberList = ref([])
const memberTotal = ref(0)
const memberQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  name: '',
  classId: ''
})

// Problems
const problemVisible = ref(false)
const problemLoading = ref(false)
const problemList = ref([])
const problemTotal = ref(0)
const problemQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  name: '',
  classId: ''
})
const currentClassId = ref('')

onMounted(() => {
  getClassList()
})

const getClassList = async () => {
  loading.value = true
  try {
    const res = await getStudentClassPage({
      pageNo: 1,
      pageSize: 1000,
      name: searchForm.name,
      isAsc: false,
      sortBy: ''
    })
    if (res.data.code === 200) {
      classList.value = res.data.data?.records || []
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  getClassList()
}

const handleJoinClass = async () => {
  if (!invitationCode.value) {
    message.warning('请输入邀请码')
    return
  }
  joinLoading.value = true
  try {
    const res = await joinClass(invitationCode.value)
    if (res.data.code === 200) {
      message.success('加入班级成功')
      joinVisible.value = false
      invitationCode.value = ''
      getClassList()
    } else {
      message.error(res.data.msg || '加入班级失败')
    }
  } catch (error) {
    console.error(error)
  } finally {
    joinLoading.value = false
  }
}

const handleCopy = (code: string) => {
  navigator.clipboard.writeText(code).then(() => {
    message.success('复制成功')
  }).catch(() => {
    message.error('复制失败')
  })
}

const handleQuit = (classId: string) => {
  Modal.confirm({
    title: '确认退出',
    icon: () => h(ExclamationCircleOutlined),
    content: '确定要退出该班级吗？',
    onOk: async () => {
      try {
        const res = await quitClass(classId)
        if (res.data.code === 200) {
          message.success('退出成功')
          getClassList()
        }
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleEnterClass = (item: any) => {
  router.push({
    path: `/student/classDetail/${item.id}`,
    query: {
      name: item.name,
      teacherName: item.teacherName
    }
  })
}

// Members
const handleViewMembers = (classId: string) => {
  currentClassId.value = classId
  memberQuery.classId = classId
  memberVisible.value = true
  queryMembers()
}

const queryMembers = async () => {
  memberLoading.value = true
  try {
    const res = await getClassMembers(memberQuery)
    if (res.data.code === 200) {
      memberList.value = res.data.data?.records || []
      memberTotal.value = res.data.data?.total || 0
    }
  } catch (error) {
    console.error(error)
  } finally {
    memberLoading.value = false
  }
}

const handleMemberTableChange = (pagination: any) => {
  memberQuery.pageNo = pagination.current
  memberQuery.pageSize = pagination.pageSize
  queryMembers()
}

// Problems
const handleViewProblems = (classId: string) => {
  currentClassId.value = classId
  problemQuery.classId = classId
  problemVisible.value = true
  queryProblems()
}

const queryProblems = async () => {
  problemLoading.value = true
  try {
    const res = await getStudentClassProblemPage(problemQuery)
    if (res.data.code === 200) {
      problemList.value = res.data.data?.records || []
      problemTotal.value = res.data.data?.total || 0
    }
  } catch (error) {
    console.error(error)
  } finally {
    problemLoading.value = false
  }
}

const handleProblemTableChange = (pagination: any) => {
  problemQuery.pageNo = pagination.current
  problemQuery.pageSize = pagination.pageSize
  queryProblems()
}

const handleStartProblem = (problem: any) => {
  problemVisible.value = false
  router.push({
    path: '/code',
    query: {
      problemId: problem.id,
      classId: currentClassId.value,
      classProblemId: problem.classProblemId
    }
  })
}

const memberColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '积分', dataIndex: 'score', key: 'score' },
]

const problemColumns = [
  { title: '题目标题', dataIndex: 'title', key: 'title' },
  { title: '难度', dataIndex: 'grade', key: 'grade' },
  { title: '提交次数', dataIndex: 'submitCount', key: 'submitCount' },
  { title: '通过率', key: 'passRate' },
  { title: '操作', key: 'action' }
]

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
  <div class="my-class">
    <a-card :bordered="false" class="mb-4">
      <a-row justify="space-between" align="middle">
        <a-col>
          <a-input-search
            v-model:value="searchForm.name"
            placeholder="搜索班级"
            enter-button
            @search="handleSearch"
            style="width: 300px"
          />
        </a-col>
        <a-col>
          <a-button type="primary" @click="joinVisible = true">
            <template #icon><PlusOutlined /></template>
            加入班级
          </a-button>
        </a-col>
      </a-row>
    </a-card>

    <div v-if="!loading">
      <a-row :gutter="[24, 24]">
        <a-col :xs="24" :sm="12" :md="8" :lg="6" :xl="6" v-for="item in classList" :key="item.id">
          <a-card hoverable>
            <template #title>
              <span :title="item.name">{{ item.name }}</span>
            </template>
            <template #extra>
              <a-dropdown trigger="click">
                <a-button type="text" shape="circle">
                  <template #icon><MoreOutlined /></template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="1" @click="handleCopy(item.invitationCode)">
                      <CopyOutlined /> 复制邀请码
                    </a-menu-item>
                    <a-menu-item key="2" danger @click="handleQuit(item.id)">
                      <CloseOutlined /> 退出班级
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
            
            <a-card-meta>
              <template #avatar>
                <a-avatar :size="48" style="background-color: #1890ff">
                  <template #icon><UserOutlined /></template>
                </a-avatar>
              </template>
              <template #title>
                {{ item.teacherName }}
              </template>
              <template #description>
                创建于: {{ dayjs(item.createTime).format('YYYY-MM-DD') }}
              </template>
            </a-card-meta>

            <div class="mt-4">
              <a-space direction="vertical" style="width: 100%">
                <a-alert type="info" show-icon>
                  <template #message>
                    <a-space :size="16">
                      <span><TeamOutlined /> {{ item.joinNumber }} 人</span>
                      <span><KeyOutlined /> {{ item.invitationCode }}</span>
                    </a-space>
                  </template>
                </a-alert>
                <a-button type="primary" block @click="handleEnterClass(item)">
                  进入班级
                </a-button>
              </a-space>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-empty v-if="classList.length === 0" description="暂无班级" />
    </div>
    
    <div v-else class="loading-container">
      <a-spin size="large" />
    </div>

    <!-- Join Class Modal -->
    <a-modal
      v-model:open="joinVisible"
      title="加入班级"
      @ok="handleJoinClass"
      :confirmLoading="joinLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="邀请码" required>
          <a-input 
            v-model:value="invitationCode" 
            placeholder="请输入班级邀请码" 
            :maxlength="20"
            show-count
            allow-clear
          >
            <template #prefix><KeyOutlined /></template>
          </a-input>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Members Modal -->
    <a-modal
      v-model:open="memberVisible"
      title="班级成员"
      width="800px"
      :footer="null"
    >
      <div class="mb-4">
        <a-input-search
          v-model:value="memberQuery.name"
          placeholder="搜索学生"
          @search="queryMembers"
          style="width: 200px"
        />
      </div>
      <a-table
        :columns="memberColumns"
        :data-source="memberList"
        :pagination="{
          current: memberQuery.pageNo,
          pageSize: memberQuery.pageSize,
          total: memberTotal,
          showSizeChanger: true
        }"
        :loading="memberLoading"
        row-key="id"
        @change="handleMemberTableChange"
      />
    </a-modal>

    <!-- Problems Modal -->
    <a-modal
      v-model:open="problemVisible"
      title="班级题目"
      width="800px"
      :footer="null"
    >
      <div class="mb-4">
        <a-input-search
          v-model:value="problemQuery.name"
          placeholder="搜索题目"
          @search="queryProblems"
          style="width: 200px"
        />
      </div>
      <a-table
        :columns="problemColumns"
        :data-source="problemList"
        :pagination="{
          current: problemQuery.pageNo,
          pageSize: problemQuery.pageSize,
          total: problemTotal,
          showSizeChanger: true
        }"
        :loading="problemLoading"
        row-key="id"
        @change="handleProblemTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'grade'">
            <a-tag :color="getGradeColor(record.grade)">{{ getGradeText(record.grade) }}</a-tag>
          </template>
          <template v-if="column.key === 'passRate'">
            {{ record.passRate ? (record.passRate * 100).toFixed(1) + '%' : '0%' }}
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="primary" size="small" @click="handleStartProblem(record)">开始做题</a-button>
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.my-class {
  padding: 24px;
}

.loading-container {
  text-align: center;
  padding: 40px;
}

.mb-4 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 16px;
}
</style>
