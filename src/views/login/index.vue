<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined, MailOutlined, SafetyOutlined, KeyOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import md5 from 'md5'
import { login as loginApi, registerByEmail, getEmailCode as getEmailCodeApi, getPasskeyVoucher, getUserInfo } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { get, parseRequestOptionsFromJSON } from '@github/webauthn-json/browser-ponyfill'
import { generateUUID } from '@/utils/tool'

// 获取环境变量 (做了一些容错处理，防止本地开发报错)
const meta = {
  branch: import.meta.env.VITE_BRANCH_NAME || 'local',
  number: import.meta.env.VITE_BUILD_NUMBER || '0',
  numberUrl: import.meta.env.VITE_BUILD_NUMBER_URL || '#',
  url: import.meta.env.VITE_BUILD_URL || '#',
  sha: import.meta.env.VITE_COMMIT_SHA || '000000',
  date: import.meta.env.VITE_BUILD_DATE || 'Today'
};

// 判断是否是本地开发环境 (没有链接就是本地)
const isLocal = meta.url === '#';

const router = useRouter()
const userStore = useUserStore()

const showBanner = ref(false)
const isLoginPage = ref(true)
const loginLoad = ref(false)
const passkeyLoad = ref(false)
const codeLoad = ref(false)
const codeDisabled = ref(false)
const emailCodeButtonText = ref('获取验证码')
const countdown = ref(0)

onMounted(() => {
  setTimeout(() => {
    showBanner.value = true
  }, 500)
})

const loginFormRef = ref()
const regFormRef = ref()

const form = reactive({
  username: '',
  password: '',
  loginType: 'passwd'
})

const regForm = reactive({
  username: '',
  email: '',
  emailCode: '',
  password: '',
  confirmPassword: '',
  role: undefined
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 12, message: '用户名长度在 3 到 12 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 3, max: 12, message: '密码长度在 3 到 12 个字符', trigger: 'blur' }
  ]
}

const regRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 12, message: '用户名长度在 3 到 12 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 3, max: 12, message: '密码长度在 3 到 12 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: async (_rule: any, value: string) => {
        if (value !== regForm.password) {
          return Promise.reject('两次输入密码不一致')
        }
        return Promise.resolve()
      },
      trigger: 'blur'
    }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  emailCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const login = async () => {
  try {
    await loginFormRef.value.validate()
    loginLoad.value = true
    const data = {
      ...form,
      password: md5(form.password).toUpperCase()
    }
    await loginOperation(data)
  } catch (error) {
    console.error('表单验证失败', error)
  }
}

const loginOperation = async (data: any) => {
  try {
    const res = await loginApi(data)
    if (res.data.code === 200) {
      message.success('登录成功')
      window.localStorage.setItem('token', res.data.data.token)
      userStore.setUserName(res.data.data.userName)
      userStore.setUserRole(res.data.data.role)
      userStore.setName(res.data.data.name)
      
      try {
        const userInfoRes = await getUserInfo()
        if (userInfoRes.data.code === 200) {
          userStore.setProfilePicture(userInfoRes.data.data.profilePicture)
        }
      } catch (e) {
        console.error('Failed to fetch user info', e)
      }

      router.push('/')
    } else {
      message.error(res.data.msg)
    }
  } catch (error) {
    console.error(error)
  } finally {
    loginLoad.value = false
    passkeyLoad.value = false
  }
}

const loginByPasskey = async () => {
  passkeyLoad.value = true
  const identifier = generateUUID()
  try {
    const res = await getPasskeyVoucher(identifier)
    if (res.data.code === 200) {
      const options = parseRequestOptionsFromJSON(res.data.data)
      const credential = await get(options)
      const data = {
        loginType: 'passkey',
        credential: credential,
        identifier: identifier
      }
      await loginOperation(data)
    } else {
      message.error(res.data.message || '获取凭证失败')
      passkeyLoad.value = false
    }
  } catch (error: any) {
    console.error('认证失败:', error)
    if (error.name === 'NotAllowedError') {
      console.log('用户取消了操作或浏览器阻止了请求')
    } else if (error.name === 'AbortError') {
      message.error('认证超时或已被中止')
    } else {
      message.error('未知错误')
    }
    passkeyLoad.value = false
  }
}

