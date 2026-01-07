<template>
  <div class="chat-layout">
    <!-- Sidebar -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <a-button type="primary" block class="new-chat-btn" @click="createNewChat">
          <template #icon><PlusOutlined /></template>
          新对话
        </a-button>
      </div>
      
      <div class="chat-list">
        <div class="list-title">近期对话</div>
        <div v-if="chatList.length === 0" class="empty-list">
          <MessageOutlined />
          <span>暂无历史对话</span>
        </div>
        <div 
          v-for="(item, index) in chatList" 
          :key="item.chgatId"
          class="chat-item"
          :class="{ active: item.chgatId === chatId }"
          @click="switchChat(item.chgatId)"
        >
          <div class="chat-item-icon">
            <MessageOutlined />
          </div>
          <div class="chat-item-content">
            <div class="chat-item-title">{{ item.title || ('会话 ' + (chatList.length - index)) }}</div>
            <div class="chat-item-time">{{ formatDate(item.createTime) }}</div>
          </div>
          <div class="chat-item-actions">
            <DeleteOutlined class="delete-icon" @click.stop="confirmDeleteChat(item.chgatId)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="chat-main">
      <div class="chat-header">
        <div class="header-info">
          <div class="ai-avatar">
            <RobotOutlined />
          </div>
          <div class="header-text">
            <div class="header-title">AI 智能助手</div>
            <div class="header-subtitle">基于大语言模型的编程辅助工具</div>
          </div>
        </div>
        <a-tooltip title="清空当前对话">
          <a-button type="text" shape="circle" @click="confirmCreateNewChat">
            <template #icon><ReloadOutlined /></template>
          </a-button>
        </a-tooltip>
      </div>

      <div class="chat-content-wrapper" style="flex: 1; overflow: hidden;">
        <AiChat 
          :chatId="chatId" 
          scene="CHAT" 
          :userInfo="userInfo"
          :initialMessages="messages"
          @update:chatId="handleChatIdUpdate"
          @title-updated="handleTitleUpdated"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { message as antMessage, Modal } from 'ant-design-vue'
import { 
  PlusOutlined, 
  MessageOutlined, 
  DeleteOutlined, 
  RobotOutlined, 
  ReloadOutlined
} from '@ant-design/icons-vue'
import { getUserInfo } from '@/api/user'
import { createChatId, getChatHistory, getChatMessages, deleteChatHistory } from '@/api/ai'
import AiChat from '@/components/AiChat.vue'
import 'github-markdown-css/github-markdown.css'

const chatId = ref('')
const messages = ref<any[]>([])
const userInfo = reactive({
  profilePicture: ''
})
const chatList = ref<any[]>([])
const isLoadingHistory = ref(false)

const handleChatIdUpdate = (newId: string) => {
  chatId.value = newId
  localStorage.setItem('chatId', newId)
}

