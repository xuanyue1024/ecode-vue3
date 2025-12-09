<template>
  <div class="personal-details-container">
    <a-card :bordered="false" class="main-card">
      <template #title>
        <a-space>
          <UserOutlined />
          <span>个人信息</span>
        </a-space>
      </template>
      
      <a-row :gutter="48">
        <!-- 左侧头像区域 -->
        <a-col :xs="24" :md="8" :lg="6" style="text-align: center; margin-bottom: 24px;">
          <a-upload
            name="file"
            list-type="picture-card"
            class="avatar-uploader"
            :show-upload-list="false"
            action="/api/open/upload"
            :before-upload="beforeAvatarUpload"
            @change="handleAvatarChange"
          >
            <div v-if="avatarUrl" class="avatar-wrapper">
              <img :src="avatarUrl" class="avatar" alt="avatar" />
              <div class="avatar-hover-mask">
                <CameraOutlined />
                <span>更换头像</span>
              </div>
            </div>
            <div v-else>
              <PlusOutlined />
              <div class="ant-upload-text">上传头像</div>
            </div>
          </a-upload>
          <div class="upload-tip">支持 jpg、png 格式大小 2MB 以内的图片</div>
        </a-col>

        <!-- 右侧表单区域 -->
        <a-col :xs="24" :md="16" :lg="12">
          <a-form
            :model="userInfo"
            :label-col="{ span: 6 }"
            :wrapper-col="{ span: 18 }"
            ref="formRef"
            :rules="rules"
          >
            <a-form-item label="用户名">
              <a-input v-model:value="userInfo.username" disabled />
            </a-form-item>

            <a-form-item label="角色">
              <a-input v-model:value="userInfo.role" disabled />
            </a-form-item>

            <a-form-item label="昵称" name="name">
              <a-input v-model:value="userInfo.name" placeholder="请输入昵称" />
            </a-form-item>

            <a-form-item label="性别">
              <a-radio-group v-model:value="userInfo.sex">
                <a-radio value="MALE">男</a-radio>
                <a-radio value="FEMALE">女</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="电话" name="phone">
              <a-input v-model:value="userInfo.phone" placeholder="请输入电话号码" />
            </a-form-item>

            <a-form-item label="地址" name="address">
              <a-input v-model:value="userInfo.address" placeholder="请输入地址" />
            </a-form-item>

            <a-form-item label="出生日期">
              <a-date-picker
                v-model:value="userInfo.birthDate"
                placeholder="选择出生日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item label="邮箱" name="email">
              <a-input-group compact>
                <a-input v-model:value="userInfo.email" style="width: calc(100% - 60px)" disabled />
                <a-button type="primary" @click="openEmailDialog" style="width: 60px">修改</a-button>
              </a-input-group>
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 6, span: 18 }">
              <a-space>
                <a-button @click="cancelEdit">取 消</a-button>
                <a-button type="primary" @click="saveInfo">保 存</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-col>
      </a-row>
    </a-card>

    <!-- 修改邮箱弹窗 -->
    <a-modal
      title="修改邮箱"
      v-model:open="emailDialogVisible"
      width="400px"
      @ok="confirmEmailChange"
      @cancel="emailDialogVisible = false"
    >
      <a-form :model="emailForm" :rules="emailRules" ref="emailFormRef" layout="vertical">
        <a-form-item name="newEmail" label="新邮箱">
          <a-input v-model:value="emailForm.newEmail" placeholder="请输入新邮箱地址">
            <template #prefix><MailOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="code" label="验证码">
          <a-input-group compact>
            <a-input v-model:value="emailForm.code" placeholder="请输入验证码" style="width: calc(100% - 110px)">
              <template #prefix><SafetyCertificateOutlined /></template>
            </a-input>
            <a-button 
              type="primary" 
              @click="sendEmailCode" 
              :loading="isEmailSending"
              :disabled="isEmailSending"
              style="width: 110px"
            >
              {{ sendButtonText }}
            </a-button>
          </a-input-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { UserOutlined, CameraOutlined, PlusOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { getUserInfo, updateUserInfo, getEmailCode } from '@/api/user'
import type { UploadChangeParam, UploadProps } from 'ant-design-vue'

const userInfo = reactive({
  id: null,
  username: '',
  role: '',
  email: '',
  status: '',
  name: '',
  profilePicture: '',
  phone: '',
  sex: 'MALE',
  address: '',
  score: 0,
  birthDate: '',
  createTime: '',
  updateTime: ''
})

const avatarUrl = ref('')
const emailDialogVisible = ref(false)
const isEmailSending = ref(false)
const countdown = ref(60)
const timer = ref<any>(null)
const emailForm = reactive({
  newEmail: '',
  code: ''
})

const formRef = ref()
const emailFormRef = ref()

const rules = {
  name: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }
  ]
}

