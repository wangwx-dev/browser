import { FileSearch, Fingerprint, KeyRound } from 'lucide-react'
import { useRef, useState } from 'react'
import forge from 'node-forge'

import {
  ToolActions,
  ToolFeedback,
  ToolOutput,
  ToolSection,
  ToolShell,
  type ToolFeedbackState,
} from '../../components/tools/ToolShell'

type RsaBits = 2048 | 4096

interface RsaKeys {
  publicKey: string
  privateKey: string
}

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Web Crypto unavailable')
  return subtle
}

function arrayBufferToPem(buffer: ArrayBuffer, label: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }

  const base64 = btoa(binary)
  const lines = base64.match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`
}

async function generateRsaKeyPair(bits: RsaBits): Promise<RsaKeys> {
  const subtle = requireSubtleCrypto()
  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )

  if (!('publicKey' in keyPair)) throw new Error('RSA key pair was not returned')

  const [publicKey, privateKey] = await Promise.all([
    subtle.exportKey('spki', keyPair.publicKey),
    subtle.exportKey('pkcs8', keyPair.privateKey),
  ])

  return {
    publicKey: arrayBufferToPem(publicKey, 'PUBLIC KEY'),
    privateKey: arrayBufferToPem(privateKey, 'PRIVATE KEY'),
  }
}

async function generateHmacSha256(text: string, secret: string): Promise<string> {
  const subtle = requireSubtleCrypto()
  const encoder = new TextEncoder()
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtle.sign('HMAC', key, encoder.encode(text))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function SecurityTools() {
  const rsaRequestRef = useRef(0)
  const hmacRequestRef = useRef(0)
  const [rsaKeys, setRsaKeys] = useState<RsaKeys | null>(null)
  const [rsaBits, setRsaBits] = useState<RsaBits>(2048)
  const [isGenerating, setIsGenerating] = useState(false)
  const [rsaFeedback, setRsaFeedback] = useState<ToolFeedbackState | null>(null)

  const [certInput, setCertInput] = useState('')
  const [certOutput, setCertOutput] = useState('')
  const [certFeedback, setCertFeedback] = useState<ToolFeedbackState | null>(null)

  const [hmacText, setHmacText] = useState('')
  const [hmacKey, setHmacKey] = useState('')
  const [hmacOutput, setHmacOutput] = useState('')
  const [hmacFeedback, setHmacFeedback] = useState<ToolFeedbackState | null>(null)
  const [isSigning, setIsSigning] = useState(false)

  const handleGenerateRsa = async () => {
    const requestId = ++rsaRequestRef.current
    setIsGenerating(true)
    setRsaFeedback({ tone: 'info', message: `正在本地生成 ${rsaBits} 位 RSA 密钥对…` })

    try {
      const keys = await generateRsaKeyPair(rsaBits)
      if (requestId !== rsaRequestRef.current) return
      setRsaKeys(keys)
      setRsaFeedback({ tone: 'success', message: `${rsaBits} 位 RSA 密钥对已在本地生成。` })
    } catch {
      if (requestId !== rsaRequestRef.current) return
      setRsaFeedback({
        tone: 'error',
        message: '密钥生成失败。请使用支持 Web Crypto 的现代浏览器后重试。',
      })
    } finally {
      if (requestId === rsaRequestRef.current) setIsGenerating(false)
    }
  }

  const handleClearKeys = () => {
    rsaRequestRef.current += 1
    setIsGenerating(false)
    setRsaKeys(null)
    setRsaFeedback(null)
  }

  const handleParseCert = () => {
    if (!certInput.trim()) {
      setCertOutput('')
      setCertFeedback({ tone: 'error', message: '请先粘贴 PEM 格式的证书。' })
      return
    }

    try {
      const cert = forge.pki.certificateFromPem(certInput)
      const subject = cert.subject.attributes.map((attribute) => `${attribute.shortName || attribute.name}=${attribute.value}`).join(', ')
      const issuer = cert.issuer.attributes.map((attribute) => `${attribute.shortName || attribute.name}=${attribute.value}`).join(', ')
      setCertOutput([
        `主体（Subject）: ${subject}`,
        `颁发者（Issuer）: ${issuer}`,
        `有效期起: ${cert.validity.notBefore.toISOString()}`,
        `有效期止: ${cert.validity.notAfter.toISOString()}`,
        `序列号: ${cert.serialNumber}`,
        `签名算法 OID: ${cert.signatureOid}`,
      ].join('\n'))
      setCertFeedback({ tone: 'success', message: '证书已在本地解析。' })
    } catch {
      setCertOutput('')
      setCertFeedback({ tone: 'error', message: '解析失败，请确认内容是有效的 PEM 证书。' })
    }
  }

  const invalidateHmac = () => {
    hmacRequestRef.current += 1
    setIsSigning(false)
    setHmacOutput('')
    setHmacFeedback(null)
  }

  const handleHmac = async () => {
    if (!hmacText || !hmacKey) {
      setHmacOutput('')
      setHmacFeedback({ tone: 'error', message: '请输入文本和密钥。' })
      return
    }

    const requestId = ++hmacRequestRef.current
    setIsSigning(true)
    setHmacFeedback({ tone: 'info', message: '正在本地计算 HMAC…' })
    try {
      const hash = await generateHmacSha256(hmacText, hmacKey)
      if (requestId !== hmacRequestRef.current) return
      setHmacOutput(hash)
      setHmacFeedback({ tone: 'success', message: 'HMAC-SHA256 已生成。' })
    } catch {
      if (requestId !== hmacRequestRef.current) return
      setHmacOutput('')
      setHmacFeedback({ tone: 'error', message: 'HMAC 生成失败，请使用支持 Web Crypto 的现代浏览器。' })
    } finally {
      if (requestId === hmacRequestRef.current) setIsSigning(false)
    }
  }

  const handleClearHmac = () => {
    hmacRequestRef.current += 1
    setIsSigning(false)
    setHmacText('')
    setHmacKey('')
    setHmacOutput('')
    setHmacFeedback(null)
  }

  return (
    <ToolShell
      title="安全与密钥工具"
      description="生成与检查开发所需的密钥材料；敏感结果不会自动保存。"
      privacyNote="所有输入和计算仅在当前浏览器本地处理，本页面不会主动发送网络请求。"
    >
      <ToolSection
        title="RSA 密钥对生成器"
        description="使用 Web Crypto 在本地生成 RSA-OAEP / SHA-256 公私钥对（PEM 格式）。"
      >
        <div className="tool-field">
          <label htmlFor="rsa-bits">密钥长度（位）</label>
          <select
            id="rsa-bits"
            className="form-control"
            value={rsaBits}
            onChange={(event) => {
              rsaRequestRef.current += 1
              setIsGenerating(false)
              setRsaBits(event.currentTarget.value === '4096' ? 4096 : 2048)
              setRsaKeys(null)
              setRsaFeedback({ tone: 'info', message: '密钥长度已更改；请重新生成密钥对。' })
            }}
            aria-describedby="rsa-bits-hint"
          >
            <option value={2048}>2048（推荐）</option>
            <option value={4096}>4096（生成较慢）</option>
          </select>
          <small id="rsa-bits-hint">最低 2048 位；4096 位在部分设备上需要更长时间。</small>
        </div>

        <ToolActions>
          <button type="button" className="tool-action-button" onClick={handleGenerateRsa} disabled={isGenerating}>
            <KeyRound aria-hidden="true" size={17} />
            {isGenerating ? '正在生成…' : '生成 RSA 密钥对'}
          </button>
        </ToolActions>
        <ToolFeedback feedback={rsaFeedback} />

        <ToolOutput
          id="rsa-public-key"
          label="公钥"
          value={rsaKeys?.publicKey ?? ''}
          emptyMessage="生成后显示 SPKI PEM 公钥。"
          meta={rsaKeys ? `${rsaBits} 位 · SPKI PEM` : undefined}
        />
        <ToolActions
          copyText={rsaKeys?.publicKey ?? ''}
          copyLabel="复制公钥"
          copySuccessMessage="公钥已复制。"
        />

        <p id="private-key-warning" role="note" style={{ color: 'var(--color-error)', fontSize: '0.8rem', margin: 0 }}>
          私钥属于敏感数据：不要通过聊天、邮件或公开仓库分享。使用后请清空页面并处理剪贴板副本。
        </p>
        <ToolOutput
          id="rsa-private-key"
          label="私钥（敏感）"
          value={rsaKeys?.privateKey ?? ''}
          emptyMessage="生成后显示 PKCS#8 PEM 私钥。"
          meta={rsaKeys ? `${rsaBits} 位 · PKCS#8 PEM` : undefined}
        />
        <ToolActions
          copyText={rsaKeys?.privateKey ?? ''}
          copyLabel="复制私钥"
          copySuccessMessage="私钥已复制；请尽快粘贴到安全位置，并在使用后清理剪贴板。"
          onClear={handleClearKeys}
          clearLabel="清空密钥对"
          clearDisabled={!rsaKeys && !isGenerating}
          clearSuccessMessage="密钥已从页面清空；其他位置的副本不会被自动删除。"
        />
      </ToolSection>

      <ToolSection
        title="X.509 证书解析"
        description="在本地解析 PEM 证书，查看主体、颁发者、有效期和签名算法。"
      >
        <div className="tool-field">
          <label htmlFor="certificate-input">PEM 证书</label>
          <textarea
            id="certificate-input"
            className="form-control"
            placeholder="-----BEGIN CERTIFICATE-----…"
            value={certInput}
            onChange={(event) => {
              setCertInput(event.currentTarget.value)
              setCertOutput('')
              setCertFeedback(null)
            }}
            spellCheck={false}
          />
        </div>
        <ToolActions
          copyText={certOutput}
          copyLabel="复制解析结果"
          copySuccessMessage="证书解析结果已复制。"
          onClear={() => {
            setCertInput('')
            setCertOutput('')
            setCertFeedback(null)
          }}
          clearDisabled={!certInput && !certOutput}
          clearSuccessMessage="证书输入和结果已清空。"
        >
          <button type="button" className="tool-action-button" onClick={handleParseCert}>
            <FileSearch aria-hidden="true" size={17} />
            解析证书
          </button>
        </ToolActions>
        <ToolFeedback feedback={certFeedback} />
        <ToolOutput
          id="certificate-output"
          label="证书解析结果"
          value={certOutput}
          emptyMessage="粘贴 PEM 证书后查看解析结果。"
        />
      </ToolSection>

      <ToolSection
        title="HMAC-SHA256 生成器"
        description="使用 Web Crypto 和密钥在本地计算文本的 HMAC。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))', gap: '1rem' }}>
          <div className="tool-field">
            <label htmlFor="hmac-text">文本</label>
            <textarea
              id="hmac-text"
              className="form-control"
              value={hmacText}
              onChange={(event) => {
                invalidateHmac()
                setHmacText(event.currentTarget.value)
              }}
            />
          </div>
          <div className="tool-field">
            <label htmlFor="hmac-key">密钥（敏感）</label>
            <input
              id="hmac-key"
              type="password"
              autoComplete="off"
              value={hmacKey}
              onChange={(event) => {
                invalidateHmac()
                setHmacKey(event.currentTarget.value)
              }}
            />
            <small>密钥仅用于本次本地计算，不会保存。</small>
          </div>
        </div>
        <ToolActions
          copyText={hmacOutput}
          copyLabel="复制 HMAC"
          copySuccessMessage="HMAC 结果已复制。"
          onClear={handleClearHmac}
          clearDisabled={!hmacText && !hmacKey && !hmacOutput && !isSigning}
          clearSuccessMessage="HMAC 文本、密钥和结果已从页面清空。"
          onExample={() => {
            invalidateHmac()
            setHmacText('hello')
            setHmacKey('demo-secret')
          }}
          exampleLabel="载入 HMAC 示例"
        >
          <button type="button" className="tool-action-button" onClick={handleHmac} disabled={isSigning}>
            <Fingerprint aria-hidden="true" size={17} />
            {isSigning ? '正在生成…' : '生成 HMAC'}
          </button>
        </ToolActions>
        <ToolFeedback feedback={hmacFeedback} />
        <ToolOutput
          id="hmac-output"
          label="HMAC-SHA256 结果"
          value={hmacOutput}
          emptyMessage="输入文本和密钥后生成十六进制 HMAC。"
          meta={hmacOutput ? '64 个十六进制字符' : undefined}
        />
      </ToolSection>
    </ToolShell>
  )
}
