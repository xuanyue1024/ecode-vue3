<template>
  <div class="whip-pusher-wrapper">
    <div class="video-container" @mouseenter="showControls = true" @mouseleave="showControls = false">
      <video ref="videoPreviewRef" autoplay muted playsinline class="video-element"></video>
      
      <!-- 弹幕层 -->
      <DanmakuOverlay :messages="danmakuBuffer" :visible="showDanmaku" ref="overlayRef" />

      <!-- 状态显示 -->
      <div v-if="state === 'initializing'" class="status-overlay">初始化设备...</div>
      <div v-if="state === 'pushing'" class="status-live-badge">直播中</div>

      <!-- 控制栏 -->
      <div class="controls-bar" :class="{ visible: showControls || state === 'idle' }">
        
        <div class="left-controls">
          <a-tooltip title="弹幕开关">
             <a-button type="text" ghost @click="showDanmaku = !showDanmaku">
               <template #icon>
                 <component :is="showDanmaku ? 'EyeOutlined' : 'EyeInvisibleOutlined'" style="color: white; font-size: 18px;" />
               </template>
             </a-button>
          </a-tooltip>
        </div>

        <div class="center-controls">
          <a-button 
            type="primary" 
            danger 
            shape="round" 
            v-if="state === 'pushing'" 
            @click="stopLive"
          >
            结束直播
          </a-button>
          <a-space v-else>
             <a-button type="primary" shape="round" @click="startLive('camera')">摄像头直播</a-button>
             <a-button type="primary" ghost shape="round" @click="startLive('screen')">屏幕共享直播</a-button>
          </a-space>
        </div>

        <div class="right-controls">
          <!-- 可以在这里放切换源的按钮，如果在直播中 -->
           <a-dropdown v-if="state === 'pushing'">
            <template #overlay>
              <a-menu @click="handleSourceChange">
                <a-menu-item key="camera">切换摄像头</a-menu-item>
                <a-menu-item key="screen">切换屏幕共享</a-menu-item>
              </a-menu>
            </template>
            <a-button type="text" ghost>
              切换源 <DownOutlined />
            </a-button>
          </a-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, shallowRef, defineProps, defineExpose, watch } from 'vue';
import { message } from 'ant-design-vue';
import { 
  EyeOutlined, 
  EyeInvisibleOutlined, 
  DownOutlined 
} from '@ant-design/icons-vue';
import DanmakuOverlay from './DanmakuOverlay.vue';
import { startPushStream, type DanmakuMessage } from '@/api/live';

const props = defineProps<{
  classId: number;
}>();

const emit = defineEmits(['state-change']);

const videoPreviewRef = ref<HTMLVideoElement | null>(null);
const overlayRef = ref<InstanceType<typeof DanmakuOverlay> | null>(null);
const state = ref<'idle' | 'initializing' | 'pushing' | 'error'>('idle');

watch(state, (val) => {
    emit('state-change', val);
});

const showControls = ref(true);
const showDanmaku = ref(true);
const danmakuBuffer = ref<DanmakuMessage[]>([]);

let localStream: MediaStream | null = null;
let pc: RTCPeerConnection | null = null;

// 添加弹幕到覆盖层
const addDanmaku = (msg: DanmakuMessage) => {
  if (overlayRef.value) {
    overlayRef.value.addDanmaku(msg);
  }
};

defineExpose({
  addDanmaku
});

// 获取媒体流
const getMediaStream = async (type: 'camera' | 'screen') => {
  try {
    if (type === 'camera') {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } else {
      return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    }
  } catch (err) {
    console.error('获取媒体失败', err);
    message.error('无法获取媒体设备');
    throw err;
  }
};

