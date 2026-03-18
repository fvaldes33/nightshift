"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback } from "react";

interface MarkdownEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
}

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
  },
  ".cm-content": {
    padding: "16px 0",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write markdown...",
  className,
}: MarkdownEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange],
  );

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={[markdown(), EditorView.lineWrapping, baseTheme]}
      className={className}
      theme="none"
      placeholder={placeholder}
      basicSetup={{
        lineNumbers: false,
        autocompletion: false,
        highlightActiveLine: false,
        foldGutter: false,
      }}
    />
  );
}
