<template>
  <div class="code-page-container">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
    
    <div class="code-header">
      <div class="header-left">
        <a-button type="text" @click="goBack">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>
        
        <a-button type="text" @click="(e) => toggleAiChat(e)">
          <template #icon><MessageOutlined /></template>
          AI 助手
        </a-button>
      </div>
      
      <div class="header-right">
        <div class="editor-settings">
          <a-select v-model:value="codeEditorSetting.theme" style="width: 100px; margin-right: 10px;" @change="updateTheme">
            <a-select-option value="vs-dark">vs-dark</a-select-option>
            <a-select-option value="hc-black">hc-black</a-select-option>
            <a-select-option value="vs">vs</a-select-option>
          </a-select>
          <a-select v-model:value="codeEditorSetting.language" style="width: 100px; margin-right: 10px;" @change="updateLanguage">
            <a-select-option value="java">java</a-select-option>
            <a-select-option value="python3">python3</a-select-option>
            <a-select-option value="cpp">cpp</a-select-option>
            <a-select-option value="swift">swift</a-select-option>
            <a-select-option value="rust">rust</a-select-option>
            <a-select-option value="php">php</a-select-option>
            <a-select-option value="nodejs">nodejs</a-select-option>
            <a-select-option value="kotlin">kotlin</a-select-option>
            <a-select-option value="go">go</a-select-option>
            <a-select-option value=".net">.net</a-select-option>
          </a-select>
          <a-select v-model:value="codeEditorSetting.fontSize" style="width: 100px;" @change="updateFontSize">
            <a-select-option value="12px">12px</a-select-option>
            <a-select-option value="14px">14px</a-select-option>
            <a-select-option value="16px">16px</a-select-option>
            <a-select-option value="18px">18px</a-select-option>
            <a-select-option value="20px">20px</a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <div class="code-main-body" ref="mainBodyRef">
      <!-- Left Pane -->
      <div class="left-pane" :style="{ width: leftWidth + '%' }">
        <div class="problem-card-wrapper">
          <div class="problem-header">
            <h2 style="margin: 0; display: inline-block;">{{ problem.title }}</h2>
            <a-tag :color="getGradeColor(problem.grade)" style="margin-left: 10px;">
              {{ getGradeText(problem.grade) }}
            </a-tag>
          </div>
          
          <div class="side-history-btn" @click="toggleHistoryView">
            <a-tooltip :title="asideActiveView === 'problem' ? '查看提交历史' : '返回题目'" placement="left">
              <HistoryOutlined v-if="asideActiveView === 'problem'" />
              <ArrowLeftOutlined v-else />
            </a-tooltip>
          </div>
          
          <div v-if="asideActiveView === 'problem'" class="problem-scroll-container">
            <h3 style="margin-bottom: 10px">题目内容</h3>
            <div class="markdown-body" v-html="markedContent"></div>
          </div>
          
          <SubmissionHistory 
            v-else
            :class-id="route.query.classId || 0" 
            :class-problem-id="route.query.classProblemId || 0"
            :current-language="codeEditorSetting.language"
            @use-code="useHistoryCode"
            style="text-align: left;"
          />
        </div>
      </div>

      <!-- Vertical Resizer -->
      <div class="resizer-vertical" @mousedown="startResizeHorizontal">
        <div class="resizer-handle"></div>
      </div>

      <!-- Right Pane -->
      <div class="right-pane" :style="{ width: (100 - leftWidth) + '%' }">
        
        <!-- Top Right: Editor -->
        <div class="top-pane" :style="{ height: topHeight + '%' }">
          <div class="editor-main">
            <div ref="containerRef" class="monaco-editor-container"></div>
          </div>
        </div>

        <!-- Horizontal Resizer -->
        <div class="resizer-horizontal" @mousedown="startResizeVertical">
          <div class="resizer-handle-horizontal"></div>
        </div>

        <!-- Bottom Right: Output -->
        <div class="bottom-pane" :style="{ height: (100 - topHeight) + '%' }">
          <div class="editor-footer">
            <a-tabs v-model:activeKey="activeTab" class="footer-tabs">
              <a-tab-pane key="test" tab="测试结果">
                <div class="test-result-panel">
                  <a-row style="margin-bottom: 10px">
                    <a-col :span="12">
                      <div>通过测试: {{ testResult.passCount }}/4</div>
                      <div>得分: {{ testResult.score }}/4</div>
                    </a-col>
                    <a-col :span="12" style="text-align: right">
                      <a-button type="link" @click="showDiffDialog(testResult.diff)" v-if="testResult.diff && testResult.diff.length">
                        查看详细对比
                      </a-button>
                    </a-col>
                  </a-row>
                  <div v-for="(diff, index) in testResult.diff" :key="index" class="diff-item">
                    <div class="diff-header">
                      测试用例 #{{ index + 1 }}
                    </div>
                    <pre class="diff-content">{{ diff }}</pre>
                  </div>
                </div>
              </a-tab-pane>
              <a-tab-pane key="debug" tab="自测结果">
                <a-row :gutter="16" style="height: 100%">
                  <a-col :span="12" style="height: 100%">
                    <div>自测输入值</div>
                    <div ref="inputRef" class="debug-editor"></div>
                  </a-col>
                  <a-col :span="12" style="height: 100%">
                    <div>结果</div>
                    <div ref="outputRef" class="debug-editor"></div>
                  </a-col>
                </a-row>
              </a-tab-pane>
            </a-tabs>
            
            <div class="footer-actions">
              <a-button type="primary" ghost @click="debugBtn" :loading="isDebugLoad" :disabled="isDebugDisabled" style="margin-right: 10px;">
                调试
              </a-button>
              <a-button type="primary" @click="submitCode" :loading="isSubmitLoad" :disabled="isSubmitDisabled">
                提交
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Chat Window -->
    <div v-if="showAiChat" class="ai-chat-window" :style="{ top: chatPosition.top + 'px', left: chatPosition.left + 'px', width: chatSize.width + 'px', height: chatSize.height + 'px' }">
      <div class="ai-chat-wrapper" style="width: 100%; height: 100%;">
        <div class="chat-header" @mousedown="startDrag">
          <span>AI 助手</span>
          <CloseOutlined class="close-icon" @click="showAiChat = false" />
        </div>
        <AiChat
          ref="aiChatRef"
          :chat-id="chatId"
          scene="CODE"
          :context="{
            problemId: route.query.problemId,
            classId: route.query.classId
          }"
          :user-info="userInfo"
        />
      </div>
      <!-- Resize Handle -->
      <div class="resize-handle" @mousedown.stop="startChatResize"></div>
    </div>

    <!-- 添加差异对比弹窗 -->
    <a-modal
      v-model:open="diffDialogVisible"
      title="详细对比结果"
      width="90%"
      :footer="null"
      @cancel="handleCloseDiffDialog"
    >
      <div class="test-cases-container">
        <div v-for="(diff, index) in currentDiffs" :key="index" class="test-case-diff">
          <div class="test-case-header">测试用例 #{{ index + 1 }}</div>
          <div :ref="(el) => setDiffContainerRef(el, index)" class="diff-container"></div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message as antMessage } from 'ant-design-vue'
