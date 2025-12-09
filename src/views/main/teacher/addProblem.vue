<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  ArrowLeftOutlined, 
  StarOutlined, 
  StarFilled,
  RobotOutlined
} from '@ant-design/icons-vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { 
  addProblem, 
  updateProblem, 
  setProblemTags, 
  getTeacherProblemDetail 
} from '@/api/problem'
import { 
  searchTags, 
  addTag, 
  batchAddTags 
} from '@/api/tag'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const formRef = ref()
const form = reactive<any>({
  title: '',
  grade: 'EASY',
  content: '',
  answer: '',
  maxTime: 5,
  maxMemory: 512,
  tagIds: [],
  inputTest1: '',
  outputTest1: '',
  inputTest2: '',
  outputTest2: '',
  inputTest3: '',
  outputTest3: '',
  inputTest4: '',
  outputTest4: ''
})

// Tags
const tagOptions = ref<any[]>([])
const tagsLoading = ref(false)
const tagDialogVisible = ref(false)
const tagFormRef = ref()
const tagForm = reactive({
  name: ''
})
const addingTag = ref(false)

// AI Generate
const generateDialogVisible = ref(false)
const generatePrompt = ref('')
const generating = ref(false)
const collectedText = ref('')

const isEdit = computed(() => !!route.params.id)
const pageTitle = computed(() => isEdit.value ? '编辑题目' : '新增题目')

const rules = {
  title: [
    { required: true, message: '请输入题目标题', trigger: 'blur' },
    { min: 2, max: 50, message: '标题长度应在 2 到 50 个字符之间', trigger: 'blur' }
  ],
  grade: [{ required: true, message: '请选择题目难度', trigger: 'change' }],
  content: [{ required: true, message: '请输入题目描述', trigger: 'blur' }],
  maxTime: [{ required: true, message: '请设置最大运行时间', trigger: 'blur' }],
  maxMemory: [{ required: true, message: '请设置最大内存限制', trigger: 'blur' }]
}

const tagRules = {
  name: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' }
  ]
}

onMounted(() => {
  if (isEdit.value) {
    fetchProblemDetail()
  }
  handleSearchTags('')
})

