<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  MenuOutlined,
  TeamOutlined,
  ReadOutlined,
  TrophyOutlined,
  FilePdfOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import * as echarts from 'echarts'
import { 
  getTeacherClassMembers, 
  getClassProblemPage, 
  addProblemToClass, 
  removeProblemFromClass, 
  getTeacherClassProblemInfo, 
  getClassProblemPassRate, 
  getClassStudentRank, 
  getTeacherClassProblemDifficultyNum, 
  getTeacherClassProblemTagNum 
} from '@/api/class'
import { getProblemPage } from '@/api/problem'
import { getTagsByIds } from '@/api/tag'
import { checkPdfExists, uploadPdf, deletePdf } from '@/api/ai'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import ClassDetailLayout from '@/layout/ClassDetailLayout.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = ref(['overview'])
const classInfo = reactive({
  id: '',
  name: '',
  joinNumber: 0,
  problemCount: 0
})
const averageScore = ref(0)

// Charts refs
const difficultyChartRef = ref()
const tagChartRef = ref()
const passRateChartRef = ref()
const studentRankChartRef = ref()

// Members
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
const problemLoading = ref(false)
const problemList = ref([])
const problemTotal = ref(0)
const selectedProblems = ref<any[]>([])
const selectedRowKeys = ref<string[]>([])
const problemQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  name: '',
  classId: ''
})

// Add Problem
const addProblemVisible = ref(false)
const addProblemLoading = ref(false)
const availableProblems = ref([])
const addProblemTotal = ref(0)
const selectedProblemsToAdd = ref<string[]>([])
const addProblemQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  name: ''
})

// Student Detail
const studentDetailVisible = ref(false)
const studentDetailLoading = ref(false)
const studentProblemList = ref([])

// Rank
const problemRankList = ref([])
const studentRankList = ref([])

// PDF
const pdfLoading = ref(false)
const hasPdf = ref(false)
const pdfUrl = ref('')
const uploadVisible = ref(false)
const fileList = ref<any[]>([])

onMounted(() => {
  classInfo.id = route.params.id as string
  classInfo.name = route.query.name as string || ''
  memberQuery.classId = classInfo.id
  problemQuery.classId = classInfo.id
  
  const activeTab = route.query.activeTab as string
  if (activeTab) {
    activeMenu.value = [activeTab]
  }

  initData()
  
  if (activeMenu.value[0] === 'overview') {
    loadCharts()
  }
})

watch(activeMenu, (newVal) => {
  if (newVal[0] === 'overview') {
    setTimeout(() => loadCharts(), 100)
  } else if (newVal[0] === 'problemRank') {
    setTimeout(() => loadRankCharts(), 100)
  } else if (newVal[0] === 'knowledgeBase') {
    checkPdfExistence()
  }
})

const initData = () => {
  queryMembers()
  queryProblems()
}

const loadCharts = async () => {
  await loadDifficultyDistribution()
  await loadTagDistribution()
}

const loadRankCharts = async () => {
  await loadProblemPassRateData()
  await loadStudentRankData()
}

