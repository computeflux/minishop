/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_CHAIN_URL: string
  readonly VITE_AUTH_BACKEND_URL: string
  readonly VITE_WEB3AUTH_CLIENT_ID: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  /** C2C 平台服务地址（法币充值下单/订单进度；不含 /c2c 前缀）。
   * 必填：`getC2cApiBase()` 缺失即 throw，与相邻 VITE_AUTH_BACKEND_URL 等保持一致 */
  readonly VITE_C2C_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