// 开始推流
const startLive = async (type: 'camera' | 'screen') => {
  state.value = 'initializing';
  try {
    // 1. 获取流
    const stream = await getMediaStream(type);
    localStream = stream;
    
    if (videoPreviewRef.value) {
      videoPreviewRef.value.srcObject = stream;
    }

    // 2. 建立 WebRTC 连接
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // 实际应配置 TURN
    });
    
    // 3. 创建 Offer
    // 明确轨道添加顺序：先视频后音频 (Video First)，这是大多数流媒体服务器(如SRS)的默认偏好
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      pc.addTrack(videoTracks[0], stream);
    }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      pc.addTrack(audioTracks[0], stream);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 4. 发送 WHIP 请求
    if (!offer.sdp) throw new Error("No SDP generated");
    
    const res = await startPushStream(props.classId, offer.sdp);
    
    // 假设后端返回的是 SDP Answer 字符串，或者是包装在 JSON 里的.
    // 前面 API 接口定义响应是 201 OK。
    // 如果返回 JSON: { code: 200, data: "sdp..." } ? 
    // 根据通常习惯和 strict WHIP, 它应该返回 application/sdp body。
    // 如果我们用 axios 默认请求，得到的是 res.data。
    // 我们这里假设 res.data 就是 SDP Answer (如果 Content-Type 是 application/sdp)
    // 或者 res.data.data 是 SDP (如果是自定义 JSON 包装)
    // 考虑到用户给的响应示例是空的，我这里做防御性编程。
    
    let answerSdp = '';
    // 这里是一个假设，因为不知道后端具体返回格式。
    // 如果是标准 WHIP，res.data 类型通常是 string。
    if (typeof res.data === 'string') {
        answerSdp = res.data;
    } else if (res.data && res.data.sdp) {
        answerSdp = res.data.sdp;
    } else if (res.data && typeof res.data.data === 'string') { // 兼容标准Result包装
        answerSdp = res.data.data;
    } else {
        // 如果实在拿不到 SDP Answer，可能是后端直接 201 Created 但通过其它方式交互?
        // 不，WebRTC 必须互换 SDP。
        // 我们假设它是标准 WHIP，但我们的 axios 可能把 response parsed as text for sdp content-type.
        // 如果 axios 没有配好 transformResponse，它可能是 string.
        answerSdp = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data; 
        // 修正：如果 res.data 是对象可能是因为它被自动 JSON 解析了，但内容是否是 sdp 结构？
        // 如果是 B 站那种 WHEP，可能需要特定字段。
        // 这里只能假设 res.data 当作 string 处理是 answer sdp。
    }

    if (!answerSdp) {
        throw new Error('未收到有效的 SDP Answer');
    }

    await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
    });

    state.value = 'pushing';
    message.success('开播成功');

    // 监听流停止（比如用户点击了浏览器自带的停止共享）
    stream.getVideoTracks()[0].onended = () => {
        stopLive();
    };

  } catch (e: any) {
    console.error(e);
    message.error('开播失败: ' + (e.message || '未知错误'));
    stopLive();
  }
};

// 停止直播
const stopLive = () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  if (videoPreviewRef.value) {
    videoPreviewRef.value.srcObject = null;
  }
  state.value = 'idle';
  message.info('直播已结束');
};

// 切换源
const handleSourceChange = async ({ key }: { key: string }) => {
    // 简单实现：先停止当前的，再开启新的。
    // 无缝切换需要 replaceTrack API
    if (state.value !== 'pushing' || !pc) return;
    
    try {
        const newType = key as 'camera' | 'screen';
        const newStream = await getMediaStream(newType);
        
        // 替换轨道
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (videoSender && newVideoTrack) {
            await videoSender.replaceTrack(newVideoTrack);
        }
        if (audioSender && newAudioTrack) {
            await audioSender.replaceTrack(newAudioTrack);
        }

        // 停止旧流
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
        localStream = newStream;
        if (videoPreviewRef.value) {
            videoPreviewRef.value.srcObject = newStream;
        }

        // 监听结束
        newVideoTrack.onended = () => {
            stopLive();
        };

        message.success('切换源成功');

    } catch (e) {
        console.error('切换源失败', e);
        message.error('切换源失败');
    }
};

onBeforeUnmount(() => {
  stopLive();
});
</script>

<style scoped>
.whip-pusher-wrapper {
  width: 100%;
  height: 100%;
  background: #000;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.video-container {
  width: 100%;
  height: 100%;
  position: relative;
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
  background: rgba(0,0,0,0.6);
  padding: 10px 20px;
  border-radius: 4px;
}

.status-live-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: red;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  animation: blink 2s infinite;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: opacity 0.3s;
  opacity: 0;
}

.controls-bar.visible {
  opacity: 1;
}

.center-controls {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
</style>
