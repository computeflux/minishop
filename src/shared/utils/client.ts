/** SSR-safe 浏览器全局访问辅助。 */

/** 当前站点 origin（客户端返回 window.location.origin，服务端返回空串，由 SSR 入口注入完整 URL）。 */
export function clientOrigin(): string {
    return typeof window !== "undefined" ? window.location.origin : "";
}

/** 客户端才有的全局（SSR 期恒 false）。 */
export const isBrowser = typeof window !== "undefined";
