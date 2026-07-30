import type { LangCode } from "@/types"

export interface LangMeta {
  code: LangCode
  name: string
  nativeName: string
  /** BCP-47 tag for speechSynthesis */
  speech: string
  short: string
}

export const LANGS: Record<LangCode, LangMeta> = {
  de: { code: "de", name: "German", nativeName: "Deutsch", speech: "de-DE", short: "DE" },
  en: { code: "en", name: "English", nativeName: "English", speech: "en-US", short: "EN" },
  ru: { code: "ru", name: "Russian", nativeName: "Русский", speech: "ru-RU", short: "RU" },
}

export const LANG_CODES = Object.keys(LANGS) as LangCode[]

export function isLangCode(value: unknown): value is LangCode {
  return value === "de" || value === "en" || value === "ru"
}

export function otherLangs(code: LangCode): LangCode[] {
  return LANG_CODES.filter((c) => c !== code)
}

export function langLabel(code: LangCode): string {
  return LANGS[code].name
}

export function pairLabel(wordLang: LangCode, translationLang: LangCode): string {
  return `${LANGS[wordLang].short} → ${LANGS[translationLang].short}`
}