const emailRules = {
  newEmail: [
    { required: true, message: '请输入新邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码长度应为6位', trigger: 'blur' }
  ]
}

const sendButtonText = computed(() => {
  return isEmailSending.value ? `${countdown.value}s后重试` : '发送验证码'
})

const getUserDetails = async () => {
  try {
    const res = await getUserInfo()
    if (res.data.code === 200) {
      const data = res.data.data
      Object.assign(userInfo, data)
      avatarUrl.value = data.profilePicture
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    message.error('获取用户信息失败')
  }
}

const handleAvatarChange = (info: UploadChangeParam) => {
  if (info.file.status === 'done') {
    const res = info.file.response
    if (res.code === 200) {
      avatarUrl.value = res.data
      updateAvatar(res.data)
    } else {
      message.error(res.msg || '上传头像失败')
    }
  } else if (info.file.status === 'error') {
    message.error('上传头像失败')
  }
}

const updateAvatar = async (url: string) => {
  try {
    const updateData = {
      profilePicture: url
    }
    const updateRes = await updateUserInfo(updateData)
    if (updateRes.data.code === 200) {
      message.success('头像更新成功')
      getUserDetails()
    } else {
      message.error(updateRes.data.msg || '更新头像失败')
    }
  } catch (error) {
    console.error('更新头像失败:', error)
    message.error('更新头像失败')
  }
}

const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
  const isJPG = file.type === 'image/jpeg' || file.type === 'image/png'
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isJPG) {
    message.error('上传头像图片只能是 JPG/PNG 格式!')
  }
  if (!isLt2M) {
    message.error('上传头像图片大小不能超过 2MB!')
  }
  return isJPG && isLt2M
}

const openEmailDialog = () => {
  emailDialogVisible.value = true
  emailForm.newEmail = ''
  emailForm.code = ''
}

const sendEmailCode = async () => {
  if (!emailForm.newEmail) {
    return message.warning('请先输入新邮箱地址')
  }
  isEmailSending.value = true
  countdown.value = 60
  timer.value = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      isEmailSending.value = false
      clearInterval(timer.value)
    }
  }, 1000)
  
  try {
    const res = await getEmailCode(emailForm.newEmail)
    if (res.data.code === 200) {
      message.success('验证码已发送到邮箱')
    } else {
      message.error(res.data.msg || '发送验证码失败')
      isEmailSending.value = false
      clearInterval(timer.value)
    }
  } catch (error) {
    console.error('发送验证码失败:', error)
    message.error('发送验证码失败')
    isEmailSending.value = false
    clearInterval(timer.value)
  }
}

const confirmEmailChange = async () => {
  try {
    await emailFormRef.value.validate()
    const updateData = {
      email: emailForm.newEmail,
    }
    const res = await updateUserInfo(updateData as any)
    if (res.data.code === 200) {
      userInfo.email = emailForm.newEmail
      emailDialogVisible.value = false
      message.success('邮箱修改成功')
      getUserDetails()
    } else {
      message.error(res.data.msg || '修改邮箱失败')
    }
  } catch (error) {
    console.error('修改邮箱失败:', error)
  }
}

const saveInfo = async () => {
  try {
    await formRef.value.validate()
    const updateData = {
      name: userInfo.name,
      sex: userInfo.sex as 'MALE' | 'FEMALE',
      birthDate: userInfo.birthDate || undefined,
      address: userInfo.address || '',
      phone: userInfo.phone || undefined
    }
    
    const res = await updateUserInfo(updateData)
    if (res.data.code === 200) {
      message.success('个人信息保存成功')
      getUserDetails()
    } else {
      message.error(res.data.msg || '保存失败')
    }
  } catch (error) {
    console.error('保存用户信息失败:', error)
  }
}

const cancelEdit = () => {
  getUserDetails()
  message.info('已取消修改')
}

onMounted(() => {
  getUserDetails()
})

onBeforeUnmount(() => {
  if (timer.value) {
    clearInterval(timer.value)
  }
})
</script>

<style scoped>
.personal-details-container {
  padding: 24px;
  background: #f0f2f5;
  min-height: 100%;
}

.main-card {
  border-radius: 8px;
}

.avatar-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-hover-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  opacity: 0;
  transition: opacity 0.3s;
}

.avatar-wrapper:hover .avatar-hover-mask {
  opacity: 1;
}

.avatar-hover-mask .anticon {
  font-size: 24px;
  margin-bottom: 8px;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 10px;
}

:deep(.ant-upload.ant-upload-select-picture-card) {
  width: 128px;
  height: 128px;
  border-radius: 50%;
  overflow: hidden;
}
</style>
