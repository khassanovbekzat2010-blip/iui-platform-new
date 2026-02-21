import { dictionary } from "@/data/mock/i18n";
import { AppLanguage } from "@/lib/types";

type DictionaryKey = keyof (typeof dictionary)["ru"];

export function t(lang: AppLanguage, key: DictionaryKey) {
  return dictionary[lang][key] ?? dictionary.ru[key];
}