// Members
const queryMembers = async () => {
  memberLoading.value = true
  try {
    const res = await getTeacherClassMembers(memberQuery)
    if (res.data.code === 200) {
      memberList.value = res.data.data.records
      memberTotal.value = res.data.data.total
      classInfo.joinNumber = res.data.data.total
      
      if (memberList.value.length > 0) {
        const totalScore = memberList.value.reduce((sum: number, member: any) => sum + member.totalScore, 0)
        averageScore.value = Math.round(totalScore / memberList.value.length)
      }
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

const calculateProgress = (member: any) => {
  const maxScore = classInfo.problemCount * 4
  if (!maxScore) return 0
  return Math.round((member.totalScore / maxScore) * 100)
}

const handleViewStudentDetail = async (student: any) => {
  studentDetailVisible.value = true
  studentDetailLoading.value = true
  try {
    const promises = problemList.value.map(async (problem: any) => {
      try {
        const res = await getTeacherClassProblemInfo(problem.classProblemId, student.id)
        if (res.data.code === 200) {
          return { ...problem, ...res.data.data }
        }
        return problem
      } catch (error) {
        return problem
      }
    })
    studentProblemList.value = await Promise.all(promises)
  } catch (error) {
    console.error(error)
  } finally {
    studentDetailLoading.value = false
  }
}

// Problems
const queryProblems = async () => {
  problemLoading.value = true
  try {
    const res = await getClassProblemPage(problemQuery)
    if (res.data.code === 200) {
      const problems = res.data.data.records
      problemTotal.value = res.data.data.total
      classInfo.problemCount = res.data.data.total

      const problemsWithTags = await Promise.all(
        problems.map(async (problem: any) => {
          if (problem.tagIds && problem.tagIds.length > 0) {
            try {
              const tagRes = await getTagsByIds(problem.tagIds)
              if (tagRes.data.code === 200) {
                problem.tags = tagRes.data.data
              }
            } catch (error) {
              problem.tags = []
            }
          } else {
            problem.tags = []
          }
          return problem
        })
      )
      problemList.value = problemsWithTags
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

const onProblemSelectChange = (keys: string[], rows: any[]) => {
  selectedRowKeys.value = keys
  selectedProblems.value = rows
}

const handleAddProblems = () => {
  addProblemVisible.value = true
  searchProblemsToAdd()
}

const searchProblemsToAdd = async () => {
  addProblemLoading.value = true
  try {
    const res = await getProblemPage(addProblemQuery)
    if (res.data.code === 200) {
      const problems = res.data.data.records
      addProblemTotal.value = res.data.data.total
      
      const problemsWithTags = await Promise.all(
        problems.map(async (problem: any) => {
          if (problem.tagIds && problem.tagIds.length > 0) {
            try {
              const tagRes = await getTagsByIds(problem.tagIds)
              if (tagRes.data.code === 200) {
                problem.tags = tagRes.data.data
              }
            } catch (error) {
              problem.tags = []
            }
          } else {
            problem.tags = []
          }
          return problem
        })
      )
      availableProblems.value = problemsWithTags
    }
  } catch (error) {
    console.error(error)
  } finally {
    addProblemLoading.value = false
  }
}

const handleAddProblemTableChange = (pagination: any) => {
  addProblemQuery.pageNo = pagination.current
  addProblemQuery.pageSize = pagination.pageSize
  searchProblemsToAdd()
}

const onAddProblemSelectChange = (keys: string[]) => {
  selectedProblemsToAdd.value = keys
}

const confirmAddProblems = async () => {
  if (selectedProblemsToAdd.value.length === 0) {
    message.warning('请选择要添加的题目')
    return
  }
  try {
    const res = await addProblemToClass({
      classId: classInfo.id,
      problemIds: selectedProblemsToAdd.value
    })
    if (res.data.code === 200) {
      message.success('添加题目成功')
      addProblemVisible.value = false
      queryProblems()
    }
  } catch (error) {
    console.error(error)
  }
}

const handleRemoveProblems = () => {
  if (selectedRowKeys.value.length === 0) return
  Modal.confirm({
    title: '确认移除',
    icon: () => h(ExclamationCircleOutlined),
    content: '确定要移除选中的题目吗？',
    onOk: async () => {
      try {
        const res = await removeProblemFromClass({
          classId: classInfo.id,
          problemIds: selectedRowKeys.value
        })
        if (res.data.code === 200) {
          message.success('移除题目成功')
          selectedRowKeys.value = []
          queryProblems()
        }
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleStartProblem = (problem: any) => {
  router.push({
    path: '/code',
    query: {
      problemId: problem.id,
      classId: classInfo.id,
      classProblemId: problem.classProblemId
    }
  })
}

const handleEditProblem = (problem: any) => {
  router.push(`/problemManage/edit/${problem.id}`)
}

// Charts
const loadDifficultyDistribution = async () => {
  if (!difficultyChartRef.value) return
  try {
    const res = await getTeacherClassProblemDifficultyNum(classInfo.id)
    if (res.data.code === 200) {
      const data = res.data.data.map((item: any) => ({
        name: item.difficulty,
        value: item.problemNum
      }))
      
      const chart = echarts.init(difficultyChartRef.value)
      chart.setOption({
        title: { text: '题目难度分布', left: 'center' },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{
          type: 'pie',
          radius: '50%',
          data: data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      })
    }
  } catch (error) {
    console.error(error)
  }
}

const loadTagDistribution = async () => {
  if (!tagChartRef.value) return
  try {
    const res = await getTeacherClassProblemTagNum(classInfo.id)
    if (res.data.code === 200) {
      const data = res.data.data
        .filter((item: any) => item.problemCount > 0)
        .sort((a: any, b: any) => b.problemCount - a.problemCount)
      
      const names = data.map((item: any) => item.tagName || '未标记')
      const values = data.map((item: any) => item.problemCount)
      
      const chart = echarts.init(tagChartRef.value)
      chart.setOption({
        title: { text: '题目标签分布', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: names, axisLabel: { rotate: 30 } },
        yAxis: { type: 'value' },
        series: [{
          data: values,
          type: 'bar'
        }]
      })
    }
  } catch (error) {
    console.error(error)
  }
}

const loadProblemPassRateData = async () => {
  if (!passRateChartRef.value) return
  try {
    const res = await getClassProblemPassRate(classInfo.id)
    if (res.data.code === 200) {
      const data = res.data.data || []
      const sorted = data.sort((a: any, b: any) => b.passRate - a.passRate)
      problemRankList.value = sorted
      
      const chart = echarts.init(passRateChartRef.value)
      chart.setOption({
        title: { text: '题目通过率排行榜', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { 
          type: 'category', 
          data: sorted.map((i: any) => i.problemTitle),
          axisLabel: { rotate: 30, interval: 0 }
        },
        yAxis: { type: 'value', max: 100 },
        series: [{
          data: sorted.map((i: any) => i.passRate),
          type: 'bar',
          itemStyle: {
            color: (params: any) => {
              const val = params.value
              if (val >= 80) return '#52c41a'
              if (val >= 50) return '#faad14'
              return '#f5222d'
            }
          }
        }]
      })
    }
  } catch (error) {
    console.error(error)
  }
}

const loadStudentRankData = async () => {
  if (!studentRankChartRef.value) return
  try {
    const res = await getClassStudentRank(classInfo.id)
    if (res.data.code === 200) {
      const data = res.data.data || []
      const sorted = data.sort((a: any, b: any) => b.avgScore - a.avgScore)
      studentRankList.value = sorted
      
      const chart = echarts.init(studentRankChartRef.value)
      chart.setOption({
        title: { text: '学生成绩排名', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { 
          type: 'category', 
          data: sorted.map((i: any) => i.studentName),
          axisLabel: { rotate: 30 }
        },
        yAxis: { type: 'value' },
        series: [{
          data: sorted.map((i: any) => i.avgScore),
          type: 'bar'
        }]
      })
    }
  } catch (error) {
    console.error(error)
  }
}

// PDF
const checkPdfExistence = async () => {
  pdfLoading.value = true
  try {
    const res = await checkPdfExists(classInfo.id)
    hasPdf.value = res.data.code === 200 && res.data.data !== null
    if (hasPdf.value) {
      pdfUrl.value = res.data.data.url
    }
  } catch (error) {
    console.error(error)
    hasPdf.value = false
  } finally {
    pdfLoading.value = false
  }
}

const handleViewPdf = () => {
  window.open(pdfUrl.value, '_blank')
}

const handleDownloadPdf = () => {
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `${classInfo.name}-学习资料.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const handleDeletePdf = async () => {
  try {
    const res = await deletePdf(classInfo.id)
    if (res.data.code === 200) {
      message.success('删除成功')
      hasPdf.value = false
    }
  } catch (error) {
    console.error(error)
  }
}

const handleUploadPdf = async (options: any) => {
  const { file, onSuccess, onError } = options
  try {
    const res = await uploadPdf(classInfo.id, file)
    if (res.data.code === 200) {
      message.success('上传成功')
      uploadVisible.value = false
      checkPdfExistence()
      onSuccess(res.data)
    } else {
      message.error(res.data.msg || '上传失败')
      onError(new Error(res.data.msg))
    }
  } catch (error) {
    console.error(error)
    onError(error)
  }
}

const beforeUpload = (file: File) => {
  const isPdf = file.type === 'application/pdf'
  if (!isPdf) {
    message.error('只能上传 PDF 文件!')
  }
  return isPdf
}

const memberColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '总得分', dataIndex: 'totalScore', key: 'totalScore' },
  { title: '完成率', key: 'progress' },
  { title: '操作', key: 'action' }
]

const problemColumns = [
  { title: '题目标题', dataIndex: 'title', key: 'title' },
  { title: '难度', dataIndex: 'grade', key: 'grade' },
  { title: '标签', key: 'tags' },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', customRender: ({ text }: any) => text ? dayjs(text).format('YYYY-MM-DD') : '' },
  { title: '操作', key: 'action' }
]

const addProblemColumns = [
  { title: '题目标题', dataIndex: 'title', key: 'title' },
  { title: '难度', dataIndex: 'grade', key: 'grade' },
  { title: '标签', key: 'tags' },
]

const rankColumns = [
  { title: '题目', dataIndex: 'problemTitle', key: 'problemTitle' },
  { title: '难度', dataIndex: 'difficulty', key: 'difficulty' },
  { title: '尝试人数', dataIndex: 'attemptedStudents', key: 'attemptedStudents' },
  { title: '总提交次数', dataIndex: 'totalSubmissions', key: 'totalSubmissions' },
  { title: '通过率', dataIndex: 'passRate', key: 'passRate' },
]

const studentRankColumns = [
  { title: '排名', key: 'rank', width: 80, align: 'center' },
  { title: '姓名', dataIndex: 'studentName', key: 'studentName' },
  { title: '尝试题目数', dataIndex: 'attemptedProblems', key: 'attemptedProblems', align: 'center' },
  { title: '提交总数', dataIndex: 'totalSubmissions', key: 'totalSubmissions', align: 'center' },
  { title: '通过数', dataIndex: 'passedSubmissions', key: 'passedSubmissions', align: 'center' },
  { title: '通过率', dataIndex: 'passRatePercentage', key: 'passRatePercentage' },
  { title: '平均分', dataIndex: 'avgScore', key: 'avgScore', sorter: (a: any, b: any) => a.avgScore - b.avgScore },
]

const studentProblemColumns = [
  { title: '题目标题', dataIndex: 'title', key: 'title' },
  { title: '提交次数', dataIndex: 'submitNumber', key: 'submitNumber' },
  { title: '通过次数', dataIndex: 'passNumber', key: 'passNumber' },
  { title: '得分', dataIndex: 'score', key: 'score' },
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

const getDifficultyColor = (difficulty: number) => {
  switch (difficulty) {
    case 1: return 'success'
    case 2: return 'warning'
    case 3: return 'error'
    default: return 'default'
  }
}

const getDifficultyText = (difficulty: number) => {
  switch (difficulty) {
    case 1: return '简单'
    case 2: return '中等'
    case 3: return '困难'
    default: return '未知'
  }
}
</script>

<template>
  <ClassDetailLayout :class-name="classInfo.name" :teacher-name="userStore.name">
    <template #menu>
        <a-menu v-model:selectedKeys="activeMenu" mode="inline" style="border-right: 0">
          <a-menu-item key="overview">
            <template #icon><MenuOutlined /></template>
            <span>班级概览</span>
          </a-menu-item>
          <a-menu-item key="members">
            <template #icon><TeamOutlined /></template>
            <span>班级成员</span>
          </a-menu-item>
          <a-menu-item key="problems">
            <template #icon><ReadOutlined /></template>
            <span>班级题目</span>
          </a-menu-item>
          <a-menu-item key="problemRank">
            <template #icon><TrophyOutlined /></template>
            <span>排行榜</span>
          </a-menu-item>
          <a-menu-item key="knowledgeBase">
            <template #icon><FilePdfOutlined /></template>
            <span>知识库</span>
          </a-menu-item>
        </a-menu>
    </template>
        <!-- Overview -->
        <div v-show="activeMenu[0] === 'overview'">
          <a-row :gutter="[16, 16]">
            <a-col :span="24">
              <a-card title="班级概览" :bordered="false">
                <a-row :gutter="16">
                  <a-col :span="8">
                    <a-statistic title="班级人数" :value="classInfo.joinNumber">
                      <template #prefix><TeamOutlined /></template>
                    </a-statistic>
                  </a-col>
                  <a-col :span="8">
                    <a-statistic title="题目数量" :value="classInfo.problemCount">
                      <template #prefix><ReadOutlined /></template>
                    </a-statistic>
                  </a-col>
                  <a-col :span="8">
                    <a-statistic title="平均得分" :value="averageScore">
                      <template #prefix><TrophyOutlined /></template>
                    </a-statistic>
                  </a-col>
                </a-row>
              </a-card>
            </a-col>
            
            <a-col :span="12">
              <a-card title="难度分布" :bordered="false">
                <div ref="difficultyChartRef" style="height: 300px; width: 100%"></div>
              </a-card>
            </a-col>
            <a-col :span="12">
              <a-card title="标签分布" :bordered="false">
                <div ref="tagChartRef" style="height: 300px; width: 100%"></div>
              </a-card>
            </a-col>
          </a-row>
        </div>

        <!-- Members -->
        <div v-show="activeMenu[0] === 'members'">
          <a-card title="班级成员" :bordered="false">
            <template #extra>
              <a-input-search
                v-model:value="memberQuery.name"
                placeholder="搜索成员"
                @search="queryMembers"
                style="width: 250px"
                allow-clear
              />
            </template>
            <a-table
              :columns="memberColumns"
              :data-source="memberList"
              :pagination="{
                current: memberQuery.pageNo,
                pageSize: memberQuery.pageSize,
                total: memberTotal,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 人`
              }"
              :loading="memberLoading"
              row-key="id"
              @change="handleMemberTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'progress'">
                  <a-progress :percent="calculateProgress(record)" size="small" />
                </template>
                <template v-if="column.key === 'action'">
                  <a-button type="link" size="small" @click="handleViewStudentDetail(record)">查看详情</a-button>
                </template>
              </template>
            </a-table>
          </a-card>
        </div>

        <!-- Problems -->
        <div v-show="activeMenu[0] === 'problems'">
          <a-card title="班级题目" :bordered="false">
            <template #extra>
              <a-space>
                <a-input-search
                  v-model:value="problemQuery.name"
                  placeholder="搜索题目"
                  @search="queryProblems"
                  style="width: 200px"
                  allow-clear
                />
                <a-button type="primary" @click="handleAddProblems">
                  <template #icon><PlusOutlined /></template>
                  添加题目
                </a-button>
                <a-button danger @click="handleRemoveProblems" :disabled="selectedRowKeys.length === 0">
                  <template #icon><DeleteOutlined /></template>
                  移除题目
                </a-button>
              </a-space>
            </template>
            <a-table
              :columns="problemColumns"
              :data-source="problemList"
              :row-selection="{ selectedRowKeys: selectedRowKeys, onChange: onProblemSelectChange }"
              :pagination="{
                current: problemQuery.pageNo,
                pageSize: problemQuery.pageSize,
                total: problemTotal,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 题`
              }"
              :loading="problemLoading"
              row-key="id"
              @change="handleProblemTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'grade'">
                  <a-tag :color="getGradeColor(record.grade)">{{ getGradeText(record.grade) }}</a-tag>
                </template>
                <template v-if="column.key === 'tags'">
                  <a-space size="small" wrap>
                    <a-tag v-for="tag in record.tags" :key="tag.id">{{ tag.name }}</a-tag>
                  </a-space>
                </template>
                <template v-if="column.key === 'action'">
                  <a-space divider type="vertical">
                    <a-button type="link" size="small" @click="handleStartProblem(record)">查看</a-button>
                    <a-button type="link" size="small" @click="handleEditProblem(record)">编辑</a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>
        </div>

        <!-- Rank -->
        <div v-show="activeMenu[0] === 'problemRank'">
          <a-card title="排行榜" :bordered="false">
            <div ref="passRateChartRef" style="height: 400px; width: 100%"></div>
            <a-divider />
            <a-table
              :columns="rankColumns"
              :data-source="problemRankList"
              :pagination="false"
              row-key="problemTitle"
              bordered
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'difficulty'">
                  <a-tag :color="getDifficultyColor(record.difficulty)">
                    {{ getDifficultyText(record.difficulty) }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'passRate'">
                  <a-progress :percent="parseFloat(record.passRate.toFixed(2))" size="small" />
                </template>
              </template>
            </a-table>
            <a-divider />
            <div ref="studentRankChartRef" style="height: 400px; width: 100%"></div>
            <a-divider />
            <a-table
              :columns="studentRankColumns"
              :data-source="studentRankList"
              :pagination="false"
              row-key="studentName"
              bordered
            >
              <template #bodyCell="{ column, record, index }">
                <template v-if="column.key === 'rank'">
                  <span :style="{ 
                    fontWeight: index < 3 ? 'bold' : 'normal',
                    color: index === 0 ? '#f5222d' : index === 1 ? '#faad14' : index === 2 ? '#52c41a' : 'inherit'
                  }">
                    {{ index + 1 }}
                  </span>
                </template>
                <template v-if="column.key === 'passRatePercentage'">
                  <a-progress :percent="parseFloat(record.passRatePercentage.toFixed(2))" size="small" />
                </template>
                <template v-if="column.key === 'avgScore'">
                  <span>{{ record.avgScore.toFixed(2) }}</span>
                </template>
              </template>
            </a-table>
          </a-card>
        </div>

        <!-- Knowledge Base -->
        <div v-show="activeMenu[0] === 'knowledgeBase'">
          <a-card title="班级知识库" :bordered="false" :loading="pdfLoading">
            <div v-if="hasPdf" style="text-align: center; padding: 40px; background: #fafafa; border-radius: 8px;">
              <div style="margin-bottom: 16px;">
                <FilePdfOutlined style="font-size: 48px; color: #ff4d4f" />
              </div>
              <div style="margin-bottom: 24px;">
                <a-typography-title :level="4" style="color: #1890ff">班级学习资料已上传</a-typography-title>
                <a-space>
                  <a-button type="primary" @click="handleViewPdf">查看 PDF</a-button>
                  <a-button @click="handleDownloadPdf">下载 PDF</a-button>
                  <a-button @click="uploadVisible = true">重新上传</a-button>
                  <a-button danger @click="handleDeletePdf">删除 PDF</a-button>
                </a-space>
              </div>
            </div>
            <div v-else style="padding: 40px 0;">
              <a-empty description="暂无知识库文件">
                <a-button type="primary" @click="uploadVisible = true">
                  <template #icon><UploadOutlined /></template>
                  上传 PDF 文件
                </a-button>
              </a-empty>
            </div>
          </a-card>
        </div>

    <!-- Add Problem Modal -->
    <a-modal
      v-model:open="addProblemVisible"
      title="添加题目"
      width="800px"
      @ok="confirmAddProblems"
    >
      <div class="mb-4">
        <a-input-search
          v-model:value="addProblemQuery.name"
          placeholder="搜索题目"
          @search="searchProblemsToAdd"
          style="width: 300px"
        />
      </div>
      <a-table
        :columns="addProblemColumns"
        :data-source="availableProblems"
        :row-selection="{ selectedRowKeys: selectedProblemsToAdd, onChange: onAddProblemSelectChange }"
        :pagination="{
          current: addProblemQuery.pageNo,
          pageSize: addProblemQuery.pageSize,
          total: addProblemTotal
        }"
        :loading="addProblemLoading"
        row-key="id"
        @change="handleAddProblemTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'grade'">
            <a-tag :color="getGradeColor(record.grade)">{{ getGradeText(record.grade) }}</a-tag>
          </template>
          <template v-if="column.key === 'tags'">
            <a-tag v-for="tag in record.tags" :key="tag.id">{{ tag.name }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- Student Detail Modal -->
    <a-modal
      v-model:open="studentDetailVisible"
      title="学生做题详情"
      width="800px"
      :footer="null"
    >
      <a-table
        :columns="studentProblemColumns"
        :data-source="studentProblemList"
        :loading="studentDetailLoading"
        row-key="id"
      />
    </a-modal>

    <!-- Upload PDF Modal -->
    <a-modal
      v-model:open="uploadVisible"
      title="上传知识库 PDF"
      :footer="null"
    >
      <a-upload-dragger
        name="file"
        :multiple="false"
        :customRequest="handleUploadPdf"
        :beforeUpload="beforeUpload"
        accept=".pdf"
      >
        <p class="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p class="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p class="ant-upload-hint">只能上传 PDF 文件</p>
      </a-upload-dragger>
    </a-modal>
  </ClassDetailLayout>
</template>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
</style>
