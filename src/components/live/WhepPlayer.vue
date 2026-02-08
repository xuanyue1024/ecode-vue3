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
    <div v-if="playerState === 'idle' && !isPlaying" class="status-overlay">
      <span>{{ errorMsg || '准备中' }}</span>
    </div>
     <div v-if="playerState === 'error'" class="status-overlay error-bg">
      <span>{{ errorMsg }}</span>
      <a-button type="primary" size="small" @click="() => connectWHEP()" v-if="canManualRetry" style="margin-top:10px;">
        重试
      </a-button>
    </div>

    <!-- 自定义控制条 -->
    <div class="controls-bar" :class="{ 'visible': showControls || !isPlaying }">
      <div class="left-controls">
         <a-button type="text" ghost @click="togglePlay" class="control-btn">
            <template #icon>
              <img :src="isPlaying ? pause : playIcon" class="btn-img" />
            </template>
         </a-button>
         <a-button type="text" ghost @click="toggleMute" class="control-btn">
            <template #icon>
              <img :src="isMuted ? volumeMute : volumeNotice" class="btn-img" />
            </template>
         </a-button>
      </div>

      <div class="right-controls">
         <a-tooltip title="弹幕开关">
             <a-button type="text" ghost @click="showDanmaku = !showDanmaku" class="control-btn">
               <template #icon>
                 <img :src="showDanmaku ? dankuOpen : dankuClose" class="btn-img" />
               </template>
             </a-button>
          </a-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, defineExpose } from 'vue';
import dankuOpen from '@/assets/live/danku_open.svg'
import dankuClose from '@/assets/live/danku_close.svg'
import volumeMute from '@/assets/live/volume-mute.svg'
import volumeNotice from '@/assets/live/volume-notice.svg'
import playIcon from '@/assets/live/play.svg'
import pause from '@/assets/live/pause.svg'

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
const maxReconnectAttempts = 1;//尝试次数

// 暴露添加弹幕方法
const addDanmaku = (msg: DanmakuMessage) => {
  if (overlayRef.value) {
    overlayRef.value.addDanmaku(msg);
  }
};
// defineExpose moved to end

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
 * 尝试多种 SDP 协商策略，以适应不同的服务器行为（如 m-line 顺序、数量不匹配等）
 */
const connectWHEP = async (strategyIndex = 0) => {
  if (!props.classId) return;

  // 定义连接策略
  const strategies = [
    { name: 'Video+Audio (Video First)', video: true, audio: true, orderFirst: 'video' },
    { name: 'Video+Audio (Audio First)', video: true, audio: true, orderFirst: 'audio' },
    { name: 'Video Only', video: true, audio: false, orderFirst: 'video' },
    { name: 'Audio Only', video: false, audio: true, orderFirst: 'audio' }
  ];

  if (strategyIndex >= strategies.length) {
      console.error('[WHEP] 所有连接策略均失败');
      errorMsg.value = '无法建立媒体连接(协议不匹配)';
      playerState.value = 'error';
      handleReconnect(); // 耗尽所有策略后，进入常规的时间间隔重连
      return;
  }
  
  const currentStrategy = strategies[strategyIndex];
  console.log(`[WHEP] 尝试连接策略 [${strategyIndex + 1}/${strategies.length}]: ${currentStrategy.name}`);
  
  // 清理旧连接
  closeConnection(); // 注意：这会重置 pc
  
  const videoElement = videoRef.value;
  if (!videoElement) return;

  // 仅在首次尝试时设置状态，避免策略切换时界面闪烁
  if (strategyIndex === 0) {
      playerState.value = 'connecting';
      errorMsg.value = '';
      emit('status-change', 'connecting');
  }

  try {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      console.log('[WHEP] 收到远程流');
      if (videoElement.srcObject !== event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        if (props.autoplay && !props.paused) {
             videoElement.muted = true;
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
         // 连接中断通常不需要切换策略，因为它已经成功连接过一次了
        playerState.value = 'error';
        errorMsg.value = '连接中断';
        handleReconnect();
      }
    };

    // 根据策略添加 Transceiver
    if (currentStrategy.orderFirst === 'video') {
        if (currentStrategy.video) pc.addTransceiver('video', { direction: 'recvonly' });
        if (currentStrategy.audio) pc.addTransceiver('audio', { direction: 'recvonly' });
    } else {
        if (currentStrategy.audio) pc.addTransceiver('audio', { direction: 'recvonly' });
        if (currentStrategy.video) pc.addTransceiver('video', { direction: 'recvonly' });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (!offer.sdp) throw new Error("Offer generation failed");

    // 调用 API
    const res = await startPullStream(props.classId, offer.sdp);
    
    let answerSdp = '';
    console.log("sdp返回", res.data);

    // 如果是 400，没开播
    if (res.data.code === 400) {
         errorMsg.value = res.data.msg || '未开播';
         playerState.value = 'error';
         emit('error', res.data);
         handleReconnect(); // 常规重连
         return;
    }

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

    // 尝试设置 Remote Description
    try {
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (sdpError: any) {
        // 如果是 SDP 协商错误，尝试下一个策略
        if (sdpError.name === 'InvalidAccessError' || sdpError.name === 'InvalidStateError') {
             console.warn(`[WHEP] 策略 ${currentStrategy.name} 失败 (${sdpError.message})，尝试下一策略...`);
             await connectWHEP(strategyIndex + 1);
             return;
        }
        throw sdpError;
    }
    
    reconnectAttempts = 0;

  } catch (err: any) {
    console.error('[WHEP] 连接异常:', err);
    
    /* // 如果是 400 或 404，可能是没开播，不尝试其他策略，直接报错等待重试
    if (err.response && (err.response.status === 400 || err.response.status === 404)) {
         errorMsg.value = err.response.data?.msg || '未开播';
         playerState.value = 'error';
         emit('error', err);
         handleReconnect(); // 常规重连
         return;
    } */
    
    // 其他错误则继续降级尝试
    // 注意：如果是 Network Error，可能需要区分。这里简单起见，如果 offer 发送失败也降级没有意义，但为了鲁棒性可以一试，
    // 不过通常 API 报错已经在上面处理了。
    // 如果我们也想对 API 报错进行策略降级（不太可能），可以放这里。
    // 这里主要处理上面 catch 没有捕获到的同步错误。
    // 如果是 API 调用失败，通常不需要换 SDP 策略。
    
    errorMsg.value = '连接异常';
    playerState.value = 'error';
    emit('error', err);
    handleReconnect();
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

const play = () => {
    connectWHEP();
};

const stop = () => {
    closeConnection();
    playerState.value = 'idle';
    errorMsg.value = '直播已结束';
    isPlaying.value = false;
    emit('status-change', 'stopped');
};

defineExpose({
    addDanmaku,
    play,
    stop
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

.control-btn {
  color: #fff !important;
}

.control-btn:hover {
  color: rgba(255, 255, 255, 0.8) !important;
  background-color: rgba(255, 255, 255, 0.1);
}

.btn-img {
  width: 25px; 
  height: 25px; 
  filter: brightness(0) invert(1);
}

</style>
