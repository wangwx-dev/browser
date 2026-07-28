import type { CSSProperties } from 'react'

import './CodeEditor.css'

interface CodeEditorProps {
  ariaLabel: string
  language?: string
  minHeight?: number
  onChange?: (value: string) => void
  readOnly?: boolean
  value: string
}

export function CodeEditor({
  ariaLabel,
  language = 'text',
  minHeight = 220,
  onChange,
  readOnly = false,
  value,
}: CodeEditorProps) {
  const style = { '--code-editor-min-height': `${minHeight}px` } as CSSProperties

  return (
    <div className="code-editor" data-language={language} style={style}>
      <span className="code-editor-language" aria-hidden="true">{language}</span>
      <textarea
        aria-label={ariaLabel}
        autoCapitalize="off"
        autoComplete="off"
        className="code-editor-input"
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        spellCheck={false}
        value={value}
      />
    </div>
  )
}
