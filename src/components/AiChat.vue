<template>
  <div class="ai-chat-component">
    <!-- 
      Chat Messages Area 
      - Handles scrolling
      - Displays welcome screen if no messages
      - Renders user and assistant messages
    -->
    <div class="chat-messages" ref="messageContainer" @click="handleMessageClick">
      <!-- Welcome Screen for CHAT scene (Home View) -->
      <div v-if="messages.length === 0 && scene === 'CHAT'" class="welcome-screen">
        <div class="welcome-icon">
          <RobotOutlined />
        </div>
        <h2>你好，我是 AI 编程助手</h2>
        <p>我可以帮你解释代码、查找错误、生成代码片段或回答技术问题。</p>
        <div class="suggestion-chips">
          <div class="chip" @click="useSuggestion('如何使用 Vue 3 的 Composition API？')">Vue 3 Composition API</div>
          <div class="chip" @click="useSuggestion('解释一下 Java 中的多态性')">Java 多态性</div>
          <div class="chip" @click="useSuggestion('写一个快速排序算法')">快速排序算法</div>
        </div>
      </div>

      <!-- Message List -->
      <template v-else>
        <template v-for="(message, index) in messages" :key="index">
          <div :class="['chat-message', message.role]">
            <!-- User Message -->
            <template v-if="message.role === 'user'">
              <div class="avatar user-avatar">
                <a-avatar :size="36" :src="userInfo?.profilePicture">
                  <template #icon><UserOutlined /></template>
                </a-avatar>
              </div>
              <div class="message-content-wrapper">
                <div class="message-content markdown-body" v-html="message.renderedContent || message.content"></div>
                <div class="message-actions">
                  <a-tooltip title="复制消息">
                    <CopyOutlined class="action-icon" @click="copyMessage(message.content)" />
                  </a-tooltip>
                </div>
              </div>
            </template>
            
            <!-- Assistant Message -->
            <template v-else>
              <div class="avatar ai-avatar">
                <RobotOutlined />
              </div>
              <div class="message-content-wrapper">
                <div class="message-content markdown-body" v-html="message.renderedContent || message.content"></div>
                <div class="message-actions">
                  <a-tooltip title="复制消息">
                    <CopyOutlined class="action-icon" @click="copyMessage(message.content)" />
                  </a-tooltip>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Loading/Typing Indicator -->
        <div v-if="loading" class="chat-message assistant">
          <div class="avatar ai-avatar">
            <RobotOutlined />
          </div>
          <div class="message-content-wrapper">
            <div class="message-content typing-indicator-wrapper">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    
    <!-- 
      Input Area 
      - Textarea for input
      - Send button
      - Future: Add model selector or "Deep Think" toggle here
    -->
    <div class="chat-input-area">
      <div class="input-wrapper">
        <a-textarea
          v-model:value="inputMessage"
          :rows="1"
          :auto-size="{ minRows: 1, maxRows: 5 }"
          placeholder="输入您的问题... (Shift + Enter 换行)"
          @keydown.enter="handleChatEnter"
          :disabled="loading"
          class="custom-textarea"
        />
        <a-button 
          type="primary" 
          shape="circle" 
          class="send-btn"
          :disabled="!inputMessage.trim() || loading"
          @click="handleSendMessage" 
          :loading="loading"
        >
          <template #icon><SendOutlined /></template>
        </a-button>
      </div>
      <div class="input-footer">
        AI 生成的内容可能不准确，请仔细核对。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import { UserOutlined, RobotOutlined, SendOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { Marked } from 'marked'
import katex from 'katex'
import hljs from 'highlight.js'
import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/atom-one-dark.css'

const props = defineProps<{
  chatId: string
  scene: 'CHAT' | 'CODE'
  context?: any
  userInfo?: any
  initialMessages?: any[]
}>()

const emit = defineEmits(['update:chatId', 'message-sent', 'title-updated'])

const messages = ref<any[]>([])
const inputMessage = ref('')
const loading = ref(false)
const messageContainer = ref<HTMLElement | null>(null)

// --- Methods ---

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

// 创建 Marked 实例，避免全局污染
const m = new Marked({
  gfm: true,
  breaks: true
})

// 配置渲染器
const renderer = {
  code({ text, lang }: { text: string, lang?: string }) {
    const validLang = !!(lang && hljs.getLanguage(lang))
    const highlighted = validLang
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text).value
    
    const codeContent = encodeURIComponent(text)
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span class="code-lang">${lang || 'text'}</span>
          <button class="copy-btn" data-code="${codeContent}">复制</button>
        </div>
        <pre><code class="hljs ${lang || ''}">${highlighted}</code></pre>
      </div>
    `
  }
}

// KaTeX 扩展
const katexExtension = {
  name: 'katex',
  level: 'inline',
  start(src: string) { return src.indexOf('$'); },
  tokenizer(src: string) {
    // 块级公式 $$...$$
    const blockMatch = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (blockMatch) {
      return {
        type: 'katex',
        raw: blockMatch[0],
        text: blockMatch[1].trim(),
        displayMode: true
      };
    }
    // 行内公式 $...$
    const inlineMatch = /^\$([^$\n]+)\$/.exec(src);
    if (inlineMatch) {
      return {
        type: 'katex',
        raw: inlineMatch[0],
        text: inlineMatch[1].trim(),
        displayMode: false
      };
    }
  },
  renderer(token: any) {
    try {
      return katex.renderToString(token.text, { displayMode: token.displayMode });
    } catch (err) {
      return token.raw;
    }
  }
};

m.use({ 
  renderer,
  extensions: [katexExtension]
})

watch(() => props.initialMessages, (newVal) => {
  if (newVal) {
    messages.value = newVal.map(msg => ({
      ...msg,
      renderedContent: renderMarkdownSync(msg.content)
    }))
    scrollToBottom()
  }
}, { immediate: true })

const renderMarkdownSync = (content: string) => {
  try {
    if (!content) return ''
    return m.parse(String(content)) as string
  } catch (error) {
    return content
  }
}

const renderMarkdown = async (content: string) => {
  try {
    if (!content) return ''
    const parsed = m.parse(String(content))
    if (parsed instanceof Promise) {
      return await parsed
    }
    return parsed
  } catch (error) {
    return content
  }
}

const handleChatEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

const useSuggestion = (text: string) => {
  inputMessage.value = text
  handleSendMessage()
}

const handleSendMessage = async () => {
  if (!inputMessage.value.trim()) {
    antMessage.warning('请输入消息')
    return
  }
  
  const content = inputMessage.value
  await sendMessage(content)
}

// Copy entire message content
const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content).then(() => {
    antMessage.success('消息已复制')
  }).catch(() => {
    antMessage.error('复制失败')
  })
}

// Exposed method to send message programmatically (e.g., from Context Menu)
const sendMessage = async (content: string) => {
  messages.value.push({
    role: 'user',
    content: content,
    renderedContent: await renderMarkdown(content)
  })
  
  inputMessage.value = ''
  loading.value = true
  scrollToBottom()

  try {
    messages.value.push({
      role: 'assistant',
      content: '',
      renderedContent: ''
    })
    
    const token = window.localStorage.getItem('token') || window.sessionStorage.getItem('token')
    
    const body: any = {
      type: props.scene,
      chatId: props.chatId,
      prompt: content,
      thinking: true,
      search: true,
      ...props.context
    }

    // Determine API endpoint based on scene
    const url = props.scene === 'CHAT' ? '/api/user/ai/chat' : '/api/user/ai/questionAnswer'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token || '',
      },
      body: JSON.stringify(body)
    })

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get reader')
    
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let currentEvent = ''
    let isReading = true
    
    while (isReading) {
      const { done, value } = await reader.read()
      if (done) {
        isReading = false
        break
      }
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
          continue
        }

        if (line.startsWith('data:')) {
          try {
            const jsonData = JSON.parse(line.slice(5))
            if (currentEvent === 'title') {
              if (jsonData.code === 200 && jsonData.data) {
                emit('title-updated', { chatId: props.chatId, title: String(jsonData.data) })
              }
              // after handling title, reset event to avoid consuming subsequent data
              currentEvent = ''
              continue
            }

            if (jsonData.code === 200 && jsonData.data !== null) {
              const lastMessage = messages.value[messages.value.length - 1]
              lastMessage.content += jsonData.data
              // Update rendered content
              const html = await renderMarkdown(lastMessage.content)
              lastMessage.renderedContent = html
              await scrollToBottom()
            }
          } catch (error) {
            console.error('Error parsing message:', error)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error)
    antMessage.error('发送消息失败')
  } finally {
    loading.value = false
  }
}

const handleMessageClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('copy-btn')) {
    const code = decodeURIComponent(target.getAttribute('data-code') || '')
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        const originalText = target.innerText
        target.innerText = '已复制'
        target.classList.add('copied')
        setTimeout(() => {
          target.innerText = '复制'
          target.classList.remove('copied')
        }, 2000)
      }).catch(() => {
        antMessage.error('复制失败')
      })
    }
  }
}

defineExpose({
  sendMessage,
  scrollToBottom
})
</script>

<style scoped>
.ai-chat-component {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #f8f9fa;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Message Layout */
.chat-message {
  display: flex;
  gap: 12px;
  max-width: 100%;
}

.chat-message.user {
  flex-direction: row-reverse;
}

/* Avatars */
.avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-avatar {
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 50%;
  color: #fff;
  font-size: 20px;
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.2);
}

/* Message Bubbles */
.message-content-wrapper {
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-content-wrapper:hover .message-actions {
  opacity: 1;
}

.action-icon {
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-icon:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #1890ff;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.chat-message.user .message-content {
  background-color: #1890ff;
  color: #fff;
  border-top-right-radius: 2px;
}

.chat-message.assistant .message-content {
  background-color: #fff;
  color: #333;
  border-top-left-radius: 2px;
}

/* Markdown Styles Override for User Bubble */
.chat-message.user .markdown-body {
  color: #fff !important;
}
.chat-message.user .markdown-body p {
  margin-bottom: 0;
}
.chat-message.user .markdown-body code {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.chat-message.user .markdown-body pre {
  background-color: rgba(0, 0, 0, 0.2);
}

/* Typing Indicator */
.typing-indicator-wrapper {
  background-color: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  border-top-left-radius: 2px;
  display: inline-block;
}

.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #999;
  border-radius: 50%;
  margin: 0 2px;
  animation: typing 1s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Input Area */
.chat-input-area {
  padding: 16px 20px;
  background: #fff;
  border-top: 1px solid #eee;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.02);
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 24px;
  border: 1px solid transparent;
  transition: all 0.3s;
}

.input-wrapper:focus-within {
  background: #fff;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.custom-textarea {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  padding: 4px 0;
  resize: none;
}

.send-btn {
  flex-shrink: 0;
}

.input-footer {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

/* Code Block Styles */
:deep(.code-block-wrapper) {
  margin: 12px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  background: #282c34;
}

:deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #21252b;
  border-bottom: 1px solid #333;
  font-size: 12px;
  color: #abb2bf;
}

:deep(.copy-btn) {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #abb2bf;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

:deep(.copy-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

:deep(.copy-btn.copied) {
  color: #52c41a;
}

:deep(.markdown-body pre) {
  margin: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding: 12px;
}

/* Welcome Screen */
.welcome-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #333;
  padding-bottom: 50px;
}

.welcome-icon {
  font-size: 56px;
  color: #1890ff;
  margin-bottom: 20px;
  background: #e6f7ff;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-screen h2 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 10px;
}

.welcome-screen p {
  color: #666;
  margin-bottom: 30px;
}

.suggestion-chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 600px;
}

.chip {
  padding: 8px 16px;
  background-color: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.chip:hover {
  background-color: #e6f7ff;
  color: #1890ff;
  border-color: #1890ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(24, 144, 255, 0.15);
}
</style>