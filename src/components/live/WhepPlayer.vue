<template>
  <div class="whep-player-wrapper" @mouseenter="showControls = true" @mouseleave="showControls = false">
    <video 
      ref="videoRef"
      class="video-element"
      :muted="isMuted"
      :autoplay="autoplay"
      playsinline
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @volumechange="checkMutedState"
    ></video>
    
    <!-- 弹幕层 -->
    <DanmakuOverlay :messages="danmakuBuffer" :visible="showDanmaku" ref="overlayRef" />

    <!-- 加载中/未开播状态 -->
    <div v-if="playerState === 'connecting'" class="status-overlay">
      <span class="loading-spinner"></span>
      <span>直播连接中...</span>
    </div>
    <div v-if="playerState === 'idle' && !isPlaying && !errorMsg" class="status-overlay">
      <span>准备中</span>
    </div>
     <div v-if="playerState === 'error'" class="status-overlay error-bg">
      <span>{{ errorMsg }}</span>
      <a-button type="primary" size="small" @click="connectWHEP" v-if="canManualRetry" style="margin-top:10px;">
        重试
      </a-button>
    </div>

    <!-- 自定义控制条 -->
    <div class="controls-bar" :class="{ 'visible': showControls || !isPlaying }">
      <div class="left-controls">
         <a-button type="text" ghost @click="togglePlay">
            <template #icon>
              <component :is="isPlaying ? 'PauseCircleOutlined' : 'PlayCircleOutlined'" style="font-size: 20px;" />
            </template>
         </a-button>
         <a-button type="text" ghost @click="toggleMute">
            <template #icon>
              <component :is="isMuted ? 'MutedOutlined' : 'SoundOutlined'" style="font-size: 20px;" />
            </template>
         </a-button>
      </div>

      <div class="right-controls">
         <a-tooltip title="弹幕开关">
             <a-button type="text" ghost @click="showDanmaku = !showDanmaku">
               <template #icon>
                 <component :is="showDanmaku ? 'EyeOutlined' : 'EyeInvisibleOutlined'" style="font-size: 20px;" />
               </template>
             </a-button>
          </a-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, defineExpose } from 'vue';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  SoundOutlined, 
  MutedOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons-vue';
import DanmakuOverlay from './DanmakuOverlay.vue';
import { startPullStream, type DanmakuMessage } from '@/api/live';

const props = defineProps<{
  classId: number;
  autoplay?: boolean;
  paused?: boolean;
}>();

const emit = defineEmits(['error', 'connected', 'status-change']);

// 响应式变量
const videoRef = ref<HTMLVideoElement | null>(null);
const overlayRef = ref<InstanceType<typeof DanmakuOverlay> | null>(null);
const errorMsg = ref('');
const playerState = ref<'idle' | 'connecting' | 'playing' | 'error'>('idle');

// Player controls
const isPlaying = ref(false);
const isMuted = ref(true); // Autoplay usually requires mute
const showControls = ref(false);
const canManualRetry = ref(false);
const showDanmaku = ref(true);
const danmakuBuffer = ref<DanmakuMessage[]>([]);

let pc: RTCPeerConnection | null = null;
let reconnectTimer: any = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

// 暴露添加弹幕方法
const addDanmaku = (msg: DanmakuMessage) => {
  if (overlayRef.value) {
    overlayRef.value.addDanmaku(msg);
  }
};
defineExpose({ addDanmaku });

const togglePlay = () => {
  const video = videoRef.value;
  if (!video) return;
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
};

const toggleMute = () => {
  const video = videoRef.value;
  if (video) {
    video.muted = !video.muted;
  }
};

const checkMutedState = () => {
  if (videoRef.value) {
    isMuted.value = videoRef.value.muted;
  }
};

/**
 * 建立 WHEP 连接
 */
const connectWHEP = async () => {
  if (!props.classId) return;
  
  console.log('[WHEP] 开始建立连接 ClassId:', props.classId);
  closeConnection();
  
  const videoElement = videoRef.value;
  if (!videoElement) return;

  playerState.value = 'connecting';
  errorMsg.value = '';
  emit('status-change', 'connecting');

  try {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      console.log('[WHEP] 收到远程流');
      if (videoElement.srcObject !== event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        // 自动播放尝试
        if (props.autoplay && !props.paused) {
             videoElement.muted = true; // Ensure mute for autoplay
             videoElement.play().catch(e => console.warn('Auto play failed', e));
        }
        playerState.value = 'playing';
        emit('connected');
        emit('status-change', 'playing');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WHEP] 连接状态:', pc?.connectionState);
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') {
        playerState.value = 'error';
        errorMsg.value = '连接中断';
        handleReconnect();
      }
    };

    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.addTransceiver('video', { direction: 'recvonly' });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (!offer.sdp) throw new Error("Offer generation failed");

    // 调用 API
    const res = await startPullStream(props.classId, offer.sdp);
    
    // 解析 Answer SDP
    let answerSdp = '';
    if (typeof res.data === 'string') {
        answerSdp = res.data;
    } else if (res.data && res.data.sdp) {
        answerSdp = res.data.sdp;
    } else if (res.data && typeof res.data.data === 'string') {
        answerSdp = res.data.data;
    } else {
        answerSdp = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data;
    }

    if (!answerSdp) {
        throw new Error('未获取到直播流信息(Server returned empty)');
    }

    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    reconnectAttempts = 0;

  } catch (err: any) {
    console.error('[WHEP] 连接异常:', err);
    errorMsg.value = '未开播'; // 简化显示，通常拉不到流就是未开播
    playerState.value = 'error';
    emit('error', err);
    
    // 如果是 404 或者 500，可能是未开播，这种情况下不需要频繁重连
    if (err.response && err.response.status === 500) {
        // 后端说 "如果状态码是500则出错了，要弹出msg消息"
        errorMsg.value = err.response.data?.msg || '未开播或服务异常';
    } else {
        handleReconnect();
    }
  }
};

const handleReconnect = () => {
  if (reconnectAttempts >= maxReconnectAttempts) {
    canManualRetry.value = true;
    return;
  }
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    connectWHEP();
  }, 3000);
};

const closeConnection = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pc) {
    pc.close();
    pc = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
};

onMounted(() => {
  connectWHEP();
});

onBeforeUnmount(() => {
  closeConnection();
});

watch(() => props.classId, () => {
    connectWHEP();
});
</script>

<style scoped>
.whep-player-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.status-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.error-bg {
    background: rgba(0,0,0,0.7);
    padding: 20px;
    border-radius: 8px;
    text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 10px;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  justify-content: space-between;
  opacity: 0;
  transition: opacity 0.3s;
}

.controls-bar.visible {
  opacity: 1;
}

</style>
