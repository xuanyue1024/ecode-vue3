<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header style="background: #fff; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1); z-index: 1;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <a-button type="text" @click="router.go(-1)">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>
        <span style="font-size: 18px; font-weight: 600;">班级详情</span>
      </div>
      <div>
        <a-dropdown>
          <a-space style="cursor: pointer">
            <a-avatar :src="userStore.profilePicture" :size="32" style="background-color: #1890ff">
              <template #icon><UserOutlined /></template>
            </a-avatar>
            <span>{{ userStore.name }}</span>
          </a-space>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="handleLogout">
                <LogoutOutlined /> 退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>

    <a-layout>
      <a-layout-sider width="250" theme="light" style="border-right: 1px solid #f0f0f0;">
        <div style="padding: 24px; border-bottom: 1px solid #f0f0f0;">
          <a-typography-title :level="4" style="margin-bottom: 8px">{{ className }}</a-typography-title>
          <a-typography-text type="secondary">
            <UserOutlined /> 教师：{{ teacherName }}
          </a-typography-text>
        </div>
        <!-- Menu Slot -->
        <slot name="menu"></slot>
      </a-layout-sider>

      <a-layout-content style="padding: 24px; overflow-y: auto; height: calc(100vh - 64px);">
        <!-- Content Slot -->
        <slot></slot>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeftOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

defineProps<{
  className: string
  teacherName: string
}>()

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>