import { 
  ArrowLeftOutlined, 
  MessageOutlined, 
  UserOutlined, 
  RobotOutlined, 
  SendOutlined,
  HistoryOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'
import * as monaco from 'monaco-editor'
import { marked } from 'marked'
import katex from 'katex'
import 'github-markdown-css/github-markdown.css'
import { debugCode } from '@/api/code'
import { getStudentProblemDetail, runCode } from '@/api/problem'
import { getUserInfo } from '@/api/user'
import { createChatId } from '@/api/ai'
import SubmissionHistory from './SubmissionHistory.vue'
import AiChat from '@/components/AiChat.vue'
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui'
import 'diff2html/bundles/css/diff2html.min.css'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// State
const leftWidth = ref(26)
const topHeight = ref(75)
const isResizingHorizontal = ref(false)
const isResizingVertical = ref(false)
const mainBodyRef = ref<HTMLElement | null>(null)

const activeIndex2 = ref('code')
const asideActiveView = ref('problem')
const showAiChat = ref(false)
const chatPosition = reactive({ top: 100, left: 100 })
const chatSize = reactive({ width: 400, height: 500 })
const isDragging = ref(false)
const isChatResizing = ref(false)
const dragOffset = reactive({ x: 0, y: 0 })
const resizeStart = reactive({ x: 0, y: 0, width: 0, height: 0 })
const aiChatRef = ref<any>(null)

const chatId = ref('')
const userInfo = reactive({ profilePicture: '' })
const problem = reactive({
  title: '',
  grade: '',
  content: '',
  require: '',
})
const markedContent = ref('')
const loading = ref(false)

// Editors
const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLElement | null>(null)
const outputRef = ref<HTMLElement | null>(null)
let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null
let inputEditor: monaco.editor.IStandaloneCodeEditor | null = null
let outputEditor: monaco.editor.IStandaloneCodeEditor | null = null

const codeEditorSetting = reactive({
  language: 'java',
  fontSize: '18px',
  theme: 'vs'
})

const activeTab = ref('debug')
const isDebugLoad = ref(false)
const isDebugDisabled = ref(false)
const isSubmitLoad = ref(false)
const isSubmitDisabled = ref(false)

const testResult = reactive({
  passCount: 0,
  score: 0,
  diff: [] as string[],
})

const diffDialogVisible = ref(false)
const currentDiffs = ref<string[]>([])
const diffContainerRefs = ref<HTMLElement[]>([])

const messageContainer = ref<HTMLElement | null>(null)

// Methods
const setDiffContainerRef = (el: any, index: number) => {
  if (el) {
    diffContainerRefs.value[index] = el
  }
}

const startResizeHorizontal = () => {
  isResizingHorizontal.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const startResizeVertical = () => {
  isResizingVertical.value = true
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
  if (isResizingHorizontal.value) {
    if (mainBodyRef.value) {
      const containerWidth = mainBodyRef.value.clientWidth
      const newWidth = (e.clientX / containerWidth) * 100
      if (newWidth > 20 && newWidth < 80) {
        leftWidth.value = newWidth
      }
    }
  }
  if (isResizingVertical.value) {
    if (mainBodyRef.value) {
      const containerHeight = mainBodyRef.value.clientHeight
      const containerTop = mainBodyRef.value.getBoundingClientRect().top
      const relativeY = e.clientY - containerTop
      const newHeight = (relativeY / containerHeight) * 100
      if (newHeight > 20 && newHeight < 80) {
        topHeight.value = newHeight
      }
    }
  }
}

const handleMouseUp = () => {
  isResizingHorizontal.value = false
  isResizingVertical.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  
  // Trigger layout update
  setTimeout(() => {
    monacoEditor?.layout()
    inputEditor?.layout()
    outputEditor?.layout()
  }, 50)
}

const init = () => {
  // Configure marked with KaTeX
  const renderer = {
    text(token: any) {
      const text = typeof token === 'string' ? token : token.text
      if (!text) return ''
      let result = String(text)
      // Inline math
      result = result.replace(/\$([^$]+)\$/g, (_, formula) => {
        try {
          return katex.renderToString(formula, { displayMode: false })
        } catch (err) {
          return formula
        }
      })
      // Block math
      result = result.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
        try {
          return katex.renderToString(formula, { displayMode: true })
        } catch (err) {
          return formula
        }
      })
      return result
    }
  }
  
  marked.use({ 
    renderer,
    gfm: true,
    breaks: true
  })

  if (containerRef.value) {
    containerRef.value.innerHTML = ''
    monacoEditor = monaco.editor.create(containerRef.value, {
      value: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, ecode");
  }
}`,
      language: codeEditorSetting.language,
      theme: codeEditorSetting.theme,
      fontSize: parseInt(codeEditorSetting.fontSize),
      roundedSelection: true,
      autoIndent: 'full',
      automaticLayout: true,
      minimap: { enabled: true }
    })

    monacoEditor.onDidChangeModelContent(() => {
      // emit('change', monacoEditor?.getValue())
    })

    // Add actions
    monacoEditor.addAction({
      id: 'ask-ai-perf',
      label: '优化代码',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1.5,
      run: (editor) => {
        const selection = editor.getSelection()
        const selectedText = editor.getModel()?.getValueInRange(selection!)
        if (selectedText) {
          showAiChat.value = true
          nextTick(() => {
            aiChatRef.value?.sendMessage('```\n' + selectedText + '\n```\n\nperf')
          })
        } else {
          antMessage.warning('请先选择要优化的代码')
        }
      }
    })

    monacoEditor.addAction({
      id: 'ask-ai-explain',
      label: '解释代码',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1.6,
      run: (editor) => {
        const selection = editor.getSelection()
        const selectedText = editor.getModel()?.getValueInRange(selection!)
        if (selectedText) {
          showAiChat.value = true
          nextTick(() => {
            aiChatRef.value?.sendMessage('```\n' + selectedText + '\n```\n\nexplain')
          })
        } else {
          antMessage.warning('请先选择要解释的代码')
        }
      }
    })

    monacoEditor.addAction({
      id: 'ask-ai-fix',
      label: '修复Bug',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1.7,
      run: (editor) => {
        const selection = editor.getSelection()
        const selectedText = editor.getModel()?.getValueInRange(selection!)
        if (selectedText) {
          showAiChat.value = true
          nextTick(() => {
            aiChatRef.value?.sendMessage('```\n' + selectedText + '\n```\n\nfix')
          })
        } else {
          antMessage.warning('请先选择要修复的代码')
        }
      }
    })
    // ... other actions
  }

  if (inputRef.value) {
    inputEditor = monaco.editor.create(inputRef.value, {
      language: 'text',
      theme: 'vs',
      lineNumbers: 'off',
      minimap: { enabled: false },
      contextMenu: false,
      automaticLayout: true
    })
  }

  if (outputRef.value) {
    outputEditor = monaco.editor.create(outputRef.value, {
      language: 'text',
      theme: 'vs',
      lineNumbers: 'off',
      minimap: { enabled: false },
      contextMenu: false,
      readOnly: true,
      automaticLayout: true
    })
  }
}

const updateTheme = (value: string) => {
  monaco.editor.setTheme(value)
}

const updateLanguage = (value: string) => {
  if (monacoEditor) {
    const model = monacoEditor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, getMonacoLanguage(value))
    }
    // Set example code
    monacoEditor.setValue(userStore.getExampleCode(value as any))
  }
}

const updateFontSize = (value: string) => {
  monacoEditor?.updateOptions({ fontSize: parseInt(value) })
}

const getMonacoLanguage = (language: string) => {
  const languageMap: Record<string, string> = {
    'java': 'java',
    'python3': 'python',
    'cpp': 'cpp',
    'nodejs': 'javascript',
    'go': 'go',
    '.net': 'csharp',
    'php': 'php',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
  }
  return languageMap[language] || language
}

const getProblemDetail = async () => {
  const problemId = route.query.problemId
  if (!problemId) {
    antMessage.error('题目ID不能为空')
    return
  }
  loading.value = true
  try {
    const res = await getStudentProblemDetail(Number(problemId))
    if (res.data.code === 200) {
      Object.assign(problem, res.data.data)
      // marked.parse might return a Promise in newer versions if async is enabled, 
      // but usually it returns string. Let's handle both.
      const parsed = marked.parse(problem.content || '')
      if (parsed instanceof Promise) {
        markedContent.value = await parsed
      } else {
        markedContent.value = parsed
      }
    } else {
      antMessage.error(res.data.msg || '获取题目详情失败')
    }
  } catch (error) {
    console.error('获取题目详情错误:', error)
    antMessage.error('获取题目详情失败')
  } finally {
    loading.value = false
  }
}

const getUserDetails = async () => {
  try {
    const res = await getUserInfo()
    if (res.data.code === 200) {
      Object.assign(userInfo, res.data.data)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

const createAiChatIdFunc = () => {
  chatId.value = createChatId('CODE')
}

const goBack = () => {
  router.go(-1)
}

const scrollToBottom = async () => {
  await nextTick()
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

const debugBtn = async () => {
  outputEditor?.setValue('')
  isDebugLoad.value = true
  isDebugDisabled.value = true
  
  const data = {
    code: monacoEditor?.getValue(),
    type: codeEditorSetting.language,
    input: inputEditor?.getValue()
  }
  
  try {
    const res = await debugCode(data)
    if (res.data.code === 200) {
      outputEditor?.setValue(res.data.data)
      antMessage.success('代码运行成功')
    } else {
      antMessage.error(res.data.msg || '代码运行错误')
      outputEditor?.setValue(res.data.msg)
    }
  } catch (error) {
    console.error(error)
    antMessage.error('代码运行失败')
  } finally {
    isDebugLoad.value = false
    isDebugDisabled.value = false
  }
}

const submitCode = async () => {
  isSubmitLoad.value = true
  isSubmitDisabled.value = true
  
  const formData = {
    code: monacoEditor?.getValue(),
    type: codeEditorSetting.language,
    problemId: Number(route.query.problemId),
    classId: Number(route.query.classId || 0),
    classProblemId: Number(route.query.classProblemId || 0)
  }
  
  try {
    const res = await runCode(formData)
    if (res.data.code === 200) {
      testResult.passCount = res.data.data.passCount || 0
      testResult.score = res.data.data.score || 0
      testResult.diff = res.data.data.diff || []
      
      activeTab.value = 'test'
      
      if (testResult.passCount === 4) {
        antMessage.success('恭喜！所有测试用例通过')
      } else {
        antMessage.warning(`通过 ${testResult.passCount}/4 个测试用例`)
      }
    } else {
      antMessage.error(res.data.msg || '代码提交失败')
    }
  } catch (error) {
    console.error(error)
    antMessage.error('代码提交失败')
  } finally {
    isSubmitLoad.value = false
    isSubmitDisabled.value = false
  }
}

const showDiffDialog = (diffs: string[]) => {
  currentDiffs.value = [...diffs]
  diffDialogVisible.value = true
  nextTick(() => {
    currentDiffs.value.forEach((diff, index) => {
      renderDiff2Html(diff, index)
    })
  })
}

const renderDiff2Html = (diff: string, index: number) => {
  const configuration = {
    drawFileList: false,
    matching: 'lines',
    highlight: true,
    outputFormat: 'side-by-side',
    renderNothingWhenEmpty: false,
    colorScheme: 'light',
    lineNumbers: false,
    matchWordsThreshold: 0.25,
    matchingMaxComparisons: 2500,
    maxLineSizeInBlockForComparison: 200,
    maxLineLengthHighlight: 10000,
    diffStyle: 'word'
  }
  
  const container = diffContainerRefs.value[index]
  if (container) {
    container.innerHTML = ''
    const diffHtml = new Diff2HtmlUI(container, diff, configuration)
    diffHtml.draw()
    diffHtml.highlightCode()
  }
}

const handleCloseDiffDialog = () => {
  diffDialogVisible.value = false
  currentDiffs.value = []
}

const toggleHistoryView = () => {
  asideActiveView.value = asideActiveView.value === 'problem' ? 'history' : 'problem'
}

const useHistoryCode = ({ code, language }: any) => {
  monacoEditor?.setValue(code)
  if (language !== codeEditorSetting.language) {
    codeEditorSetting.language = language
    updateLanguage(language)
  }
}

const getGradeColor = (grade: string) => {
  if (grade === 'EASY') return 'success'
  if (grade === 'GENERAL') return 'warning'
  return 'error'
}

const getGradeText = (grade: string) => {
  if (grade === 'EASY') return '简单'
  if (grade === 'GENERAL') return '中等'
  return '困难'
}

const toggleAiChat = (e?: MouseEvent) => {
  showAiChat.value = !showAiChat.value
  if (showAiChat.value) {
    if (e && e.currentTarget) {
      const target = e.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      chatPosition.left = rect.left
      chatPosition.top = rect.bottom + 10
    } else {
      // Fallback to center if no event
      const width = window.innerWidth
      const height = window.innerHeight
      chatPosition.left = width / 2 - 200
      chatPosition.top = height / 2 - 250
    }
  }
}

// Dragging logic for AI chat
const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragOffset.x = e.clientX - chatPosition.left
  dragOffset.y = e.clientY - chatPosition.top
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (isDragging.value) {
    chatPosition.left = e.clientX - dragOffset.x
    chatPosition.top = e.clientY - dragOffset.y
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Resizing logic for AI chat
const startChatResize = (e: MouseEvent) => {
  isChatResizing.value = true
  resizeStart.x = e.clientX
  resizeStart.y = e.clientY
  resizeStart.width = chatSize.width
  resizeStart.height = chatSize.height
  
  document.addEventListener('mousemove', handleChatResizeMove)
  document.addEventListener('mouseup', handleChatResizeUp)
  e.preventDefault() // Prevent text selection
}

const handleChatResizeMove = (e: MouseEvent) => {
  if (!isChatResizing.value) return
  
  const dx = e.clientX - resizeStart.x
  const dy = e.clientY - resizeStart.y
  
  // Minimum size constraints
  const newWidth = Math.max(300, resizeStart.width + dx)
  const newHeight = Math.max(400, resizeStart.height + dy)
  
  chatSize.width = newWidth
  chatSize.height = newHeight
}

const handleChatResizeUp = () => {
  isChatResizing.value = false
  document.removeEventListener('mousemove', handleChatResizeMove)
  document.removeEventListener('mouseup', handleChatResizeUp)
}

onMounted(() => {
  init()
  getProblemDetail()
  getUserDetails()
  createAiChatIdFunc()
})

onBeforeUnmount(() => {
  if (monacoEditor) monacoEditor.dispose()
  if (inputEditor) inputEditor.dispose()
  if (outputEditor) outputEditor.dispose()
})
</script>

<style scoped>
.code-page-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f5;
}

.code-header {
  background: #fff;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  height: 50px;
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.code-main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 8px;
  gap: 0; /* Gap handled by resizer */
}

.left-pane {
  height: 100%;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-pane {
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bottom-pane {
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Resizers */
.resizer-vertical {
  width: 8px;
  cursor: col-resize;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  z-index: 10;
}

.resizer-vertical:hover .resizer-handle,
.resizer-vertical:active .resizer-handle {
  background: #1890ff;
}

.resizer-handle {
  width: 2px;
  height: 30px;
  background: #d9d9d9;
  border-radius: 1px;
  transition: background 0.3s;
}

.resizer-horizontal {
  height: 8px;
  cursor: row-resize;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  z-index: 10;
}

.resizer-horizontal:hover .resizer-handle-horizontal,
.resizer-horizontal:active .resizer-handle-horizontal {
  background: #1890ff;
}

.resizer-handle-horizontal {
  width: 30px;
  height: 2px;
  background: #d9d9d9;
  border-radius: 1px;
  transition: background 0.3s;
}

/* Content Styles */
.problem-card-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  position: relative;
}

.problem-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.side-history-btn {
  position: absolute;
  right: 16px;
  top: 16px;
  cursor: pointer;
  font-size: 20px;
  color: #1890ff;
  z-index: 1;
}

.problem-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.problem-scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.editor-main {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 10px;
}

.monaco-editor-container {
  width: 100%;
  height: 100%;
}

.editor-footer {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 10px;
}

.footer-tabs {
  height: 100%;
}

:deep(.ant-tabs-content) {
  height: 100%;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
  overflow: hidden;
}

.test-result-panel {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 40px;
}

.debug-editor {
  height: calc(100% - 30px);
  border: 1px solid #eee;
  min-height: 100px;
}

.footer-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.8);
  padding: 5px;
  border-radius: 4px;
}

/* AI Chat Styles */
.ai-chat-window {
  position: fixed;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.ai-chat-wrapper {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 15px;
  height: 15px;
  cursor: nwse-resize;
  z-index: 1001;
  background: linear-gradient(135deg, transparent 50%, #ccc 50%);
  border-bottom-right-radius: 8px;
}

.ai-chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 10px;
  border-bottom: 1px solid #eee;
  font-weight: bold;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}

.close-icon {
  cursor: pointer;
  color: #999;
  transition: color 0.3s;
}

.close-icon:hover {
  color: #333;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.chat-input {
  padding: 10px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
}

.chat-message {
  margin-bottom: 10px;
  display: flex;
  gap: 10px;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.message-content {
  background: #f0f2f5;
  padding: 8px 12px;
  border-radius: 4px;
  max-width: 80%;
}

.chat-message.user .message-content {
  background: #e6f7ff;
}

/* Markdown styles */
.markdown-body {
  font-size: 14px;
}

/* Diff styles */
.test-cases-container {
  max-height: 600px;
  overflow-y: auto;
}

.test-case-diff {
  margin-bottom: 20px;
}

.test-case-header {
  font-weight: bold;
  margin-bottom: 10px;
  padding: 5px 10px;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>
