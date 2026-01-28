<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined, MailOutlined, SafetyOutlined, KeyOutlined, InfoCircleOutlined, GithubOutlined } from '@ant-design/icons-vue'
import md5 from 'md5'
import { login as loginApi, registerByEmail, getEmailCode as getEmailCodeApi, getPasskeyVoucher, getUserInfo, getOAuth2Url, oauth2Callback } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { get, parseRequestOptionsFromJSON } from '@github/webauthn-json/browser-ponyfill'
import { generateUUID } from '@/utils/tool'
import GiteeIcon from '@/assets/oauth/gitee.svg'
import FeishuIcon from '@/assets/oauth/feishu.svg'
import QrLogin from './QrLogin.vue'

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
const route = useRoute()
const userStore = useUserStore()

const showBanner = ref(false)
const isLoginPage = ref(true)
const loginLoad = ref(false)
const passkeyLoad = ref(false)
const codeLoad = ref(false)
const codeDisabled = ref(false)
const emailCodeButtonText = ref('获取验证码')
const countdown = ref(0)
const isOAuthRegister = ref(false)
const registerCode = ref('')

// 定义OAuth提供商配置
interface OAuthProvider {
  label: string;
  value: string;
  icon: any; 
}

const oauthProviders = ref<OAuthProvider[]>([
    {
        label: 'GitHub', // 展示名称
        value: 'github', // 对应后端的 oauthType
        icon: GithubOutlined 
    },
    {
        label: 'Gitee', // 展示名称
        value: 'gitee', // 对应后端的 oauthType
        icon: GiteeIcon
    },
    {
        label: '飞书', // 展示名称
        value: 'feishu', // 对应后端的 oauthType
        icon: FeishuIcon
    }
])

onMounted(() => {
  setTimeout(() => {
    showBanner.value = true
  }, 500)
  checkOAuthCallback()
})

const checkOAuthCallback = async () => {
    // 检查URL参数是否有code (OAuth2回调)
    const code = route.query.code
    const state = route.query.state
    
    if (code) {
        loginLoad.value = true
        try {
            // 调用回调接口
            const res = await oauth2Callback({ code, state })
            
            // 清除URL参数，避免刷新重复提交
            router.replace('/login')
            
            if (res.data.code === 200) {
                 message.success('登录成功')
                 handleLoginSuccess(res.data.data)
            } else if (res.data.code === 6001) {
                // 需要注册
                message.info(res.data.msg)
                const userData = res.data.data.userOauthVO.user
                registerCode.value = res.data.data.registerCode
                
                // 切换到注册页并填充数据
                isLoginPage.value = false
                isOAuthRegister.value = true
                
                // 填充表单
                regForm.username = userData.username || ''
                regForm.email = userData.email || ''
                regForm.role = undefined // 用户需手动选择
                
                // 由于密码不可反解，这里留空让用户自己填，或者如果后端返回了密码hash可以直接用(通常不会)
                // 备注：prompt说"密码也是可以编辑"，所以我们可以让用户自己设
                
            } else {
                 message.error(res.data.msg || '登录失败')
            }
        } catch (error) {
            console.error('OAuth callback error', error)
            message.error('第三方登录出错')
        } finally {
            loginLoad.value = false
        }
    }
}

const handleLoginSuccess = async (data: any) => {
      window.localStorage.setItem('token', data.token)
      userStore.setUserName(data.userName)
      userStore.setUserRole(data.role)
      userStore.setName(data.name)
      
      try {
        const userInfoRes = await getUserInfo()
        if (userInfoRes.data.code === 200) {
          userStore.setProfilePicture(userInfoRes.data.data.profilePicture)
        }
      } catch (e) {
        console.error('Failed to fetch user info', e)
      }

      router.push('/')
}

const loginByOAuth = async (provider: OAuthProvider) => {
    try {
        const res = await getOAuth2Url(provider.value)
        if (res.data.code === 200) {
            window.location.href = res.data.data.oauth2Url
        } else {
            message.error(res.data.msg || '获取授权链接失败')
        }
    } catch (error) {
         console.error(error)
         message.error('发起登录失败')
    }
}


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

const regRules = computed(() => {
  const rules: any = {
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
      role: [{ required: true, message: '请选择角色', trigger: 'change' }]
 }
 
 if (!isOAuthRegister.value) {
    rules.emailCode = [
        { required: true, message: '请输入验证码', trigger: 'blur' },
        { len: 6, message: '验证码为6位数字', trigger: 'blur' }
    ]
 }
 
 return rules
})

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
      await handleLoginSuccess(res.data.data)
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
    
    // 构造请求数据
    const data: any = {
      username: regForm.username,
      email: regForm.email,
      role: regForm.role,
      password: md5(regForm.password).toUpperCase()
    }
    
    if (isOAuthRegister.value) {
        data.registerCode = registerCode.value
    } else {
        data.emailCode = regForm.emailCode
    }

    const res = await registerByEmail(data)
    if (res.data.code === 200) {
      message.success('注册成功，请登录')
      isLoginPage.value = true
      // 重置状态
      if (isOAuthRegister.value) {
          isOAuthRegister.value = false
          registerCode.value = ''
          // 清空表单
          regForm.username = ''
          regForm.email = ''
          regForm.password = ''
          regForm.confirmPassword = ''
      }
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
                
                <div class="other-login-methods">
                  <a-tooltip title="通行密钥">
                    <a-button shape="circle" size="large" :loading="passkeyLoad" @click="loginByPasskey">
                      <template #icon><KeyOutlined /></template>
                    </a-button>
                  </a-tooltip>

                  <a-tooltip 
                      v-for="provider in oauthProviders" 
                      :key="provider.value"
                      :title="provider.label"
                  >
                    <a-button 
                        shape="circle" 
                        size="large" 
                        @click="loginByOAuth(provider)"
                    >
                      <template #icon>
                        <component v-if="typeof provider.icon !== 'string'" :is="provider.icon" />
                        <img v-else :src="provider.icon" class="other-login-icon" />
                      </template>
                    </a-button>
                  </a-tooltip>
                </div>
              </a-form>
            </div>

            <div v-if="form.loginType === 'qr'" class="qr-login-wrapper">
              <QrLogin @success="handleLoginSuccess" />
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
                <a-input v-model:value="regForm.email" placeholder="邮箱地址" size="large" :disabled="isOAuthRegister">
                  <template #prefix><MailOutlined /></template>
                  <template #suffix v-if="!isOAuthRegister">
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

              <a-form-item name="emailCode" v-if="!isOAuthRegister">
                <a-input v-model:value="regForm.emailCode" placeholder="验证码" size="large">
                  <template #prefix><SafetyOutlined /></template>
                </a-input>
              </a-form-item>

              <div class="form-actions right">
                <a-button type="link" @click="() => { isLoginPage = true; isOAuthRegister = false; }">已有账号？立即登录</a-button>
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

.other-login-methods {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.other-login-methods :deep(.ant-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.other-login-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
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
