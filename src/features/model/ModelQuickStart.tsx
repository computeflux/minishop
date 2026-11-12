import { KeyRound } from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs";
import { Button } from "@/ui/button";
import { getTeeProviderBase } from "@/shared/config/api";
import { resolveModelId } from "@/features/chat/useChatSession";
import { useApiKeysModal } from "@/features/apiKeys/ApiKeysModal";
import { useTranslation } from "react-i18next";
import type { ModelInfoV2 } from "@/hooks/useShops";

/** 模型快速开始引导（参考 dapp ModelApiKeyGuide）。 */
export function ModelQuickStart({
  open,
  onOpenChange,
  model,
  providerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: ModelInfoV2;
  providerName?: string | null;
}) {
  const apiEndpoint = `${getTeeProviderBase()}/v1`;
  const apiKeyEnv = "COMPUTEFLUX_API_KEY";
  const { openApiKeys } = useApiKeysModal();
  const { t } = useTranslation();
  // 调用模型需用 provider/model 完整标识（如 MetaMaskBail/deepseek-flash）
  const modelId = resolveModelId(model, providerName);

  const tsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${apiEndpoint}",
  apiKey: process.env.${apiKeyEnv},
});

async function main() {
  const response = await client.chat.completions.create({
    model: "${modelId}",
    messages: [
      { role: "user", content: "Hello, ComputeFlux!" },
    ],
  });

  console.log(response.choices[0].message.content);
}

main();`;

  const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="${apiEndpoint}",
    api_key=os.environ["${apiKeyEnv}"],
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {"role": "user", "content": "Hello, ComputeFlux!"},
    ],
)

print(response.choices[0].message.content)`;

  const curlCode = `curl ${apiEndpoint}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $\${apiKeyEnv}" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      {"role": "user", "content": "Hello, ComputeFlux!"}
    ]
  }'`;

  const curlStreamCode = `curl -N ${apiEndpoint}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $\${apiKeyEnv}" \\
  -d '{
    "model": "${modelId}",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Hello, ComputeFlux!"}
    ]
  }'`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="Quick Start"
        title={`${t("minishop.model.quick_title", "Quick Start")} · ${model.Name}`}
        className="flex max-h-[85vh]"
      >
        <div className="flex flex-col gap-8">
          <QuickStep n={1} title={t("minishop.model.get_api_key_title", "Get your API key")} isLast={false}>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("minishop.model.get_api_key_desc", "在 ComputeFlux Dashboard 创建 API Key，并设为环境变量：")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-9 gap-1.5 my-2 text-xs"
                onClick={() => openApiKeys()}
              >
                <KeyRound className="size-3.5" />
                {t("minishop.model.get_api_key_btn", "获取 API Key")}
              </Button>
            </div>
            <CodeBlock>
              <code>{`export ${apiKeyEnv}=<your-computeflux-api-key>`}</code>
            </CodeBlock>
          </QuickStep>

          <QuickStep n={2} title={t("minishop.model.first_request_title", "Make your first request")} isLast={false}>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("minishop.model.first_request_desc", { name: model.Name, defaultValue: "使用 {{name}} 调用 ComputeFlux API：" })}
            </p>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-xs text-white/45 leading-relaxed">
              {t("minishop.model.first_request_note", "ComputeFlux 提供与 OpenAI 兼容的端点，可用任意 OpenAI SDK 或直接通过 cURL 调用。")}
            </div>
            <Tabs defaultValue="TypeScript" className="mt-3 w-full">
              <TabsList>
                <TabsTrigger value="TypeScript">TypeScript</TabsTrigger>
                <TabsTrigger value="Python">Python</TabsTrigger>
                <TabsTrigger value="cURL">cURL</TabsTrigger>
              </TabsList>
              <TabsContent value="TypeScript">
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <CodeBlock>
                    <code>{tsCode}</code>
                  </CodeBlock>
                </div>
              </TabsContent>
              <TabsContent value="Python">
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <CodeBlock>
                    <code>{pythonCode}</code>
                  </CodeBlock>
                </div>
              </TabsContent>
              <TabsContent value="cURL">
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <CodeBlock>
                    <code>{curlCode}</code>
                  </CodeBlock>
                </div>
              </TabsContent>
            </Tabs>
          </QuickStep>

          <QuickStep n={3} title={t("minishop.model.streaming_title", "Enable streaming")} isLast={true}>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("minishop.model.streaming_before", "在请求体中加入")} {"\"stream\": true"} {t("minishop.model.streaming_after", "，即以 SSE 流式接收回复：")}
            </p>
            <CodeBlock>
              <code>{curlStreamCode}</code>
            </CodeBlock>
          </QuickStep>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 带编号的连接式步骤。 */
function QuickStep({
  n,
  title,
  isLast,
  children,
}: {
  n: number;
  title: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white">
          {n}
        </div>
        {!isLast && <div className="w-px flex-1 bg-white/10 my-2" />}
      </div>
      <div className="flex-1 pb-2">
        <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** 深色主题代码块，横向滚动。 */
function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono text-white/75">{children}</code>
      </pre>
    </div>
  );
}
