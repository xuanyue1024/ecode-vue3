// 定义 TAC 的配置类型
interface TacConfig {
    requestCaptchaDataUrl: string;
    validCaptchaUrl: string;
    bindEl: string;
    validSuccess: (res: any, c: any, tac: any) => void;
    validFail: (res: any, c: any, tac: any) => void;
    btnRefreshFun?: (el: any, tac: any) => void;
    btnCloseFun?: (el: any, tac: any) => void;
    checkData?: any;
}

// 定义可选的样式配置类型
interface TacStyle {
    logoUrl?: string | null;
    btnUrl?: string;
    bgUrl?: string;
    moveTrackMaskBgColor?: string;
    moveTrackMaskBorderColor?: string;
}

// TAC 实例可能包含的方法
interface TacInstance {
    init: () => void;
    destroyWindow: () => void;
    reloadCaptcha: () => void;
}

declare global {
    interface Window {
        // 全局方法：初始化 TAC，返回一个 Promise，resolve 为 TacInstance
        initTAC: (dir: string, config: TacConfig, style: TacStyle) => Promise<TacInstance>;
    }
}

// 跟踪当前激活的 Promise，避免同时弹出多个验证码窗口
let captchaPromise: Promise<string> | null = null;

// 对外方法：触发验证码并返回验证成功后的 token
export function getCaptchaToken(data?: any): Promise<string> {
    if (captchaPromise) {
        return captchaPromise;
    }

    captchaPromise = new Promise((resolve, reject) => {
        const config: TacConfig = {
            // 生成验证码数据的接口（根据后端实际路径调整）
            requestCaptchaDataUrl: "/api/open/captcha/gen", 
            // 验证验证码结果的接口（根据后端实际路径调整）
            validCaptchaUrl: "/api/open/captcha/check",
            // 挂载验证码的 DOM 元素选择器
            bindEl: "#captcha-box",
            // 验证时需要回传给后端的额外数据（例如第一次请求返回的验证码相关数据）
            checkData: data, 
            // 验证成功回调：销毁窗口并返回后端给出的 token
            validSuccess: (res: any, c: any, tac: any) => {
                tac.destroyWindow();
                if (res && res.data && res.data.validToken) {
                    console.log("验证成功，后端返回的数据为", res);
                    resolve(res.data.validToken);
                } else {
                    // 兼容不同返回结构，返回整个 data 或整个 res
                    resolve(res.data || res); 
                }
                captchaPromise = null;
            },
            // 验证失败回调：默认重新拉取验证码
            validFail: (res: any, c: any, tac: any) => {
                console.log("验证码验证失败回调...");
                tac.reloadCaptcha();
            },
            // 刷新按钮回调
            btnRefreshFun: (el: any, tac: any) => {
                console.log("刷新按钮触发事件...");
                tac.reloadCaptcha();
            },
            // 关闭按钮回调：销毁并 reject
            btnCloseFun: (el: any, tac: any) => {
                console.log("关闭按钮触发事件...");
                tac.destroyWindow();
                captchaPromise = null;
                reject(new Error("用户关闭了验证码"));
            }
        };

        // 自定义样式示例（可按需修改或传入）
        const style: TacStyle = {
            // 按钮样式
            // btnUrl: "https://minio.tianai.cloud/public/captcha-btn/btn3.png",
            // 背景样式
            // bgUrl: "https://minio.tianai.cloud/public/captcha-btn/btn3-bg.jpg",
            // logo 地址
            logoUrl: "./ecode_text.png",
            // 滑动轨迹样式
            /* moveTrackMaskBgColor: "#f7b645",
            moveTrackMaskBorderColor: "#ef9c0d" */
        };

        // 初始化 TAC：第一个参数为 tac 静态资源所在目录（通常放在 public/captcha）
        if (window.initTAC) {
            console.log("正在初始化 TAC...");
            window.initTAC("/captcha/tac", config, style).then(tac => {
                console.log("TAC 初始化成功，正在调用 init()...");
                tac.init();
            }).catch(e => {
                console.error("初始化tac失败", e);
                captchaPromise = null;
                reject(e);
            });
        } else {
            console.error("TAC 库未加载 (window.initTAC 为 undefined)，请检查 index.html 中 load.js 是否正确引入。");
            captchaPromise = null;
            reject(new Error("TAC 库未加载"));
        }
    });

    return captchaPromise;
}
