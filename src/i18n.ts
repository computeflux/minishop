import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { setLocale as setWeb3AuthLocale } from "@wetee/web3auth/react";

import en from "@/shared/locales/en/translation.json";
import zh from "@/shared/locales/zh/translation.json";
import ru from "@/shared/locales/ru/translation.json";
import ja from "@/shared/locales/ja/translation.json";
import ko from "@/shared/locales/ko/translation.json";
import de from "@/shared/locales/de/translation.json";

export type SupportedLang = "en" | "zh" | "ru" | "ja" | "ko" | "de";

const SUPPORTED_LANGS: SupportedLang[] = ["en", "zh", "ru", "ja", "ko", "de"];

// SEO 用：语言 → og:locale 标签 / <html lang> 值
const OG_LOCALE: Record<SupportedLang, string> = {
    en: "en_US",
    zh: "zh_CN",
    ru: "ru_RU",
    ja: "ja_JP",
    ko: "ko_KR",
    de: "de_DE",
};
const HTML_LANG: Record<SupportedLang, string> = {
    en: "en",
    zh: "zh-CN",
    ru: "ru",
    ja: "ja",
    ko: "ko",
    de: "de",
};

export function ogLocale(lang: string = i18n.language): string {
    return OG_LOCALE[lang as SupportedLang] ?? "en_US";
}

export function htmlLang(lang: string = i18n.language): string {
    return HTML_LANG[lang as SupportedLang] ?? "en";
}

const STORAGE_KEY = "minishop_lang";

function getInitialLanguage(): SupportedLang {
    // 服务端无 localStorage/navigator：用默认语言（SSR 入口可经 DEFAULT_LOCALE 覆盖）
    if (typeof window === "undefined") {
        return (process.env.DEFAULT_LOCALE as SupportedLang | undefined) ?? "en";
    }
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    // 依次检查浏览器偏好语言列表（如 ["zh-CN", "zh", "en"]），取第一个命中项
    const langs = Array.from(navigator.languages ?? [navigator.language ?? ""]);
    for (const raw of langs) {
        const nav = raw.toLowerCase();
        if (nav.startsWith("zh")) return "zh";
        if (nav.startsWith("ru")) return "ru";
        if (nav.startsWith("ja")) return "ja";
        if (nav.startsWith("ko")) return "ko";
        if (nav.startsWith("de")) return "de";
    }
    return "en";
}

export function setLanguage(lang: SupportedLang) {
    localStorage.setItem(STORAGE_KEY, lang);
    try {
        // web3auth 可能不支持某些语言，失败不影响 i18n 切换
        setWeb3AuthLocale(lang);
    } catch {
        /* ignore */
    }
    void i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        zh: { translation: zh },
        ru: { translation: ru },
        ja: { translation: ja },
        ko: { translation: ko },
        de: { translation: de },
    },
    lng: getInitialLanguage(),
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