const register = async () => {
  try {
    await regFormRef.value.validate()
    loginLoad.value = true
    const data = {
      username: regForm.username,
      email: regForm.email,
      emailCode: regForm.emailCode,
      role: regForm.role,
      password: md5(regForm.password).toUpperCase()
    }
    const res = await registerByEmail(data)
    if (res.data.code === 200) {
      message.success('注册成功，正在跳转登录')
      isLoginPage.value = true
    } else {
      message.error(res.data.msg)
    }
  } catch (error) {
    console.error(error)
  } finally {
    loginLoad.value = false
  }
}

const getEmailCode = async () => {
  const regEmail = /^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(\.[a-zA-Z0-9_-])+/
  if (regEmail.test(regForm.email)) {
    codeLoad.value = true
    codeDisabled.value = true
    try {
      const res = await getEmailCodeApi(regForm.email)
      if (res.data.code === 200) {
        startCountdown()
      } else {
        message.error(res.data.msg)
        codeDisabled.value = false
      }
    } catch (error) {
      console.error(error)
      codeDisabled.value = false
    } finally {
      codeLoad.value = false
    }
  } else {
    message.error('请输入正确的邮箱')
  }
}

const startCountdown = () => {
  countdown.value = 60
  const intervalId = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
      emailCodeButtonText.value = `${countdown.value}秒后重试`
    } else {
      clearInterval(intervalId)
      emailCodeButtonText.value = '获取验证码'
      codeDisabled.value = false
    }
  }, 1000)
}
</script>

<template>
  <div class="login-container">
    <!-- Info Banner -->
    <div class="info-banner" :class="{ 'slide-in': showBanner }">
      <InfoCircleOutlined class="banner-icon" />
      <span>点击链接获取软件介绍以及使用说明：</span>
      <a style="text-decoration: none;" href="https://github.com/xuanyue1024/e-code/blob/main/README.md" target="_blank" class="banner-link">
        GitHub
      </a>
      <span style="margin: 0 0px; color: #1890ff;">|</span>
      <a style="text-decoration: none;" href="https://gitee.com/xuanyue03/e-code/blob/main/README.md" target="_blank" class="banner-link">
        Gitee
      </a>
    </div>

    <a-card class="login-box" :bordered="false">
      <a-row :gutter="24" type="flex" align="middle">
        <a-col :span="12" class="login-left">
          <div class="left-content">
            <img src="../../assets/ecode.png" alt="ecode" class="logo-img" />
            <a href="https://github.com/xuanyue1024/e-code" target="_blank" class="simple-github-link">
              <img src="../../assets/github.svg" alt="GitHub" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </a-col>
        <a-col :span="12">
          <div v-if="isLoginPage">
            <div class="login-header">
              <h2>欢迎回来</h2>
              <p>请登录您的账号</p>
            </div>
            
            <div class="login-toggle">
              <a-button 
                type="text" 
                :class="{ active: form.loginType === 'passwd' }"
                @click="form.loginType = 'passwd'"
              >密码登录</a-button>
              <a-button 
                type="text" 
                :class="{ active: form.loginType === 'qr' }"
                @click="form.loginType = 'qr'"
              >扫码登录</a-button>
            </div>

            <div v-if="form.loginType === 'passwd'">
              <a-form ref="loginFormRef" :model="form" :rules="loginRules" layout="vertical">
                <a-form-item name="username">
                  <a-input v-model:value="form.username" placeholder="请输入用户名" size="large">
                    <template #prefix><UserOutlined /></template>
                  </a-input>
                </a-form-item>
                <a-form-item name="password">
                  <a-input-password v-model:value="form.password" placeholder="请输入密码" size="large">
                    <template #prefix><LockOutlined /></template>
                  </a-input-password>
                </a-form-item>
                
                <div class="form-actions">
                  <a-button type="link" class="forgot-pwd">忘记密码？</a-button>
                  <a-button type="link" @click="isLoginPage = false">没有账号？立即注册</a-button>
                </div>

                <a-button type="primary" block size="large" :loading="loginLoad" @click="login">登录</a-button>
                
                <a-divider>其他登录方式</a-divider>
                
                <a-button block size="large" :loading="passkeyLoad" @click="loginByPasskey">
                  <template #icon><KeyOutlined /></template>
                  通行密钥
                </a-button>
              </a-form>
            </div>

            <div v-if="form.loginType === 'qr'" class="qr-login">
              <img src="data:image/png;base64,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" alt="QR Code" />
              <p>请使用手机扫码登录</p>
            </div>
          </div>

          <div v-else>
            <div class="login-header">
              <h2>创建账号</h2>
              <p>加入我们，开启编程之旅</p>
            </div>

            <a-form ref="regFormRef" :model="regForm" :rules="regRules" layout="vertical">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item name="username">
                    <a-input v-model:value="regForm.username" placeholder="用户名" size="large">
                      <template #prefix><UserOutlined /></template>
                    </a-input>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item name="role">
                    <a-select v-model:value="regForm.role" placeholder="选择角色" size="large">
                      <a-select-option value="STUDENT">学生</a-select-option>
                      <a-select-option value="TEACHER">老师</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item name="email">
                <a-input v-model:value="regForm.email" placeholder="邮箱地址" size="large">
                  <template #prefix><MailOutlined /></template>
                  <template #suffix>
                    <a-button 
                      type="link" 
                      size="small" 
                      :loading="codeLoad" 
                      :disabled="codeDisabled"
                      @click="getEmailCode"
                    >{{ emailCodeButtonText }}</a-button>
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item name="password">
                <a-input-password v-model:value="regForm.password" placeholder="设置密码" size="large">
                  <template #prefix><LockOutlined /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item name="confirmPassword">
                <a-input-password v-model:value="regForm.confirmPassword" placeholder="确认密码" size="large">
                  <template #prefix><LockOutlined /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item name="emailCode">
                <a-input v-model:value="regForm.emailCode" placeholder="验证码" size="large">
                  <template #prefix><SafetyOutlined /></template>
                </a-input>
              </a-form-item>

              <div class="form-actions right">
                <a-button type="link" @click="isLoginPage = true">已有账号？立即登录</a-button>
              </div>

              <a-button type="primary" block size="large" :loading="loginLoad" @click="register">注册</a-button>
            </a-form>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <!-- Build Info Bar -->
    <div class="build-bar">
      <div class="project-name">ecode</div>
      <div class="build-info">
        <a class="version" :href="meta.numberUrl" title="查看发行版">{{ meta.number }}</a>
        <!-- <span class="version">{{ meta.number }}</span> -->
        <span class="at">@</span>
        <span class="branch-name">{{ meta.branch }}</span>
        
        <a v-if="!isLocal" :href="meta.url" target="_blank" class="build-link" title="查看action构建日志">
          ({{ meta.sha.substring(0, 7) }})
        </a>
        <span v-else class="build-local">#dev</span>

        <span class="divider">•</span>

        <span class="build-date">{{ meta.date }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f2f5;
  background-image: url('https://gw.alipayobjects.com/zos/rmsportal/TVYTbAXWheQpRcWDaDMu.svg');
  background-repeat: no-repeat;
  background-position: center 110px;
  background-size: 100%;
}

