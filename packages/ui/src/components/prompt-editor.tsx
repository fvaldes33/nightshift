"use client";

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { type Extension, Prec, type Range, RangeSetBuilder } from "@codemirror/state";
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface MentionItem {
  /** Display label (e.g. filename) */
  label: string;
  /** Full path or identifier */
  value: string;
  /** Category for grouping (e.g. "file", "command") */
  type: "file" | "command";
  /** Optional detail text shown beside the label */
  detail?: string;
}

export interface PromptEditorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  /** Items shown when user types @ */
  fileItems?: MentionItem[];
  /** Items shown when user types / */
  commandItems?: MentionItem[];
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// File icon mapping
// ============================================================================

const FILE_ICON_MAP: Record<string, string> = {
  ts: "file-ts",
  tsx: "file-tsx",
  js: "file-js",
  jsx: "file-jsx",
  py: "file-py",
  go: "file-go",
  rs: "file-rs",
  rb: "file-rb",
  java: "file-java",
  json: "file-json",
  yaml: "file-yaml",
  yml: "file-yaml",
  toml: "file-toml",
  xml: "file-xml",
  md: "file-md",
  mdx: "file-md",
  html: "file-html",
  css: "file-css",
  scss: "file-css",
  svg: "file-svg",
  png: "file-image",
  jpg: "file-image",
  jpeg: "file-image",
  gif: "file-image",
  webp: "file-image",
  sh: "file-shell",
  bash: "file-shell",
  zsh: "file-shell",
  sql: "file-sql",
  graphql: "file-graphql",
  lock: "file-lock",
};

const SPECIAL_FILENAMES: Record<string, string> = {
  dockerfile: "file-docker",
  makefile: "file-shell",
  ".gitignore": "file-git",
  ".env": "file-env",
};

function getFileIconType(path: string): string {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (SPECIAL_FILENAMES[name]) return SPECIAL_FILENAMES[name]!;
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  return FILE_ICON_MAP[ext] ?? "file-default";
}

// ============================================================================
// Fuzzy matching & scoring
// ============================================================================

