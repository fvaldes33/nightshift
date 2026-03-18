import { cjk } from "@streamdown/cjk";
import { createCodePlugin, type CodeHighlighterPlugin } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

/** Code plugin that falls back to plain text for unsupported languages. */
const baseCode = createCodePlugin();
const safeCode: CodeHighlighterPlugin = {
  ...baseCode,
  highlight(options, callback) {
    const lang = baseCode.supportsLanguage(options.language)
      ? options.language
      : ("text" as typeof options.language);
    return baseCode.highlight({ ...options, language: lang }, callback);
  },
};

export const streamdownPlugins = { cjk, code: safeCode, math, mermaid };
