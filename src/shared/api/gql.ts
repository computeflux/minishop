import axios from "axios";
import { pushToast } from "@/shared/lib/toast";

interface GraphqlRequest {
  query: string;
  variables?: Record<string, unknown>;
}

interface GraphqlResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class GraphqlClient {
  private readonly baseUrl: string;

  constructor(url: string) {
    this.baseUrl = url;
  }

  private getAuthHeader(): Record<string, string> {
    // SSR 期无 localStorage：读操作（contractDryRun）无需 token，直接返回空。
    if (typeof localStorage === "undefined") return {};
    const token = localStorage.getItem("token");
    if (!token) return {};
    return { authorization: `Bearer ${token}` };
  }

  async query<T = unknown>(req: GraphqlRequest): Promise<T> {
    const response = await axios.request<GraphqlResponse<T>>({
      method: "POST",
      data: req,
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
      },
      url: this.baseUrl,
    });

    if (response.data.errors) {
      const msg = response.data.errors[0].message;
      // 若后端返回 session 过期相关错误，自动清理本地 session
      if (/unauthorized|invalid token|expired|登录过期|token/i.test(msg)) {
        localStorage.removeItem("web3auth:session");
        localStorage.removeItem("token");
      }
      pushToast({
        title: "Call tee chain error",
        description: msg,
        variant: "error",
        durationMs: 2500,
      });
      throw new Error(msg);
    }

    return response.data.data as T;
  }

  async mut<T = unknown>(req: GraphqlRequest): Promise<T> {
    return this.query<T>(req);
  }
}
