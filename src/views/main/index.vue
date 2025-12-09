<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { message } from 'ant-design-vue'
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  UserOutlined, 
  LogoutOutlined,
  TeamOutlined,
  FormOutlined,
  RobotOutlined,
  KeyOutlined
} from '@ant-design/icons-vue'
import { getUserInfo } from '@/api/user'

const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)
const selectedKeys = ref<string[]>([])
const userInfo = ref({
  profilePicture: '',
  name: ''
})

onMounted(() => {
  // Initialize active menu
  const path = router.currentRoute.value.path
  if (path.includes('myClass')) selectedKeys.value = ['myClass']
  else if (path.includes('classManage')) selectedKeys.value = ['classManage']
  else if (path.includes('problemManage')) selectedKeys.value = ['problemManage']
  else if (path.includes('chat')) selectedKeys.value = ['chat']
  else if (path.includes('passkey')) selectedKeys.value = ['passkey']
  else if (path.includes('personalDetails')) selectedKeys.value = ['personalDetails']

  // Redirect based on role if at root
  if (path === '/') {
    if (userStore.userRole === 'STUDENT') {
      router.push('/myClass')
      selectedKeys.value = ['myClass']
    } else if (userStore.userRole === 'TEACHER') {
      router.push('/classManage')
      selectedKeys.value = ['classManage']
    }
  }

  getUserDetails()
})

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const handleLogout = () => {
  window.localStorage.removeItem('token')
  window.sessionStorage.removeItem('token')
  router.push('/login')
  message.success('已退出登录')
}

const getUserDetails = async () => {
  try {
    const res = await getUserInfo()
    if (res.data.code === 200) {
      userInfo.value = res.data.data
      userStore.setName(res.data.data.name)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}
</script>

<template>
  <a-layout class="main-layout">
    <a-layout-sider v-model:collapsed="isCollapse" :trigger="null" collapsible class="sider">
      <div class="logo">
        <img src="../../assets/ecode.png" alt="logo" v-if="!isCollapse" />
        <span v-if="!isCollapse">ecode</span>
        <img src="../../assets/ecode.png" alt="logo" v-else class="mini-logo" />
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
        <a-menu-item key="personalDetails" @click="router.push('/personalDetails')">
          <UserOutlined />
          <span>个人信息</span>
        </a-menu-item>
        
        <a-menu-item v-if="userStore.userRole === 'STUDENT'" key="myClass" @click="router.push('/myClass')">
          <TeamOutlined />
          <span>我的班级</span>
        </a-menu-item>
        
        <a-menu-item v-if="userStore.userRole === 'TEACHER'" key="classManage" @click="router.push('/classManage')">
          <TeamOutlined />
          <span>班级管理</span>
        </a-menu-item>
        
        <a-menu-item v-if="userStore.userRole === 'TEACHER'" key="problemManage" @click="router.push('/problemManage')">
          <FormOutlined />
          <span>题目管理</span>
        </a-menu-item>
        
        <a-menu-item key="chat" @click="router.push('/chat')">
          <RobotOutlined />
          <span>AI 助手</span>
        </a-menu-item>
        
        <a-menu-item key="passkey" @click="router.push('/passkey')">
          <KeyOutlined />
          <span>通行密钥</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    
    <a-layout>
      <a-layout-header class="header">
        <div class="header-left">
          <menu-unfold-outlined
            v-if="isCollapse"
            class="trigger"
            @click="toggleCollapse"
          />
          <menu-fold-outlined v-else class="trigger" @click="toggleCollapse" />
          <span class="page-title">ecode编程实践平台</span>
        </div>
        
        <div class="header-right">
          <a-dropdown>
            <div class="user-info">
              <a-avatar :src="userInfo.profilePicture" icon="user" />
              <span class="username">{{ userInfo.name || userStore.username }}</span>
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="handleLogout">
                  <LogoutOutlined /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      
      <a-layout-content class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
}

.sider {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, 0.05);
}

.logo {
  height: 64px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #001529;
  color: white;
  font-size: 20px;
  font-weight: bold;
  overflow: hidden;
}

.logo img {
  height: 32px;
  margin-right: 8px;
}

.logo .mini-logo {
  margin-right: 0;
}

.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 1;
}

.header-left {
  display: flex;
  align-items: center;
}

.trigger {
  font-size: 18px;
  line-height: 64px;
  padding: 0 24px;
  cursor: pointer;
  transition: color 0.3s;
}

.trigger:hover {
  color: #1890ff;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  margin-left: 16px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 12px;
  height: 64px;
  transition: all 0.3s;
}

.user-info:hover {
  background: rgba(0, 0, 0, 0.025);
}

.username {
  margin-left: 8px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.85);
}

.content {
  /* Removed padding and background to allow child views to control their layout */
  /* margin: 24px 16px; */
  /* padding: 24px; */
  /* background: #fff; */
  min-height: 280px;
  /* border-radius: 4px; */
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