.login-box {
  width: 900px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.login-left {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f9f9f9;
  height: 550px;
}

.logo-img {
  width: 80%;
  max-width: 300px;
}

.login-header {
  margin-bottom: 24px;
  text-align: center;
}

.login-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 8px;
}

.login-header p {
  color: #8c8c8c;
}

.login-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  gap: 16px;
}

.login-toggle .ant-btn {
  color: #8c8c8c;
  font-size: 16px;
}

.login-toggle .ant-btn.active {
  color: #1890ff;
  font-weight: 600;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.form-actions.right {
  justify-content: flex-end;
}

.qr-login {
  text-align: center;
  padding: 24px 0;
}

.qr-login img {
  width: 200px;
  margin-bottom: 16px;
}

.qr-login p {
  color: #8c8c8c;
}

.info-banner {
  position: fixed;
  top: -60px;
  left: 0;
  width: 100%;
  background-color: #e6f7ff;
  border-bottom: 1px solid #91d5ff;
  padding: 12px 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  transition: top 0.5s ease-in-out;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-banner.slide-in {
  top: 0;
}

.banner-icon {
  color: #1890ff;
  font-size: 16px;
}

.banner-link {
  color: #1890ff;
  font-weight: 500;
  text-decoration: underline;
}

.banner-link:hover {
  color: #40a9ff;
}

.left-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.simple-github-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.04);
  color: #666;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.3s ease;
}

.simple-github-link:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #333;
  transform: translateY(-1px);
}

.simple-github-link img {
  width: 18px;
  height: 18px;
  opacity: 0.8;
}

.build-bar {
  position: fixed;
  bottom: 20px;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #999;
  font-size: 12px;
  z-index: 10;
}

.project-name {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
  color: #999;
}

.build-info {
  display: flex;
  gap: 2.5px;
}

/* .at {
  margin: 0 0px;
} */

.build-link, .version {
  color: #999;
  text-decoration: none;
}

.build-link:hover, .version:hover {
  text-decoration: underline;
  color: #666;
}
</style>