const fetchProblemDetail = async () => {
  loading.value = true
  try {
    const res = await getTeacherProblemDetail(Number(route.params.id))
    if (res.data.code === 200) {
      const data = res.data.data
      Object.assign(form, {
        id: data.id,
        title: data.title,
        grade: data.grade,
        content: data.content,
        answer: data.answer,
        maxTime: data.maxTime,
        maxMemory: data.maxMemory,
        tagIds: data.tags ? data.tags.map((t: any) => t.id) : [],
        inputTest1: data.inputTest1 || '',
        outputTest1: data.outputTest1 || '',
        inputTest2: data.inputTest2 || '',
        outputTest2: data.outputTest2 || '',
        inputTest3: data.inputTest3 || '',
        outputTest3: data.outputTest3 || '',
        inputTest4: data.inputTest4 || '',
        outputTest4: data.outputTest4 || ''
      })
      
      if (data.tags && data.tags.length > 0) {
        const existingIds = new Set(tagOptions.value.map(t => t.id))
        const newTags = data.tags.filter((t: any) => !existingIds.has(t.id))
        tagOptions.value = [...tagOptions.value, ...newTags]
      }
    }
  } catch (error) {
    console.error('获取题目详情失败:', error)
    message.error('获取题目详情失败')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push('/problemManage')
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    
    const formData = { ...form }
    const tagIds = formData.tagIds
    delete formData.tagIds
    
    const res = isEdit.value
      ? await updateProblem(formData)
      : await addProblem(formData)
      
    if (res.data.code === 200) {
      const problemId = isEdit.value ? form.id : res.data.data
      
      if (tagIds && tagIds.length > 0) {
        await setProblemTags({
          problemId: problemId,
          tagIds: tagIds
        })
      }
      
      message.success(isEdit.value ? '修改成功' : '新增成功')
      handleBack()
    } else {
      message.error(res.data.msg || '操作失败')
    }
  } catch (error) {
    console.error('保存题目失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearchTags = async (value: string) => {
  tagsLoading.value = true
  try {
    const res = await searchTags(value || '')
    if (res.data.code === 200) {
      if (!value && form.tagIds.length > 0) {
        const selectedTags = tagOptions.value.filter(t => form.tagIds.includes(t.id))
        const newOptions = res.data.data.filter((t: any) => !form.tagIds.includes(t.id))
        tagOptions.value = [...selectedTags, ...newOptions]
      } else {
        tagOptions.value = res.data.data
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    tagsLoading.value = false
  }
}

const handleAddTag = async () => {
  try {
    await tagFormRef.value.validate()
    addingTag.value = true
    const res = await addTag(tagForm.name)
    if (res.data.code === 200) {
      const newTag = { id: res.data.data, name: tagForm.name }
      tagOptions.value = [...tagOptions.value, newTag]
      form.tagIds = [...form.tagIds, newTag.id]
      message.success('标签添加成功')
      tagDialogVisible.value = false
      tagForm.name = ''
    } else {
      message.error(res.data.msg || '标签添加失败')
    }
  } catch (error) {
    console.error(error)
  } finally {
    addingTag.value = false
  }
}

const handleDropdownVisibleChange = (open: boolean) => {
  if (open) {
    handleSearchTags('')
  }
}

const showGenerateDialog = () => {
  generateDialogVisible.value = true
  generatePrompt.value = ''
}

const generateProblem = async () => {
  if (!generatePrompt.value.trim()) {
    message.warning('请输入生成要求')
    return
  }

  generating.value = true
  generateDialogVisible.value = false
  
  // Reset form fields
  form.title = ''
  form.content = ''
  form.answer = ''
  form.inputTest1 = ''
  form.outputTest1 = ''
  form.inputTest2 = ''
  form.outputTest2 = ''
  form.inputTest3 = ''
  form.outputTest3 = ''
  form.inputTest4 = ''
  form.outputTest4 = ''
  
  collectedText.value = ''
  
  const token = window.localStorage.getItem('token') || window.sessionStorage.getItem('token')
  
  try {
    const url = `/api/user/ai/generate?require=${encodeURIComponent(generatePrompt.value)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': token || ''
      }
    })

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get reader')
    
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const jsonData = JSON.parse(line.slice(5))
            if (jsonData.code === 200 && jsonData.data !== null) {
              const text = jsonData.data
              collectedText.value += text
              form.content = collectedText.value
            }
          } catch (error) {
            console.error('Error parsing message:', error)
          }
        }
      }
    }
    
    finalProcessText()
    message.success('题目生成完成')
  } catch (error) {
    console.error('Error:', error)
    message.error('生成题目失败')
  } finally {
    generating.value = false
  }
}

const finalProcessText = () => {
  const allText = collectedText.value || ''
  
  // Extract Tags
  let extractedTags: string[] = []
  const tagsMatch = allText.match(/---TAGS---([\s\S]*?)(?=---CONTENT---|$)/)
  if (tagsMatch && tagsMatch[1]) {
    extractedTags = tagsMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag)
  }
  
  // Extract Title
  const firstMarkerIndex = allText.search(/---TAGS---|---CONTENT---|---ANSWER---|---INPUT_TEST1---/)
  form.title = firstMarkerIndex > 0 ? allText.substring(0, firstMarkerIndex).trim() : ''
  
  // Extract Content
  const contentMatch = allText.match(/---CONTENT---([\s\S]*?)(?=---ANSWER---|---INPUT_TEST1---|$)/)
  form.content = contentMatch ? contentMatch[1].trim() : ''
  
  // Extract Answer
  let answerText = ''
  const answerMatch = allText.match(/---ANSWER---([\s\S]*?)(?=---INPUT_TEST1---|$)/)
  if (answerMatch) {
    answerText = answerMatch[1].trim()
    answerText = answerText.replace(/\{请在此生成题目的解答.*\}/g, '').trim()
  }
  form.answer = answerText
  
  // Extract Test Cases
  let testCaseText = ''
  const testCaseIndex = allText.indexOf('---INPUT_TEST1---')
  if (testCaseIndex !== -1) {
    testCaseText = allText.substring(testCaseIndex)
  }
  extractTestCases(testCaseText)
  
  if (extractedTags.length > 0) {
    Modal.confirm({
      title: '添加标签',
      content: `AI 生成的题目包含以下标签: ${extractedTags.join(', ')}。是否自动添加这些标签?`,
      onOk: () => addBatchTagsToForm(extractedTags)
    })
  }
}

const addBatchTagsToForm = async (tags: string[]) => {
  if (!tags || tags.length === 0) return
  try {
    const res = await batchAddTags(tags)
    if (res.data.code === 200 && res.data.data && res.data.data.length > 0) {
      const tagIds = res.data.data
      const newTags = tagIds.map((id: string, index: number) => ({
        id,
        name: tags[index]
      }))
      
      const existingIds = new Set(tagOptions.value.map(t => t.id))
      const uniqueNewTags = newTags.filter(t => !existingIds.has(t.id))
      
      tagOptions.value = [...tagOptions.value, ...uniqueNewTags]
      
      const currentSelectedIds = new Set(form.tagIds)
      tagIds.forEach((id: string) => currentSelectedIds.add(id))
      form.tagIds = Array.from(currentSelectedIds)
      
      message.success('标签添加成功')
    }
  } catch (error) {
    console.error('批量添加标签失败:', error)
  }
}

const extractTestCases = (text: string) => {
  if (!text || !text.includes('---INPUT_TEST1---')) return
  
  const testCases = [
    { name: 'inputTest1', pattern: /---INPUT_TEST1---\s*([\s\S]*?)(?=\s*---OUTPUT_TEST1---|$)/},
    { name: 'outputTest1', pattern: /---OUTPUT_TEST1---\s*([\s\S]*?)(?=\s*---INPUT_TEST2---|$)/},
    { name: 'inputTest2', pattern: /---INPUT_TEST2---\s*([\s\S]*?)(?=\s*---OUTPUT_TEST2---|$)/},
    { name: 'outputTest2', pattern: /---OUTPUT_TEST2---\s*([\s\S]*?)(?=\s*---INPUT_TEST3---|$)/},
    { name: 'inputTest3', pattern: /---INPUT_TEST3---\s*([\s\S]*?)(?=\s*---OUTPUT_TEST3---|$)/},
    { name: 'outputTest3', pattern: /---OUTPUT_TEST3---\s*([\s\S]*?)(?=\s*---INPUT_TEST4---|$)/},
    { name: 'inputTest4', pattern: /---INPUT_TEST4---\s*([\s\S]*?)(?=\s*---OUTPUT_TEST4---|$)/},
    { name: 'outputTest4', pattern: /---OUTPUT_TEST4---\s*([\s\S]*?)(?=$)/}
  ]
  
  for (const testCase of testCases) {
    const match = text.match(testCase.pattern)
    if (match && match[1]) {
      let testData = match[1].trim()
      testData = testData.replace(/\{请在此生成题目的.*样例.*\}/g, '').trim()
      form[testCase.name] = testData
    }
  }
}
</script>

<template>
  <a-layout class="add-problem-layout">
    <a-layout-content>
      <a-card :bordered="false" class="header-card">
        <template #title>
          <a-space>
            <a-button type="link" @click="handleBack">
              <template #icon><ArrowLeftOutlined /></template>
              返回
            </a-button>
            <span class="page-title">{{ pageTitle }}</span>
          </a-space>
        </template>
        <template #extra>
          <a-button type="primary" @click="handleSubmit" :loading="loading">
            {{ pageTitle }}
          </a-button>
        </template>
      </a-card>

      <div class="content-body">
        <a-form 
          ref="formRef" 
          :model="form" 
          :rules="rules" 
          layout="vertical"
        >
          <a-card title="基本信息" class="section-card" :bordered="false">
            <a-row :gutter="24">
              <a-col :span="24">
                <a-form-item label="题目标题" name="title" help="好的题目标题应该简洁明了，能清晰表达题目的主要内容">
                  <a-input v-model:value="form.title" placeholder="请输入题目标题" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="难度等级" name="grade" help="根据题目的复杂度和解题所需时间来选择合适的难度等级">
                  <a-select v-model:value="form.grade" placeholder="请选择题目难度">
                    <a-select-option value="EASY">
                      <a-space><StarOutlined style="color: #52c41a" /> 简单</a-space>
                    </a-select-option>
                    <a-select-option value="GENERAL">
                      <a-space><StarFilled style="color: #faad14" /> 中等</a-space>
                    </a-select-option>
                    <a-select-option value="DIFFICULT">
                      <a-space><StarFilled style="color: #f5222d" /> 困难</a-space>
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="题目标签" name="tagIds" help="选择或创建标签">
                  <a-select
                    v-model:value="form.tagIds"
                    mode="multiple"
                    placeholder="搜索已有标签"
                    :options="tagOptions"
                    :field-names="{ label: 'name', value: 'id' }"
                    :loading="tagsLoading"
                    show-search
                    :filter-option="false"
                    @search="handleSearchTags"
                    @dropdownVisibleChange="handleDropdownVisibleChange"
                  >
                    <template #dropdownRender="{ menuNode: menu }">
                      <v-nodes :vnodes="menu" />
                      <a-divider style="margin: 4px 0" />
                      <div style="padding: 4px 8px; cursor: pointer" @mousedown="e => e.preventDefault()" @click="tagDialogVisible = true">
                        <PlusOutlined /> 新建标签
                      </div>
                    </template>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card title="题目详情" class="section-card" :bordered="false">
            <template #extra>
              <a-button 
                type="primary" 
                ghost
                size="small" 
                @click="showGenerateDialog"
                :loading="generating"
              >
                <template #icon><RobotOutlined /></template>
                AI 生成题目
              </a-button>
            </template>
            <a-form-item label="题目描述" name="content">
              <MdEditor v-model="form.content" style="height: 500px" />
            </a-form-item>
            
            <a-form-item label="解答" name="answer">
              <MdEditor v-model="form.answer" style="height: 300px" />
            </a-form-item>
          </a-card>

          <a-card title="测试用例" class="section-card" :bordered="false">
            <a-alert message="请提供测试用例，帮助学生验证程序的正确性" type="info" show-icon style="margin-bottom: 16px" />
            <div v-for="i in 4" :key="i" class="test-case-item">
              <a-divider orientation="left">测试用例 {{ i }}</a-divider>
              <a-row :gutter="24">
                <a-col :span="12">
                  <a-form-item :label="'输入 ' + i" :name="'inputTest' + i">
                    <a-textarea 
                      v-model:value="form['inputTest' + i]" 
                      :rows="3"
                      placeholder="请输入测试数据"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item :label="'输出 ' + i" :name="'outputTest' + i">
                    <a-textarea 
                      v-model:value="form['outputTest' + i]" 
                      :rows="3"
                      placeholder="请输入期望输出"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>
          </a-card>

          <a-card title="运行限制" class="section-card" :bordered="false">
            <a-row :gutter="24">
              <a-col :span="12">
                <a-form-item label="最大运行时间" name="maxTime" help="程序的最大允许运行时间">
                  <a-input-number 
                    v-model:value="form.maxTime" 
                    :min="1" 
                    :max="60"
                    :step="1"
                    addon-after="秒"
                    style="width: 100%"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="最大内存限制" name="maxMemory" help="程序的最大允许内存使用量">
                  <a-input-number 
                    v-model:value="form.maxMemory" 
                    :min="64" 
                    :max="1024"
                    :step="64"
                    addon-after="MB"
                    style="width: 100%"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>
        </a-form>
      </div>
    </a-layout-content>

    <a-modal
      v-model:open="tagDialogVisible"
      title="新建标签"
      @ok="handleAddTag"
      :confirmLoading="addingTag"
    >
      <a-form ref="tagFormRef" :model="tagForm" :rules="tagRules" layout="vertical">
        <a-form-item label="标签名称" name="name">
          <a-input v-model:value="tagForm.name" placeholder="请输入标签名称" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="generateDialogVisible"
      title="AI 生成题目"
      @ok="generateProblem"
      okText="生成"
    >
      <a-form layout="vertical">
        <a-form-item label="生成要求">
          <a-textarea
            v-model:value="generatePrompt"
            :rows="4"
            placeholder="请输入题目生成要求，例如：生成一道关于二叉树遍历的中等难度题目"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  components: {
    VNodes: (_, { attrs }) => {
      return attrs.vnodes
    }
  }
})
</script>

<style scoped>
.add-problem-layout {
  min-height: 100%;
  background: #f0f2f5;
}

.header-card {
  margin-bottom: 24px;
  border-radius: 0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.content-body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 24px;
}

.section-card {
  margin-bottom: 24px;
  border-radius: 8px;
}

:deep(.ant-card-head) {
  border-bottom: 1px solid #f0f0f0;
}
</style>
