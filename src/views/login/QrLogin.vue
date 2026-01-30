<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import QrcodeVue from 'qrcode.vue'
import { generateQrCode, login } from '@/api/user'

const emit = defineEmits(['success'])

const loading = ref(false)
const sceneId = ref('')
const isExpired = ref(false)
const timer = ref<any>(null)
const countdownTime = ref(0) // seconds
const status = ref('INITIAL') // INITIAL, SCANNED, CONFIRMED, CANCELLED
const scanMsg = ref('请使用手机扫码登录')
const scanAvatar = ref('')

let socket: WebSocket | null = null

const countdownStr = computed(() => {
  const m = Math.floor(countdownTime.value / 60).toString().padStart(2, '0')
  const s = (countdownTime.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

// 是否显示客户端下载弹窗
const showDownloadModal = ref(false)
// 官方发布页面地址（用于生成二维码和直接跳转）
const githubUrl = 'https://github.com/xuanyue1024/EcodeForAndroid/releases'
const giteeUrl = 'https://gitee.com/xuanyue03/EcodeForAndroid/releases'

// 关闭弹窗后的清理（防止遮罩残留导致页面无法交互）
const onModalAfterClose = () => {
    try {
        // 确保状态为关闭
        showDownloadModal.value = false
        // 移除可能残留的遮罩或 wrap（防护性清理）
        document.querySelectorAll('.ant-modal-mask').forEach(el => el.remove())
        document.querySelectorAll('.ant-modal-wrap.download-modal-wrap').forEach(el => el.remove())
    } catch (e) {
        console.error('afterClose 清理失败', e)
    }
}

const initCode = async () => {
    loading.value = true
    // Reset state
    status.value = 'INITIAL'
    isExpired.value = false
    scanMsg.value = '请使用手机扫码登录'
    
    try {
        const res = await generateQrCode()
        if (res.data.code === 200) {
            sceneId.value = res.data.data.sceneId
            countdownTime.value = res.data.data.timeout
            // Start countdown
            startTimer()
            // Connect WS
            connectWs(sceneId.value)
        } else {
            message.error(res.data.msg || '获取二维码失败')
        }
    } catch (error) {
        console.error(error)
        message.error('网络错误')
    } finally {
        loading.value = false
    }
}

const startTimer = () => {
    if (timer.value) clearInterval(timer.value)
    timer.value = setInterval(() => {
        if (countdownTime.value > 0) {
            countdownTime.value--
        } else {
            handleExpire()
        }
    }, 1000)
}

const handleExpire = () => {
    clearInterval(timer.value)
    isExpired.value = true
    if (socket) {
        socket.close()
    }
}

const refreshCode = () => {
    if (socket) socket.close()
    initCode()
}

const connectWs = (sid: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
    const host = window.location.host
    const url = `${protocol}${host}/api/ws/scan/${sid}`
    
    socket = new WebSocket(url)
    
    socket.onopen = () => {
        console.log('WS connected')
    }
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data)
            
            if (data.status === 'SCANNED') {
                status.value = 'SCANNED'
                scanMsg.value = data.msg
                if (data.metaData) {
                    scanAvatar.value = data.metaData
                }
            } else if (data.status === 'CONFIRMED') {
                status.value = 'CONFIRMED'
                scanMsg.value = data.msg
                // message.success(data.msg) // Optional, as existing login success will show toast maybe
                doLogin(sid)
            } else if (data.status === 'CANCELLED') {
                status.value = 'CANCELLED'
                message.warning(data.msg)
                
                // Behave like expired, allow refresh
                isExpired.value = true 
                if (timer.value) clearInterval(timer.value)
                 socket?.close()
            }
            
        } catch (e) {
            console.error('WS parse error', e)
        }
    }
    
    socket.onerror = (e) => {
        console.error('WS error', e)
    }
    
    socket.onclose = () => {
        console.log('WS closed')
    }
}

const doLogin = async (sid: string) => {
    try {
        const res = await login({
            loginType: 'scan',
            sceneId: sid
        })
        if (res.data.code === 200) {
            emit('success', res.data.data)
        } else {
            message.error(res.data.msg || '登录失败')
             refreshCode()
        }
    } catch (e) {
        console.error(e)
        message.error('登录请求错误')
    }
}

onMounted(() => {
    initCode()
})

onUnmounted(() => {
    if (timer.value) clearInterval(timer.value)
    if (socket) socket.close()
})

</script>

