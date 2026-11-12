import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useModel } from "@/hooks/useShops";
import { ModelDetailPanel } from "@/features/model/ModelDetailPanel";

/** /models/:id — 模型详情页面 */
export default function ModelDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data } = useModel(Number(id));
  const providerId = data?.model?.ProviderID;

  return (
    <Shell
      back={
        providerId != null ? (
          <Link
            to={`/${providerId}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/40 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t("minishop.model.back_to_shop", "返回店铺")}
          </Link>
        ) : undefined
      }
    >
      <ModelDetailPanel id={Number(id)} />
    </Shell>
  );
}

function Shell({
  children,
  back,
}: {
  children: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {back ? <div className="mb-6">{back}</div> : null}
      {children}
    </div>
  );
}
