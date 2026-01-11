import axios from "axios";
import { message } from "ant-design-vue";
import router from "@/router";

// 创建 axios 实例
const httptool = axios.create({
    timeout: 300000,
});

// 传送 json 格式的 post 请求
export const postRequest = (url: string, params: any) => {
    return httptool.post(`${url}`, params);
}
// 传送表单格式的 post 请求
export const postRequestForm = (url: string, params: { [key: string]: any }) => {
    const formData = new FormData();
    for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            formData.append(key, params[key]);
        }
    }

    return httptool.post(`${url}`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}


// 传送 json 格式的 put 请求
export const putRequest = (url: string, params: any) => {
    return httptool.put(`${url}`,{}, {params});
}

// 传送 json 格式的 put 请求
export const putRequestJson = (url: string, data: any) => {
    return httptool.put(`${url}`, data);
}

// 传送 json 格式的 get 请求
export const getRequest = (url: string) => {
    return httptool.get(`${url}`);
}

// 传送表单格式的 get 请求
export const getRequestForm = (url: string, params: { [key: string]: any }) => {
    const queryString = new URLSearchParams(params).toString();
    return httptool.get(`${url}?${queryString}`);
}

// 传送 json 格式的 delete 请求
export const deleteRequest = (url: string, data: any) => {
    return httptool.delete(`${url}`, { data: data });
}

// 传送 查询 格式的 delete 请求
export const deleteRequestForm = (url: string, params: any) => {
    return httptool.delete(`${url}`, { params: params });
}

// 文件上传请求
export const uploadFileRequest = (url: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return httptool.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
}

// 请求拦截器
httptool.interceptors.request.use(config => {
    const token = window.localStorage.getItem('token') || window.sessionStorage.getItem('token');
    if (token) {
        config.headers['token'] = token;
    }
    return config;
}, error => {
    console.log(error);
    return Promise.reject(error);
});

import { getCaptchaToken } from "./captcha";

// 响应拦截器
httptool.interceptors.response.use(
    async response => {
        // 调试日志：打印响应状态码
        // console.log("Response Code:", response.data?.code, "Data:", response.data);

        // 判断是否需要验证码 (假设后端以 200 状态码返回，body中有 code=6000)
        // 使用宽松相等 == 以兼容字符串 '6000'
        if (response.data && response.data.code == 6000) {
            console.log("检测到需验证码验证(code=6000)，准备唤起验证码...");
            try {
                // 唤起验证码
                const token = await getCaptchaToken(response.data.validToken);
                console.log("验证码通过，获取到 token:", token);
                
                // 获取原请求配置
                const config = response.config;

                
                // 将验证后的token加入请求头
                // 注意：这里 header 的名称 'verify-token' 需要与后端约定一致
                config.headers['Captcha-Token'] = token;
                
                // 重新发起请求
                return httptool(config);
            } catch (e) {
                console.error("验证码流程未完成", e);
                return Promise.reject(e);
            }
        }
        return response;
    },
    error => {
        if (error.response && error.response.status === 401) {
            message.warning('尚未登录，请登录！');
            router.push('/login');
        } else {
            message.error('网络好像有点问题');
        }
        return Promise.reject(error);
    }
);

export default {
    postRequest,
    putRequest,
    putRequestJson,
    getRequest,
    deleteRequest,
    uploadFileRequest,
};