const handleTitleUpdated = (payload: { chatId: string, title: string }) => {
  try {
    const { chatId: id, title } = payload as any
    const found = chatList.value.find(c => c.chgatId === id)
    if (found) {
      found.title = title
    } else {
      // 如果本地列表中没有，刷新列表以获取最新数据
      getChatList()
    }
  } catch (e) {
    console.error('处理标题更新失败:', e)
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

const getChatList = async () => {
  try {
    const res = await getChatHistory('CHAT')
    if (res.data.code === 200) {
      chatList.value = res.data.data || []
      if (chatList.value.length > 0 && !chatId.value) {
        const storedChatId = localStorage.getItem('chatId')
        if (storedChatId && chatList.value.some(chat => chat.chgatId === storedChatId)) {
          chatId.value = storedChatId
        } else {
          chatId.value = chatList.value[0].chgatId
        }
        localStorage.setItem('chatId', chatId.value)
        loadChatHistory(chatId.value)
      } else if (chatList.value.length === 0) {
        createAiChatId()
      }
    }
  } catch (error) {
    console.error('获取会话列表失败:', error)
    antMessage.error('获取会话列表失败')
  }
}

const loadChatHistory = async (id: string) => {
  if (!id) return
  
  isLoadingHistory.value = true
  messages.value = []
  
  try {
    const res = await getChatMessages('CHAT', id)
    if (res.data.code === 200) {
      messages.value = res.data.data || []
    }
  } catch (error) {
    console.error('获取会话历史失败:', error)
    antMessage.error('获取会话历史失败')
  } finally {
    isLoadingHistory.value = false
  }
}

const switchChat = async (id: string) => {
  if (chatId.value === id || isLoadingHistory.value) return
  
  chatId.value = id
  localStorage.setItem('chatId', id)
  await loadChatHistory(id)
}

const confirmCreateNewChat = () => {
  if (messages.value.length === 0) return
  
  Modal.confirm({
    title: '开启新对话',
    content: '是否开始一个新的对话？',
    okText: '确定',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      createNewChat()
    }
  })
}

const createNewChat = async () => {
  await createAiChatId()
  messages.value = []
  antMessage.success('已开始新对话')
  getChatList()
}

const createAiChatId = () => {
  const id = createChatId('CHAT')
  chatId.value = id
  window.localStorage.setItem('chatId', id)
}

const confirmDeleteChat = (id: string) => {
  Modal.confirm({
    title: '删除会话',
    content: '确定要删除这个会话吗？此操作无法恢复',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    centered: true,
    onOk: () => {
      deleteChat(id)
    }
  })
}

const deleteChat = async (id: string) => {
  try {
    const res = await deleteChatHistory('CHAT', id)
    if (res.data.code === 200) {
      antMessage.success('删除成功')
      
      if (id === chatId.value) {
        messages.value = []
        const chatListRes = await getChatHistory('CHAT')
        if (chatListRes.data.code === 200) {
          chatList.value = chatListRes.data.data || []
          
          if (chatList.value.length > 0) {
            chatId.value = chatList.value[0].chgatId
            localStorage.setItem('chatId', chatId.value)
            await loadChatHistory(chatId.value)
          } else {
            await createAiChatId()
          }
        }
      } else {
        getChatList()
      }
    } else {
      antMessage.error('删除失败')
    }
  } catch (error) {
    console.error('删除会话失败:', error)
    antMessage.error('删除会话失败')
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date >= today) {
    return formatTime(date)
  }
  else if (date >= yesterday) {
    return '昨天 ' + formatTime(date)
  }
  else {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
}

const formatTime = (date: Date) => {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`
}

onMounted(() => {
  getUserDetails()
  getChatList()
})
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: calc(100vh - 64px);
  background-color: #fff;
  overflow: hidden;
}

/* Sidebar Styles */
.chat-sidebar {
  width: 260px;
  background-color: #f9f9f9;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
}

.new-chat-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.2);
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 16px;
}

.list-title {
  font-size: 12px;
  color: #999;
  margin: 8px 4px;
  padding-left: 8px;
}

.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #ccc;
  gap: 8px;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  position: relative;
}

.chat-item:hover {
  background-color: #e6e6e6;
}

.chat-item.active {
  background-color: #e6f7ff;
  color: #1890ff;
}

.chat-item-icon {
  margin-right: 12px;
  font-size: 16px;
  opacity: 0.7;
}

.chat-item-content {
  flex: 1;
  overflow: hidden;
}

.chat-item-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-time {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.chat-item-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.chat-item:hover .chat-item-actions {
  opacity: 1;
}

.delete-icon {
  color: #ff4d4f;
  padding: 4px;
  border-radius: 4px;
}

.delete-icon:hover {
  background-color: rgba(255, 77, 79, 0.1);
}

/* Main Chat Area Styles */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  position: relative;
}

.chat-header {
  height: 60px;
  padding: 0 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  z-index: 10;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 11px;
  color: #999;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #fff;
}

/* Welcome Screen */
.welcome-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #333;
  padding-bottom: 100px;
}

.welcome-icon {
  font-size: 64px;
  color: #1890ff;
  margin-bottom: 24px;
  background: #e6f7ff;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-screen h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
}

.welcome-screen p {
  color: #666;
  margin-bottom: 32px;
}

.suggestion-chips {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.chip {
  padding: 8px 16px;
  background-color: #f5f5f5;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.chip:hover {
  background-color: #e6f7ff;
  color: #1890ff;
  border-color: #bae7ff;
}

/* Message List */
.message-list {
  max-width: 800px;
  margin: 0 auto;
}

.message-wrapper {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.ai-avatar-small {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.message-content {
  max-width: 85%;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  position: relative;
}

.user .message-bubble {
  background-color: #1890ff;
  color: #fff;
  border-top-right-radius: 2px;
}

.assistant .message-bubble {
  background-color: #f5f5f5;
  color: #333;
  border-top-left-radius: 2px;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 16px 20px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background-color: #999;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Input Area */
.chat-input-area {
  padding: 24px;
  background-color: #fff;
  /* border-top: 1px solid #f0f0f0; */
}

.input-container {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 24px;
  padding: 8px 16px 8px 20px;
  display: flex;
  align-items: flex-end;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
}

.input-container:focus-within {
  border-color: #1890ff;
  box-shadow: 0 2px 12px rgba(24, 144, 255, 0.15);
}

.custom-textarea {
  border: none !important;
  box-shadow: none !important;
  padding: 8px 0;
  resize: none;
  background: transparent;
}

.custom-textarea:focus {
  box-shadow: none;
}

.send-btn {
  margin-left: 8px;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.input-footer {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 12px;
}

/* Markdown Overrides for User Bubble */
.user .markdown-body {
  color: #fff;
}

.user .markdown-body p {
  margin-bottom: 0;
}

.user .markdown-body code {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.user .markdown-body pre {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