<template>
  <div class="qr-login-container">
    <div class="qr-wrapper">
        <qrcode-vue 
            v-if="sceneId"
            :value="sceneId" 
            :size="200" 
            level="H"
            :image-settings="{ src: '/logo.ico', width: 40, height: 40, excavate: true }"
        />
        
        <!-- Mask for Expired, Cancelled, or Scanned, or Confirmed -->
        <div v-if="isExpired || status === 'SCANNED' || status === 'CANCELLED' || status === 'CONFIRMED'" class="qr-mask">
            
             <!-- Expired or Cancelled -->
             <div v-if="isExpired || status === 'CANCELLED'" class="mask-content">
                 <div class="icon-refresh" @click="refreshCode">
                     <ReloadOutlined />
                 </div>
                 <p v-if="status === 'CANCELLED'">用户取消登录</p>
                 <p v-else>二维码已失效</p>
                 <p>点击刷新</p>
             </div>
             
             <!-- Scanned -->
             <div v-else-if="status === 'SCANNED'" class="mask-content">
                 <img v-if="scanAvatar" :src="scanAvatar" class="avatar-scanned" />
                 <p class="scan-msg">{{ scanMsg }}</p>
             </div>
             
             <!-- Confirmed -->
             <div v-else-if="status === 'CONFIRMED'" class="mask-content">
                   <p class="scan-msg success">{{ scanMsg }}</p>
             </div>
        </div>
    </div>
    
    <div class="bottom-info">
        <p v-if="!isExpired && status === 'INITIAL'">
            请使用 <a href="#" @click.prevent="showDownloadModal = true" class="ecode-link">Ecode 手机客户端</a> 扫码登录<br>
            <span class="countdown">二维码有效期: {{ countdownStr }}</span>
        </p>
    </div>
    
    <!-- 客户端下载弹窗：展示两个下载来源的二维码与跳转链接 -->
    <!-- 弹窗显示右上角关闭图标但不包含底部关闭按钮；可通过点击遮罩或按 Esc 键关闭 -->
    <!-- 开启 centered 使 Modal 垂直居中 -->
    <!-- 增加 destroyOnClose 和 afterClose 回调，关闭后确保清理残留遮罩/容器 -->
    <a-modal v-model:open="showDownloadModal" title="客户端下载" :footer="null" width="440" wrap-class-name="download-modal-wrap" :closable="true" :mask-closable="true" :keyboard="true" :centered="true" :destroyOnClose="true" @afterClose="onModalAfterClose">
        <div class="download-card single">
            <div class="download-items">
                <!-- GitHub 下载项 -->
                <div class="item">
                    <qrcode-vue :value="githubUrl" :size="96" level="H" />
                    <div class="card-body">
                        <h4>GitHub</h4>
                        <a :href="githubUrl" target="_blank" rel="noopener" class="download-btn">前往 GitHub 下载</a>
                    </div>
                </div>

                <div class="divider" />

                <!-- Gitee 下载项 -->
                <div class="item">
                    <qrcode-vue :value="giteeUrl" :size="96" level="H" />
                    <div class="card-body">
                        <h4>Gitee</h4>
                        <a :href="giteeUrl" target="_blank" rel="noopener" class="download-btn">前往 Gitee 下载</a>
                    </div>
                </div>
            </div>
        </div>

        <!-- 不需底部关闭按钮，保留遮罩/ESC 关闭交互 -->
    </a-modal>
  </div>
</template>

<style scoped>
.qr-login-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 24px 24px 24px;
    margin-top: 0px;
}

.qr-wrapper {
    position: relative;
    width: 200px;
    height: 200px;
    /* border: 1px solid #eee; */
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.qr-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

/* User said gray mask. rgba(255,255,255,0.9) is whitish. Maybe darker? */
/* "覆盖一层灰色遮罩" usually implies semi-transparent black or gray layout. */
/* But if the QR code is black on white, a white mask with opacity works too. */
/* Let's try gray background. */
.qr-mask {
    background: rgba(255, 255, 255, 0.95); /* More gray */
}

.mask-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 10px;
}

.icon-refresh {
    font-size: 32px;
    color: #1890ff;
    cursor: pointer;
    margin-bottom: 8px;
    transition: transform 0.3s;
}

.icon-refresh:hover {
    transform: rotate(180deg);
}

.avatar-scanned {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.scan-msg {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    line-height: 1.5;
    word-break: break-word;
}

.scan-msg.success {
    color: #52c41a;
}

.bottom-info {
    text-align: center;
    color: #666;
    font-size: 14px;
}

.countdown {
    color: #ff4d4f;
    font-weight: bold;
}

.ecode-link {
    color: #1890ff;
    text-decoration: none;
    cursor: pointer;
}

.ecode-link:hover {
    text-decoration: underline;
}

.download-card.single {
    padding: 10px;
    border-radius: 8px;
    background: transparent;
}

.download-items {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.download-items .item {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.divider {
    width: 1px;
    height: 72px;
    background: #f0f0f0;
}

.download-card .card-body {
    text-align: center;
    margin-top: 8px;
}

.download-card h4 {
    margin: 0 0 6px 0;
    font-size: 14px;
}

.download-btn {
    display: inline-block;
    padding: 6px 10px;
    background: #1890ff;
    color: #fff;
    border-radius: 4px;
    text-decoration: none;
}

@media (max-width: 520px) {
    .download-items {
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .divider { display: none; }
}
</style>