function fuzzyMatch(path: string, query: string): boolean {
  const lower = path.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < query.length; i++) {
    if (lower[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

function boostScore(path: string, query: string): number {
  if (!query) return 0;
  const lower = path.toLowerCase();
  const filename = lower.split("/").pop() ?? lower;

  if (filename === query) return 100;
  if (filename.startsWith(query)) return 80;
  if (filename.includes(query)) return 60;
  if (lower.includes(query)) return 40;
  return 20;
}

// ============================================================================
// Completion Sources (using refs for items to avoid extension churn)
// ============================================================================

function createFileCompletionSource(itemsRef: { current: MentionItem[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/@[\w./\-]*/);
    if (!word) return null;

    const query = word.text.slice(1).toLowerCase();
    const items = itemsRef.current;
    const options: Completion[] = [];
    const limit = 50;

    for (const item of items) {
      if (query && !fuzzyMatch(item.value, query)) continue;
      options.push({
        label: item.value,
        displayLabel: item.label,
        detail: item.detail,
        type: getFileIconType(item.value),
        apply: (view, completion, _from, to) => {
          view.dispatch({
            changes: { from: word.from, to, insert: `\`@${completion.label}\`` },
          });
        },
        boost: boostScore(item.value, query),
      });
      if (options.length >= limit) break;
    }

    return { from: word.from, options, filter: false };
  };
}

function createCommandCompletionSource(itemsRef: { current: MentionItem[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/(?:^|\s)\/[\w-]*/);
    if (!word) return null;

    // Trim leading whitespace — the regex may capture the space before /
    const slashIdx = word.text.indexOf("/");
    const actualFrom = word.from + slashIdx;
    const query = word.text.slice(slashIdx + 1).toLowerCase();
    const items = itemsRef.current;

    const options: Completion[] = items
      .filter((item) => !query || item.value.toLowerCase().includes(query))
      .map((item) => ({
        label: `/${item.value}`,
        displayLabel: `/${item.label}`,
        detail: item.detail,
        type: "keyword",
        apply: (view, _completion, _from, to) => {
          view.dispatch({
            changes: { from: actualFrom, to, insert: `/${item.value} ` },
          });
        },
      }));

    return { from: actualFrom, options, filter: false };
  };
}

// ============================================================================
// Theme
// ============================================================================

const promptTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    maxHeight: "200px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "var(--color-foreground, #fff)",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-placeholder": {
    color: "var(--color-muted-foreground, #888)",
    fontStyle: "normal",
  },

  // ---- Autocomplete tooltip ----
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--color-border, #333)",
    borderRadius: "8px",
    background: "var(--color-popover, #1a1a1a)",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "inherit",
    maxHeight: "280px",
    padding: "4px 0",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "5px 10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    lineHeight: "1.4",
    borderRadius: "0",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "var(--color-accent, #333)",
    color: "var(--color-accent-foreground, #fff)",
  },

  // ---- Completion icon badges ----
  ".cm-completionIcon": {
    width: "20px",
    height: "20px",
    opacity: "1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "9px",
    fontWeight: "700",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    borderRadius: "4px",
    padding: "0",
    marginRight: "0",
    flexShrink: "0",
  },
  // TypeScript
  ".cm-completionIcon-file-ts::after, .cm-completionIcon-file-tsx::after": {
    content: "'TS'",
    color: "#3178c6",
  },
  ".cm-completionIcon-file-ts, .cm-completionIcon-file-tsx": {
    background: "rgba(49, 120, 198, 0.12)",
  },
  // JavaScript
  ".cm-completionIcon-file-js::after, .cm-completionIcon-file-jsx::after": {
    content: "'JS'",
    color: "#f0db4f",
  },
  ".cm-completionIcon-file-js, .cm-completionIcon-file-jsx": {
    background: "rgba(240, 219, 79, 0.12)",
  },
  // Python
  ".cm-completionIcon-file-py::after": { content: "'PY'", color: "#3776ab" },
  ".cm-completionIcon-file-py": { background: "rgba(55, 118, 171, 0.12)" },
  // Go
  ".cm-completionIcon-file-go::after": { content: "'GO'", color: "#00add8" },
  ".cm-completionIcon-file-go": { background: "rgba(0, 173, 216, 0.12)" },
  // Rust
  ".cm-completionIcon-file-rs::after": { content: "'RS'", color: "#dea584" },
  ".cm-completionIcon-file-rs": { background: "rgba(222, 165, 132, 0.12)" },
  // Ruby
  ".cm-completionIcon-file-rb::after": { content: "'RB'", color: "#cc342d" },
  ".cm-completionIcon-file-rb": { background: "rgba(204, 52, 45, 0.12)" },
  // Java
  ".cm-completionIcon-file-java::after": { content: "'JV'", color: "#b07219" },
  ".cm-completionIcon-file-java": { background: "rgba(176, 114, 25, 0.12)" },
  // JSON
  ".cm-completionIcon-file-json::after": { content: "'{}'", color: "#a6e22e" },
  ".cm-completionIcon-file-json": { background: "rgba(166, 226, 46, 0.12)" },
  // YAML
  ".cm-completionIcon-file-yaml::after": { content: "'YA'", color: "#cb171e" },
  ".cm-completionIcon-file-yaml": { background: "rgba(203, 23, 30, 0.12)" },
  // TOML
  ".cm-completionIcon-file-toml::after": { content: "'TL'", color: "#9c4221" },
  ".cm-completionIcon-file-toml": { background: "rgba(156, 66, 33, 0.12)" },
  // XML
  ".cm-completionIcon-file-xml::after": { content: "'XM'", color: "#e44d26" },
  ".cm-completionIcon-file-xml": { background: "rgba(228, 77, 38, 0.12)" },
  // Markdown
  ".cm-completionIcon-file-md::after": { content: "'MD'", color: "#519aba" },
  ".cm-completionIcon-file-md": { background: "rgba(81, 154, 186, 0.12)" },
  // HTML
  ".cm-completionIcon-file-html::after": { content: "'HT'", color: "#e44d26" },
  ".cm-completionIcon-file-html": { background: "rgba(228, 77, 38, 0.12)" },
  // CSS
  ".cm-completionIcon-file-css::after": { content: "'CS'", color: "#563d7c" },
  ".cm-completionIcon-file-css": { background: "rgba(86, 61, 124, 0.12)" },
  // SVG
  ".cm-completionIcon-file-svg::after": { content: "'SV'", color: "#ffb13b" },
  ".cm-completionIcon-file-svg": { background: "rgba(255, 177, 59, 0.12)" },
  // Images
  ".cm-completionIcon-file-image::after": { content: "'IM'", color: "#a074c4" },
  ".cm-completionIcon-file-image": { background: "rgba(160, 116, 196, 0.12)" },
  // Shell
  ".cm-completionIcon-file-shell::after": { content: "'SH'", color: "#89e051" },
  ".cm-completionIcon-file-shell": { background: "rgba(137, 224, 81, 0.12)" },
  // Docker
  ".cm-completionIcon-file-docker::after": { content: "'DK'", color: "#2496ed" },
  ".cm-completionIcon-file-docker": { background: "rgba(36, 150, 237, 0.12)" },
  // SQL
  ".cm-completionIcon-file-sql::after": { content: "'SQ'", color: "#e38c00" },
  ".cm-completionIcon-file-sql": { background: "rgba(227, 140, 0, 0.12)" },
  // GraphQL
  ".cm-completionIcon-file-graphql::after": { content: "'GQ'", color: "#e535ab" },
  ".cm-completionIcon-file-graphql": { background: "rgba(229, 53, 171, 0.12)" },
  // Lock files
  ".cm-completionIcon-file-lock::after": { content: "'LK'", color: "#666" },
  ".cm-completionIcon-file-lock": { background: "rgba(102, 102, 102, 0.12)" },
  // Git
  ".cm-completionIcon-file-git::after": { content: "'GI'", color: "#f14e32" },
  ".cm-completionIcon-file-git": { background: "rgba(241, 78, 50, 0.12)" },
  // Env
  ".cm-completionIcon-file-env::after": { content: "'EN'", color: "#ecd53f" },
  ".cm-completionIcon-file-env": { background: "rgba(236, 213, 63, 0.12)" },
  // Default
  ".cm-completionIcon-file-default::after": { content: "'F'", color: "#888" },
  ".cm-completionIcon-file-default": { background: "rgba(136, 136, 136, 0.12)" },
  // Slash command icon
  ".cm-completionIcon-keyword::after": { content: "'/'", color: "#a78bfa" },
  ".cm-completionIcon-keyword": { background: "rgba(167, 139, 250, 0.15)" },

  // ---- Completion text ----
  ".cm-completionDetail": {
    marginLeft: "auto",
    paddingLeft: "12px",
    opacity: "0.4",
    fontSize: "12px",
    fontStyle: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "200px",
  },
  ".cm-completionLabel": {
    fontSize: "13px",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    fontWeight: "600",
    color: "var(--color-foreground, #fff)",
  },

  // ---- Inline mention & command styling ----
  ".cm-mention": {
    background: "rgba(59, 130, 246, 0.12)",
    color: "rgb(96, 165, 250)",
    borderRadius: "3px",
    padding: "1px 0",
  },
  ".cm-command": {
    background: "rgba(167, 139, 250, 0.12)",
    color: "rgb(167, 139, 250)",
    borderRadius: "3px",
    padding: "1px 0",
  },
});

