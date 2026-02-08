import { getRequest, postRequest, postRequestSdp } from "@/utils/request";

/**
 * 弹幕消息接口
 */
export interface DanmakuMessage {
  userId: number;
  username: string;
  msg: string; // 弹幕内容
  color: string; // 弹幕颜色
  ts: number; // 时间戳
  role: number | null; // 角色(主播-0，为null观众)
}

/**
 * 弹幕发送DTO
 */
export interface DanmakuDTO {
  classId: number;
  msg: string;
  color?: string;
}

/**
 * 获取100条历史弹幕
 * @param classId 班级ID
 */
export const getDanmakuList = (classId: number) => {
  return getRequest(`/api/user/live/danmaku/list/${classId}`);
};

/**
 * 发送弹幕
 * @param data 弹幕信息
 */
export const sendDanmaku = (data: DanmakuDTO) => {
  return postRequest(`/api/user/live/danmaku/send`, data);
};

/**
 * 教师推流 (WHIP)
 * @param classId 班级ID
 * @param sdpOffer SDP Offer content
 */
export const startPushStream = (classId: number, sdpOffer: string) => {
    return postRequestSdp(`/api/teacher/live/whip/${classId}`, sdpOffer);
};

/**
 * 学生拉流 (WHEP)
 * @param classId 班级ID
 * @param sdpOffer SDP Offer from client
 */
export const startPullStream = (classId: number, sdpOffer: string) => {
  return postRequestSdp(`/api/student/live/whep/${classId}`, sdpOffer);
};
