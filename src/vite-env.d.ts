/// <reference types="vite/client" />

// 声明项目中会用到的 VITE_ 环境变量，便于类型检查与智能提示
interface ImportMetaEnv {
  readonly VITE_BRANCH_NAME: string
  readonly VITE_BUILD_NUMBER: string
  readonly VITE_BUILD_URL: string
  readonly VITE_COMMIT_SHA: string
  readonly VITE_BUILD_DATE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
