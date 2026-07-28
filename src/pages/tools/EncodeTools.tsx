import { useState } from 'react'
import { jwtDecode } from 'jwt-decode'

import {
  ToolActions,
  ToolFeedback,
  ToolOutput,
  ToolSection,
  ToolShell,
  type ToolFeedbackState,
} from '../../components/tools/ToolShell'

interface ToolResult {
  output: string
  feedback: ToolFeedbackState | null
}

const EMPTY_RESULT: ToolResult = { output: '', feedback: null }
const URL_EXAMPLE = 'https://example.com/search?q=开发 工具'
const BASE64_EXAMPLE = '你好，工作台 👋'
const JWT_EXAMPLE = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJkZW1vIiwicm9sZSI6InBlcnNvbmFsIn0.'

function bytesToBinary(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return binary
}

function encodeUtf8Base64(value: string): string {
  return btoa(bytesToBinary(new TextEncoder().encode(value)))
}

function decodeUtf8Base64(value: string): string {
  const normalized = value.replace(/\s+/g, '')
  const hasValidAlphabet = /^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  const content = normalized.replace(/=+$/, '')
  const hasInvalidPadding = normalized.includes('=') && normalized.length % 4 !== 0

  if (!hasValidAlphabet || hasInvalidPadding || content.includes('=') || content.length % 4 === 1) {
    throw new Error('Invalid Base64')
  }

  const padded = content.padEnd(Math.ceil(content.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export default function EncodeTools() {
  const [urlInput, setUrlInput] = useState('')
  const [urlResult, setUrlResult] = useState<ToolResult>(EMPTY_RESULT)

  const [base64Input, setBase64Input] = useState('')
  const [base64Result, setBase64Result] = useState<ToolResult>(EMPTY_RESULT)

  const [jwtInput, setJwtInput] = useState('')
  const [jwtResult, setJwtResult] = useState<ToolResult>(EMPTY_RESULT)

  const handleUrlEncode = () => {
    if (!urlInput) {
      setUrlResult({ output: '', feedback: { tone: 'error', message: '请先输入需要编码的文本。' } })
      return
    }

    try {
      setUrlResult({ output: encodeURIComponent(urlInput), feedback: { tone: 'success', message: 'URL 编码完成。' } })
    } catch {
      setUrlResult({ output: '', feedback: { tone: 'error', message: 'URL 编码失败，请检查输入内容。' } })
    }
  }

  const handleUrlDecode = () => {
    if (!urlInput) {
      setUrlResult({ output: '', feedback: { tone: 'error', message: '请先输入需要解码的内容。' } })
      return
    }

    try {
      setUrlResult({ output: decodeURIComponent(urlInput), feedback: { tone: 'success', message: 'URL 解码完成。' } })
    } catch {
      setUrlResult({ output: '', feedback: { tone: 'error', message: 'URL 解码失败，请检查百分号编码是否完整。' } })
    }
  }

  const handleBase64Encode = () => {
    if (!base64Input) {
      setBase64Result({ output: '', feedback: { tone: 'error', message: '请先输入需要编码的文本。' } })
      return
    }

    try {
      setBase64Result({ output: encodeUtf8Base64(base64Input), feedback: { tone: 'success', message: 'Base64 编码完成。' } })
    } catch {
      setBase64Result({ output: '', feedback: { tone: 'error', message: 'Base64 编码失败，请检查输入内容。' } })
    }
  }

  const handleBase64Decode = () => {
    if (!base64Input.trim()) {
      setBase64Result({ output: '', feedback: { tone: 'error', message: '请先输入需要解码的 Base64。' } })
      return
    }

    try {
      setBase64Result({ output: decodeUtf8Base64(base64Input), feedback: { tone: 'success', message: 'Base64 解码完成。' } })
    } catch {
      setBase64Result({
        output: '',
        feedback: { tone: 'error', message: 'Base64 解码失败：请输入有效的 Base64 UTF-8 文本。' },
      })
    }
  }

  const handleJwtDecode = () => {
    const token = jwtInput.trim()
    if (!token) {
      setJwtResult({ output: '', feedback: { tone: 'error', message: '请先粘贴 JWT。' } })
      return
    }

    try {
      const header = jwtDecode<Record<string, unknown>>(token, { header: true })
      const payload = jwtDecode<Record<string, unknown>>(token)
      setJwtResult({
        output: JSON.stringify({ header, payload }, null, 2),
        feedback: { tone: 'success', message: 'JWT 已解码；结果仅供查看，尚未验证签名与可信度。' },
      })
    } catch {
      setJwtResult({ output: '', feedback: { tone: 'error', message: 'JWT 格式无效，无法解码。' } })
    }
  }

  return (
    <ToolShell
      title="编码与解码工具"
      description="处理 URL、UTF-8 Base64 与 JWT 的日常开发输入。"
      privacyNote="所有输入和转换仅在当前浏览器本地处理，本页面不会主动发送网络请求。"
    >
      <ToolSection
        title="URL Encode / Decode"
        description="对 URL、查询参数或普通文本进行百分号编码与解码。"
      >
        <div className="tool-field">
          <label htmlFor="url-input">URL 或文本</label>
          <textarea
            id="url-input"
            className="form-control"
            placeholder="输入原文本或需要解码的内容…"
            value={urlInput}
            onChange={(event) => {
              setUrlInput(event.currentTarget.value)
              setUrlResult(EMPTY_RESULT)
            }}
            aria-invalid={urlResult.feedback?.tone === 'error'}
          />
        </div>
        <ToolActions
          copyText={urlResult.output}
          copySuccessMessage="URL 结果已复制。"
          onClear={() => {
            setUrlInput('')
            setUrlResult(EMPTY_RESULT)
          }}
          clearDisabled={!urlInput && !urlResult.output}
          clearSuccessMessage="URL 输入和结果已清空。"
          onExample={() => {
            setUrlInput(URL_EXAMPLE)
            setUrlResult(EMPTY_RESULT)
          }}
          exampleLabel="载入 URL 示例"
        >
          <button type="button" className="tool-action-button" onClick={handleUrlEncode}>编码</button>
          <button type="button" className="tool-action-button tool-action-button-secondary" onClick={handleUrlDecode}>解码</button>
        </ToolActions>
        <ToolFeedback feedback={urlResult.feedback} />
        <ToolOutput
          id="url-output"
          label="转换结果"
          value={urlResult.output}
          emptyMessage="输入 URL 或文本后选择编码或解码。"
        />
      </ToolSection>

      <ToolSection
        title="Base64 转换"
        description="使用 UTF-8 在文本与标准 Base64 之间双向转换，支持中文和 Emoji。"
      >
        <div className="tool-field">
          <label htmlFor="base64-input">文本或 Base64</label>
          <textarea
            id="base64-input"
            className="form-control"
            placeholder="输入原文本或需要解码的 Base64…"
            value={base64Input}
            onChange={(event) => {
              setBase64Input(event.currentTarget.value)
              setBase64Result(EMPTY_RESULT)
            }}
            aria-invalid={base64Result.feedback?.tone === 'error'}
          />
        </div>
        <ToolActions
          copyText={base64Result.output}
          copySuccessMessage="Base64 结果已复制。"
          onClear={() => {
            setBase64Input('')
            setBase64Result(EMPTY_RESULT)
          }}
          clearDisabled={!base64Input && !base64Result.output}
          clearSuccessMessage="Base64 输入和结果已清空。"
          onExample={() => {
            setBase64Input(BASE64_EXAMPLE)
            setBase64Result(EMPTY_RESULT)
          }}
          exampleLabel="载入中文示例"
        >
          <button type="button" className="tool-action-button" onClick={handleBase64Encode}>编码</button>
          <button type="button" className="tool-action-button tool-action-button-secondary" onClick={handleBase64Decode}>解码</button>
        </ToolActions>
        <ToolFeedback feedback={base64Result.feedback} />
        <ToolOutput
          id="base64-output"
          label="转换结果"
          value={base64Result.output}
          emptyMessage="输入 UTF-8 文本或标准 Base64 后开始转换。"
        />
      </ToolSection>

      <ToolSection
        title="JWT 解码器"
        description="仅提取 JWT 的 Header 和 Payload，不执行签名验证。"
      >
        <p id="jwt-warning" role="note" style={{ color: 'var(--color-warning)', fontSize: '0.82rem', margin: 0 }}>
          仅解码，不验签：能显示内容不代表 Token 真实、可信或仍然有效。JWT 可能包含敏感信息，请谨慎复制。
        </p>
        <div className="tool-field">
          <label htmlFor="jwt-input">JWT 字符串</label>
          <textarea
            id="jwt-input"
            className="form-control"
            aria-describedby="jwt-warning"
            placeholder="粘贴 eyJhbG… 格式的 JWT"
            value={jwtInput}
            onChange={(event) => {
              setJwtInput(event.currentTarget.value)
              setJwtResult(EMPTY_RESULT)
            }}
            aria-invalid={jwtResult.feedback?.tone === 'error'}
            spellCheck={false}
          />
        </div>
        <ToolActions
          copyText={jwtResult.output}
          copyLabel="复制解码结果"
          copySuccessMessage="JWT 解码结果已复制；结果仍未验签。"
          onClear={() => {
            setJwtInput('')
            setJwtResult(EMPTY_RESULT)
          }}
          clearDisabled={!jwtInput && !jwtResult.output}
          clearSuccessMessage="JWT 输入和结果已清空。"
          onExample={() => {
            setJwtInput(JWT_EXAMPLE)
            setJwtResult(EMPTY_RESULT)
          }}
          exampleLabel="载入未签名示例"
        >
          <button type="button" className="tool-action-button" onClick={handleJwtDecode}>仅解码 Token</button>
        </ToolActions>
        <ToolFeedback feedback={jwtResult.feedback} />
        <ToolOutput
          id="jwt-output"
          label="解码结果（未验签）"
          value={jwtResult.output}
          emptyMessage="粘贴 JWT 后仅解码 Header 和 Payload。"
          meta={jwtResult.output ? '未验签' : undefined}
        />
      </ToolSection>
    </ToolShell>
  )
}
