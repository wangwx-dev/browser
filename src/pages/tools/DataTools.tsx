import { KeyRound, ListPlus } from 'lucide-react'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import {
  ToolActions,
  ToolFeedback,
  ToolOutput,
  ToolSection,
  ToolShell,
  type ToolFeedbackState,
} from '../../components/tools/ToolShell'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  generateSecurePassword,
} from './data-tools-random'

const UUID_MIN_COUNT = 1
const UUID_MAX_COUNT = 1000

interface IntegerValidationResult {
  value?: number
  error?: string
}

function validateInteger(
  rawValue: string,
  label: string,
  minimum: number,
  maximum: number,
): IntegerValidationResult {
  const value = Number(rawValue.trim())
  if (!rawValue.trim() || !Number.isInteger(value)) {
    return { error: `${label}必须是整数。` }
  }
  if (value < minimum || value > maximum) {
    return { error: `${label}需在 ${minimum} 到 ${maximum} 之间。` }
  }
  return { value }
}

export default function DataTools() {
  const [uuidCount, setUuidCount] = useState('5')
  const [uuidOutput, setUuidOutput] = useState('')
  const [uuidFeedback, setUuidFeedback] = useState<ToolFeedbackState | null>(null)

  const [passwordLength, setPasswordLength] = useState('20')
  const [passwordOutput, setPasswordOutput] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState<ToolFeedbackState | null>(null)

  const handleGenerateUUIDs = () => {
    const validation = validateInteger(
      uuidCount,
      '生成数量',
      UUID_MIN_COUNT,
      UUID_MAX_COUNT,
    )
    if (validation.value === undefined) {
      setUuidFeedback({ tone: 'error', message: validation.error ?? '生成数量无效。' })
      return
    }

    const uuids = Array.from({ length: validation.value }, () => uuidv4())
    setUuidOutput(uuids.join('\n'))
    setUuidFeedback({
      tone: 'success',
      message: `已在本机生成 ${validation.value} 个 UUID v4。`,
    })
  }

  const handleGeneratePassword = () => {
    const validation = validateInteger(
      passwordLength,
      '密码长度',
      PASSWORD_MIN_LENGTH,
      PASSWORD_MAX_LENGTH,
    )
    if (validation.value === undefined) {
      setPasswordFeedback({ tone: 'error', message: validation.error ?? '密码长度无效。' })
      return
    }

    try {
      const password = generateSecurePassword(validation.value)
      setPasswordOutput(password)
      setPasswordFeedback({
        tone: 'success',
        message: `已使用 Web Crypto 在本机生成 ${validation.value} 位密码。`,
      })
    } catch {
      setPasswordOutput('')
      setPasswordFeedback({
        tone: 'error',
        message: '当前浏览器无法使用安全随机源，未生成密码。',
      })
    }
  }

  return (
    <ToolShell
      title="Mock 数据与随机生成器"
      description="快速生成开发测试数据；结果不会自动上传或写入云端。"
    >
      <ToolSection
        title="UUID / GUID 批量生成器"
        description="生成标准 UUID v4，一次最多 1000 个。"
      >
        <div className="tool-field">
          <label htmlFor="uuid-count">生成数量</label>
          <input
            id="uuid-count"
            type="number"
            inputMode="numeric"
            value={uuidCount}
            onChange={(event) => {
              setUuidCount(event.currentTarget.value)
              setUuidFeedback(null)
            }}
            min={UUID_MIN_COUNT}
            max={UUID_MAX_COUNT}
            step="1"
            aria-describedby="uuid-count-hint"
            aria-invalid={uuidFeedback?.tone === 'error'}
          />
          <small id="uuid-count-hint">请输入 {UUID_MIN_COUNT}–{UUID_MAX_COUNT} 的整数。</small>
        </div>

        <ToolActions
          copyText={uuidOutput}
          copyLabel="复制 UUID"
          copySuccessMessage="UUID 已复制到剪贴板。"
          onClear={() => {
            setUuidOutput('')
            setUuidFeedback(null)
          }}
          clearLabel="清空 UUID"
          clearDisabled={!uuidOutput}
          clearSuccessMessage="UUID 结果已清空。"
          onExample={() => {
            setUuidCount('3')
            setUuidOutput('')
            setUuidFeedback(null)
          }}
          exampleLabel="UUID 示例"
          exampleSuccessMessage="示例数量 3 已填入。"
        >
          <button type="button" className="tool-action-button" onClick={handleGenerateUUIDs}>
            <ListPlus aria-hidden="true" size={17} />
            生成 UUID
          </button>
        </ToolActions>

        <ToolFeedback feedback={uuidFeedback} />
        <ToolOutput
          id="uuid-output"
          label="生成结果"
          value={uuidOutput}
          emptyMessage="设置数量后生成 UUID。"
          meta={uuidOutput ? `${uuidOutput.split('\n').length} 条` : undefined}
        />
      </ToolSection>

      <ToolSection
        title="安全随机密码生成器"
        description="使用 Web Crypto 均匀取样，并确保至少包含大小写字母、数字与符号。"
      >
        <div className="tool-field">
          <label htmlFor="password-length">密码长度</label>
          <input
            id="password-length"
            type="number"
            inputMode="numeric"
            value={passwordLength}
            onChange={(event) => {
              setPasswordLength(event.currentTarget.value)
              setPasswordFeedback(null)
            }}
            min={PASSWORD_MIN_LENGTH}
            max={PASSWORD_MAX_LENGTH}
            step="1"
            aria-describedby="password-length-hint"
            aria-invalid={passwordFeedback?.tone === 'error'}
          />
          <small id="password-length-hint">
            支持 {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} 位；默认排除 0/O、1/l/I 等易混淆字符。
          </small>
        </div>

        <ToolActions
          copyText={passwordOutput}
          copyLabel="复制密码"
          copySuccessMessage="密码已复制到剪贴板。"
          onClear={() => {
            setPasswordOutput('')
            setPasswordFeedback(null)
          }}
          clearLabel="清空密码"
          clearDisabled={!passwordOutput}
          clearSuccessMessage="密码结果已清空。"
          onExample={() => {
            setPasswordLength('24')
            setPasswordOutput('')
            setPasswordFeedback(null)
          }}
          exampleLabel="密码示例"
          exampleSuccessMessage="示例长度 24 已填入。"
        >
          <button type="button" className="tool-action-button" onClick={handleGeneratePassword}>
            <KeyRound aria-hidden="true" size={17} />
            生成密码
          </button>
        </ToolActions>

        <ToolFeedback feedback={passwordFeedback} />
        <ToolOutput
          id="password-output"
          label="密码结果"
          value={passwordOutput}
          emptyMessage="设置长度后生成安全随机密码。"
          sensitive
          meta={passwordOutput ? `${passwordOutput.length} 位` : undefined}
        />
      </ToolSection>
    </ToolShell>
  )
}
