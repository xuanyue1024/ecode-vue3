<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  MenuOutlined,
  TeamOutlined,
  ReadOutlined,
  LineChartOutlined
} from '@ant-design/icons-vue'
import * as echarts from 'echarts'
import { 
  getClassMembers, 
  getStudentClassProblemPage, 
  getClassProblemInfo, 
  getStudentClassProblemDifficultyNum, 
  getStudentClassProblemTagNum 
} from '@/api/class'
import { getStudentStatistic } from '@/api/statistic'
import { getStudentTagsByIds } from '@/api/tag'
import ClassDetailLayout from '@/layout/ClassDetailLayout.vue'

const route = useRoute()
const router = useRouter()

const activeMenu = ref(['overview'])
const classInfo = reactive({
  id: '',
  name: '',
  joinNumber: 0,
  problemCount: 0
})
const completedCount = ref(0)

// Charts
const difficultyChartRef = ref()
const tagChartRef = ref()
const scoreChartRef = ref()

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
const problemQuery = reactive({
  pageNo: 1,
  pageSize: 10,
  name: '',
  classId: ''
})

onMounted(() => {
  classInfo.id = route.params.id as string
  classInfo.name = route.query.name as string || ''
  memberQuery.classId = classInfo.id
  problemQuery.classId = classInfo.id

  initData()
  
  if (activeMenu.value[0] === 'overview') {
    loadCharts()
  }
})

watch(activeMenu, (newVal) => {
  const key = newVal[0]
  if (key === 'overview') {
    setTimeout(() => loadCharts(), 100)
  } else if (key === 'statistics') {
    setTimeout(() => loadStatistics(), 100)
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

const queryMembers = async () => {
  memberLoading.value = true
  try {
    const res = await getClassMembers(memberQuery)
    if (res.data.code === 200) {
      memberList.value = res.data.data?.records || []
      memberTotal.value = res.data.data?.total || 0
      classInfo.joinNumber = res.data.data?.total || 0
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

const queryProblems = async () => {
  problemLoading.value = true
  try {
    const res = await getStudentClassProblemPage(problemQuery)
    if (res.data.code === 200) {
      const problems = res.data.data?.records || []
      problemTotal.value = res.data.data?.total || 0
      classInfo.problemCount = res.data.data?.total || 0

      const problemsWithInfo = await Promise.all(
        problems.map(async (problem: any) => {
          try {
            const infoRes = await getClassProblemInfo(problem.classProblemId)
            let updatedProblem = {
              ...problem,
              submitCount: infoRes.data.data?.submitNumber || 0,
              passRate: (infoRes.data.data?.passNumber || 0) / (infoRes.data.data?.submitNumber || 1),
              status: infoRes.data.data?.score === 4 ? 'COMPLETED' : 'UNCOMPLETED',
              createTime: infoRes.data.data?.createTime,
              updateTime: infoRes.data.data?.updateTime,
              tags: []
            }
            
            if (problem.tagIds && problem.tagIds.length > 0) {
              try {
                const tagRes = await getStudentTagsByIds(problem.tagIds)
                if (tagRes.data.code === 200) {
                  updatedProblem.tags = tagRes.data.data || []
                }
              } catch (error) {
                // ignore
              }
            }
            return updatedProblem
          } catch (error) {
            return { ...problem, tags: [] }
          }
        })
      )
      
      problemList.value = problemsWithInfo
      completedCount.value = problemList.value.filter((p: any) => p.status === 'COMPLETED').length
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
  router.push({
    path: '/code',
    query: {
      problemId: problem.id,
      classId: classInfo.id,
      classProblemId: problem.classProblemId
    }
  })
}

const loadDifficultyDistribution = async () => {
  if (!difficultyChartRef.value) return
  try {
    const res = await getStudentClassProblemDifficultyNum(classInfo.id)
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
          data: data
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
    const res = await getStudentClassProblemTagNum(classInfo.id)
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

const loadStatistics = async () => {
  if (!scoreChartRef.value) return
  try {
    const res = await getStudentStatistic(classInfo.id)
    if (res.data.code === 200) {
      const data = res.data.data
      const titles = data.key.split(',')
      const values = data.value
      const scores = values.score.split(',').map(Number)
      const submits = values.submit.split(',').map(Number)
      const passes = values.pass.split(',').map(Number)
      
      const chart = echarts.init(scoreChartRef.value)
      chart.setOption({
        title: { text: '题目完成情况统计', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['得分', '提交次数', '通过次数'], top: 30 },
        xAxis: { type: 'category', data: titles, axisLabel: { rotate: 30 } },
        yAxis: { type: 'value' },
        series: [
          { name: '得分', type: 'bar', data: scores },
          { name: '提交次数', type: 'bar', data: submits },
          { name: '通过次数', type: 'bar', data: passes }
        ]
      })
    }
  } catch (error) {
    console.error(error)
  }
}

const memberColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
]

const problemColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '题目标题', dataIndex: 'title', key: 'title' },
  { title: '难度', dataIndex: 'grade', key: 'grade' },
  { title: '标签', key: 'tags' },
  { title: '提交次数', dataIndex: 'submitCount', key: 'submitCount' },
  { title: '通过率', key: 'passRate' },
  { title: '状态', key: 'status' },
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
  <ClassDetailLayout :class-name="classInfo.name" :teacher-name="route.query.teacherName as string">
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
          <span>题目集</span>
        </a-menu-item>
        <a-menu-item key="statistics">
          <template #icon><LineChartOutlined /></template>
          <span>数据统计</span>
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
                <a-statistic title="已完成题目" :value="completedCount">
                  <template #prefix><ReadOutlined /></template>
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
        />
      </a-card>
    </div>

    <!-- Problems -->
    <div v-show="activeMenu[0] === 'problems'">
      <a-card title="班级题目" :bordered="false">
        <template #extra>
          <a-input-search
            v-model:value="problemQuery.name"
            placeholder="搜索题目"
            @search="queryProblems"
            style="width: 250px"
            allow-clear
          />
        </template>
        <a-table
          :columns="problemColumns"
          :data-source="problemList"
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
            <template v-if="column.key === 'passRate'">
              <a-progress 
                :percent="record.passRate ? Math.round(record.passRate * 100) : 0" 
                size="small" 
                :status="record.passRate === 1 ? 'success' : 'normal'"
              />
            </template>
            <template v-if="column.key === 'status'">
              <a-badge :status="record.status === 'COMPLETED' ? 'success' : 'default'" :text="record.status === 'COMPLETED' ? '已完成' : '未完成'" />
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="primary" size="small" ghost @click="handleStartProblem(record)">
                {{ record.status === 'COMPLETED' ? '重做' : '开始' }}
              </a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- Statistics -->
    <div v-show="activeMenu[0] === 'statistics'">
      <a-card title="学习统计" :bordered="false">
        <div ref="scoreChartRef" style="height: 400px; width: 100%"></div>
      </a-card>
    </div>
  </ClassDetailLayout>
</template>

<style scoped>
/* Removed custom styles in favor of inline styles and Ant Design defaults */
</style>
