import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DataTools from './DataTools'
import {
  PASSWORD_CHARSET,
  PASSWORD_GROUPS,
  generateSecurePassword,
  type CryptoRandomSource,
} from './data-tools-random'

const writeText = vi.fn<(value: string) => Promise<void>>()

beforeEach(() => {
  writeText.mockResolvedValue(undefined)
})

function setupUser() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return user
}

function deterministicCrypto(bytes: number[]): CryptoRandomSource {
  let cursor = 0
  return {
    getRandomValues: vi.fn((target: Uint8Array) => {
      for (let index = 0; index < target.length; index += 1) {
        target[index] = bytes[cursor % bytes.length]
        cursor += 1
      }
      return target
    }),
  } as CryptoRandomSource
}

describe('generateSecurePassword', () => {
  it('uses Web Crypto rejection sampling and includes every character group', () => {
    const source = deterministicCrypto([255, 0, 5, 10, 15, 20, 25, 30, 35, 40])
    const password = generateSecurePassword(24, source)

    expect(source.getRandomValues).toHaveBeenCalled()
    expect(password).toHaveLength(24)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[2-9]/)
    expect([...password].some((character) => PASSWORD_GROUPS[3].includes(character))).toBe(true)
    expect([...password].every((character) => PASSWORD_CHARSET.includes(character))).toBe(true)
  })

  it('rejects lengths outside the supported boundary', () => {
    const source = deterministicCrypto([0])
    expect(() => generateSecurePassword(3, source)).toThrow(RangeError)
    expect(() => generateSecurePassword(129, source)).toThrow(RangeError)
  })
})

describe('DataTools', () => {
  it('generates, copies and clears the requested number of UUIDs', async () => {
    const user = setupUser()
    render(<DataTools />)

    const countInput = screen.getByRole('spinbutton', { name: '生成数量' })
    await user.clear(countInput)
    await user.type(countInput, '3')
    await user.click(screen.getByRole('button', { name: '生成 UUID' }))

    const output = screen.getByRole('region', { name: '生成结果' })
    const uuids = within(output).getByText((content) => content.includes('-')).textContent?.split('\n') ?? []
    expect(uuids).toHaveLength(3)
    uuids.forEach((uuid) => expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
    expect(screen.getByRole('status')).toHaveTextContent('已在本机生成 3 个 UUID v4。')

    await user.click(screen.getByRole('button', { name: '复制 UUID' }))
    expect(writeText).toHaveBeenCalledWith(uuids.join('\n'))

    await user.click(screen.getByRole('button', { name: '清空 UUID' }))
    expect(output).toHaveTextContent('设置数量后生成 UUID。')
  })

  it('loads examples and reports invalid integer input accessibly', async () => {
    const user = setupUser()
    render(<DataTools />)

    await user.click(screen.getByRole('button', { name: 'UUID 示例' }))
    expect(screen.getByRole('spinbutton', { name: '生成数量' })).toHaveValue(3)

    const passwordLength = screen.getByRole('spinbutton', { name: '密码长度' })
    await user.clear(passwordLength)
    await user.type(passwordLength, '8.5')
    await user.click(screen.getByRole('button', { name: '生成密码' }))

    expect(screen.getByRole('alert')).toHaveTextContent('密码长度必须是整数。')
    expect(passwordLength).toHaveAttribute('aria-invalid', 'true')
  })

  it('generates passwords without Math.random or network access', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used')
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const user = setupUser()
    render(<DataTools />)

    await user.click(screen.getByRole('button', { name: '生成密码' }))

    const passwordRegion = screen.getByRole('region', { name: '密码结果' })
    const password = within(passwordRegion).getByText((content) => content.length === 20).textContent ?? ''
    expect(password).toHaveLength(20)
    expect(screen.getByRole('status')).toHaveTextContent('已使用 Web Crypto 在本机生成 20 位密码。')
    expect(randomSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '复制密码' }))
    expect(writeText).toHaveBeenCalledWith(password)
  })
})