// ============================================================================
// Inline decorations for mentions & commands
// ============================================================================

const mentionMark = Decoration.mark({ class: "cm-mention" });
const commandMark = Decoration.mark({ class: "cm-command" });

/** Regex to find `@filepath` tokens (backtick-wrapped mention) */
const MENTION_RE = /`@[^`]+`/g;
/** Regex to find /command tokens (slash followed by word chars) */
const COMMAND_RE = /(?:^|\s)(\/[\w-]+)/gm;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  // Collect all decoration ranges, then sort by from position
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);

    // Mentions: `@filepath`
    MENTION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MENTION_RE.exec(text))) {
      ranges.push(mentionMark.range(from + m.index, from + m.index + m[0].length));
    }

    // Commands: /commit, /review-pr etc.
    COMMAND_RE.lastIndex = 0;
    while ((m = COMMAND_RE.exec(text))) {
      const matchStart = from + m.index + (m[0].length - m[1]!.length); // skip leading whitespace
      ranges.push(commandMark.range(matchStart, matchStart + m[1]!.length));
    }
  }

  // RangeSetBuilder requires sorted ranges
  ranges.sort((a, b) => a.from - b.from);
  for (const r of ranges) {
    builder.add(r.from, r.to, r.value);
  }

  return builder.finish();
}

const inlineDecorations: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ============================================================================
// Component
// ============================================================================

export function PromptEditor({
  value,
  onValueChange,
  onSubmit,
  placeholder = "Ask nightshift...",
  fileItems = [],
  commandItems = [],
  disabled = false,
  className,
}: PromptEditorProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Use refs for completion items so extensions don't recreate on data load
  const fileItemsRef = useRef(fileItems);
  fileItemsRef.current = fileItems;
  const commandItemsRef = useRef(commandItems);
  commandItemsRef.current = commandItems;

  const extensions = useMemo(() => {
    return [
      markdown(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on" }),
      promptTheme,
      inlineDecorations,
      cmPlaceholder(placeholder),
      // Autocomplete
      autocompletion({
        override: [
          createFileCompletionSource(fileItemsRef),
          createCommandCompletionSource(commandItemsRef),
        ],
        activateOnTyping: true,
        maxRenderedOptions: 50,
        icons: true,
        closeOnBlur: true,
        aboveCursor: true,
        interactionDelay: 50,
      }),
      // Enter to submit, Shift+Enter for newline
      Prec.highest(
        keymap.of([
          {
            key: "Enter",
            run: (view) => {
              // If autocomplete tooltip is open, let CM handle it
              const tooltip = view.dom.querySelector(".cm-tooltip-autocomplete");
              if (tooltip) return false;

              const text = view.state.doc.toString();
              if (text.trim()) {
                onSubmitRef.current(text);
              }
              return true;
            },
          },
          {
            key: "Shift-Enter",
            run: () => false, // Fall through to default (insert newline)
          },
        ]),
      ),
    ];
    // Only recreate extensions when placeholder changes — items use refs
  }, [placeholder]);

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const handleChange = useCallback((val: string) => {
    onValueChangeRef.current?.(val);
  }, []);

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      cmRef.current?.view?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <CodeMirror
      ref={cmRef}
      value={value ?? ""}
      onChange={handleChange}
      extensions={extensions}
      className={className}
      theme="none"
      editable={!disabled}
      basicSetup={{
        lineNumbers: false,
        autocompletion: false, // We configure our own
        highlightActiveLine: false,
        foldGutter: false,
        highlightActiveLineGutter: false,
        indentOnInput: false,
        syntaxHighlighting: true,
        bracketMatching: false,
        closeBrackets: false,
        history: true,
        drawSelection: true,
        dropCursor: false,
        searchKeymap: false,
      }}
    />
  );
}
