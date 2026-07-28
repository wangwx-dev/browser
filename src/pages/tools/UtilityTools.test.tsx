import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Cheatsheets from './Cheatsheets'
import ConverterTools from './ConverterTools'
import CryptoTools from './CryptoTools'
import DiffViewer from './DiffViewer'
import DockerTools from './DockerTools'
import JsonTools from './JsonTools'
import MediaTools from './MediaTools'
import NetworkTools from './NetworkTools'
import TextTools from './TextTools'
import TimeTools from './TimeTools'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function toolCard(name: RegExp): HTMLElement {
  const heading = screen.getByRole('heading', { name })
  const card = heading.closest('.tool-card')
  expect(card).not.toBeNull()
  return card as HTMLElement
}

describe('ConverterTools', () => {
  it('converts numbers bidirectionally and clears invalid values', async () => {
    const user = userEvent.setup()
    render(<ConverterTools />)
    const decimal = screen.getByText(/Decimal/).closest('.input-group')!.querySelector('input')!
    const hexadecimal = screen.getByText(/Hexadecimal/).closest('.input-group')!.querySelector('input')!
    const octal = screen.getByText(/Octal/).closest('.input-group')!.querySelector('input')!
    const binary = screen.getByText(/Binary/).closest('.input-group')!.querySelector('input')!

    await user.type(decimal, '255')
    expect(hexadecimal).toHaveValue('FF')
    expect(octal).toHaveValue('377')
    expect(binary).toHaveValue('11111111')

    await user.clear(hexadecimal)
    await user.type(hexadecimal, '10')
    expect(decimal).toHaveValue('16')

    await user.clear(binary)
    await user.type(binary, 'not-binary')
    expect(decimal).toHaveValue('')
  })

  it('formats SQL for the selected dialect and clears an empty result', async () => {
    const user = userEvent.setup()
    render(<ConverterTools />)
    const input = screen.getByRole('textbox', { name: 'SQL 输入' })
    const output = screen.getByRole('textbox', { name: '格式化后的 SQL' })
    const dialect = screen.getByRole('combobox')

    await user.selectOptions(dialect, 'postgresql')
    await user.clear(input)
    await user.type(input, 'select id,name from users where active=true')
    await user.click(screen.getByRole('button', { name: /格式化/ }))
    expect((output as HTMLTextAreaElement).value).toMatch(/SELECT[\s\S]+FROM[\s\S]+users/i)

    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /格式化/ }))
    expect(output).toHaveValue('')
  })
})

describe('CryptoTools', () => {
  it('calculates standard hashes and removes stale output when input is cleared', async () => {
    const user = userEvent.setup()
    render(<CryptoTools />)
    const hashCard = toolCard(/Hash.*MD5.*SHA/i)
    const input = within(hashCard).getByRole('textbox')

    await user.type(input, 'hello')
    await user.click(within(hashCard).getByRole('button'))

    expect(hashCard).toHaveTextContent('5d41402abc4b2a76b9719d911017c592')
    expect(hashCard).toHaveTextContent('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')
    expect(hashCard).toHaveTextContent('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')

    await user.clear(input)
    expect(hashCard).not.toHaveTextContent('5d41402abc4b2a76b9719d911017c592')
    await user.click(within(hashCard).getByRole('button'))
    expect(hashCard.querySelector('.result-box')).toBeNull()
  })

  it('generates and verifies bcrypt hashes locally, including mismatch', async () => {
    const user = userEvent.setup()
    render(<CryptoTools />)
    const bcryptCard = toolCard(/Bcrypt/i)
    const [plainText, hashInput] = within(bcryptCard).getAllByRole('textbox')

    await user.type(plainText, 'correct horse')
    await user.click(within(bcryptCard).getByRole('button', { name: /Rounds=10/ }))
    const generatedHash = bcryptCard.textContent!.match(/\$2[aby]\$10\$[./A-Za-z0-9]{53}/)?.[0]
    expect(generatedHash).toBeTruthy()

    await user.type(hashInput, generatedHash!)
    await user.click(within(bcryptCard).getByRole('button', { name: /验证匹配/ }))
    expect(bcryptCard.querySelector('.result-box:last-child')).toHaveStyle({ color: '#4ade80' })

    await user.clear(plainText)
    await user.type(plainText, 'wrong password')
    await user.click(within(bcryptCard).getByRole('button', { name: /验证匹配/ }))
    expect(bcryptCard.querySelector('.result-box:last-child')).toHaveStyle({ color: '#ef4444' })
  })
})

describe('DiffViewer', () => {
  it('marks inserted, removed, unchanged, and blank lines after edits', async () => {
    const user = userEvent.setup()
    const { container } = render(<DiffViewer />)
    const [original, modified] = screen.getAllByRole('textbox')

    await user.clear(original)
    await user.type(original, 'same\nremoved\n')
    await user.clear(modified)
    await user.type(modified, 'same\nadded\n\n')

    expect(container.querySelectorAll('.diff-line-same').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.diff-line-removed').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.diff-line-added').length).toBeGreaterThan(0)
    expect(container.querySelector('.diff-code')).toHaveTextContent('added')
  })
})

describe('DockerTools', () => {
  it('converts docker run arguments to Compose and clears output for blank input', async () => {
    const user = userEvent.setup()
    render(<DockerTools />)
    const input = screen.getAllByRole('textbox').find((element) => !element.hasAttribute('readonly'))!
    const output = screen.getAllByRole('textbox').find((element) => element.hasAttribute('readonly'))!
    const convert = screen.getByRole('button')

    await user.click(convert)
    expect((output as HTMLTextAreaElement).value).toMatch(/services:[\s\S]+nginx/)

    await user.clear(input)
    await user.click(convert)
    expect(output).toHaveValue('')
  })
})

describe('JsonTools', () => {
  it('formats JSON and performs JSON/YAML, TypeScript, and JSONPath conversions', async () => {
    const user = userEvent.setup()
    render(<JsonTools />)
    const [input, query, output] = screen.getAllByRole('textbox')
    const buttons = screen.getAllByRole('button')

    await user.click(buttons[0])
    expect(output).toHaveValue('{\n  "hello": "world"\n}')

    await user.click(buttons[1])
    expect((output as HTMLTextAreaElement).value).toContain('hello: world')

    await user.clear(input)
    await user.type(input, 'name: Ada\nactive: true')
    await user.click(buttons[2])
    expect((output as HTMLTextAreaElement).value).toContain('"active": true')

    fireEvent.change(input, { target: { value: '{"user":{"id":1,"name":"Ada"}}' } })
    await user.click(buttons[3])
    expect((output as HTMLTextAreaElement).value).toMatch(/interface RootObject/)

    await user.clear(query)
    await user.type(query, '$.user.name')
    await user.click(buttons[4])
    expect(output).toHaveValue('[\n  "Ada"\n]')
  })

  it.each([
    [0, 'not-json', /Invalid JSON/],
    [1, 'not-json', /Invalid JSON/],
    [2, ': bad: yaml:', /Invalid YAML/],
    [3, 'not-json', /Invalid JSON/],
    [4, 'not-json', /JSONPath Error/],
  ])('reports conversion errors for action %i', async (buttonIndex, inputValue, message) => {
    const user = userEvent.setup()
    render(<JsonTools />)
    const input = screen.getAllByRole('textbox')[0]
    await user.clear(input)
    await user.type(input, inputValue)
    await user.click(screen.getAllByRole('button')[buttonIndex])
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})

describe('NetworkTools', () => {
  it('calculates IPv4 subnet boundaries including /31 and rejects malformed CIDR', async () => {
    render(<NetworkTools />)
    const cidr = screen.getAllByRole('textbox')[0]

    expect(screen.getByText('255.255.255.0')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.0')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.255')).toBeInTheDocument()

    fireEvent.change(cidr, { target: { value: '10.0.0.1/31' } })
    expect(screen.getByText('N/A - N/A')).toBeInTheDocument()

    fireEvent.change(cidr, { target: { value: '10.0.0/24' } })
    expect(screen.queryByText('255.255.255.0')).not.toBeInTheDocument()
  })

  it('parses URL components, repeated query values, defaults, and invalid input', async () => {
    const user = userEvent.setup()
    render(<NetworkTools />)
    const url = screen.getAllByRole('textbox')[1]

    await user.clear(url)
    await user.type(url, 'https://example.com/path?a=1&a=2')
    expect(screen.getByText('https:')).toBeInTheDocument()
    expect(screen.getByText('(default)')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    await user.clear(url)
    await user.type(url, 'not a url')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('TextTools', () => {
  it('updates text statistics and supports every case transformation', async () => {
    const user = userEvent.setup()
    render(<TextTools />)
    const editor = screen.getByRole('textbox')
    await user.clear(editor)
    await user.type(editor, 'helloWorld\nfoo_bar\nkebab-case')

    await user.click(screen.getByRole('button', { name: 'UPPERCASE' }))
    expect(editor).toHaveValue('HELLOWORLD\nFOO_BAR\nKEBAB-CASE')
    await user.click(screen.getByRole('button', { name: 'lowercase' }))
    expect(editor).toHaveValue('helloworld\nfoo_bar\nkebab-case')

    await user.clear(editor)
    await user.type(editor, 'hello_world\nfoo-bar')
    await user.click(screen.getByRole('button', { name: 'camelCase' }))
    expect(editor).toHaveValue('helloWorld\nfooBar')
    await user.click(screen.getByRole('button', { name: 'snake_case' }))
    expect(editor).toHaveValue('hello_world\nfoo_bar')
    await user.clear(editor)
    await user.type(editor, 'helloWorld\nfooBar')
    await user.click(screen.getByRole('button', { name: 'kebab-case' }))
    expect(editor).toHaveValue('hello-world\nfoo-bar')
  })

  it('sorts, de-duplicates, removes blanks, and generates local placeholder text', async () => {
    const user = userEvent.setup()
    render(<TextTools />)
    const editor = screen.getByRole('textbox')

    await user.clear(editor)
    await user.type(editor, 'pear\na\npear\n   \nbanana')
    const filterButtons = screen.getAllByRole('button').slice(5, 10)
    await user.click(filterButtons[0])
    expect((editor as HTMLTextAreaElement).value.split('\n')[0]).toBe('   ')
    await user.click(filterButtons[1])
    expect((editor as HTMLTextAreaElement).value.split('\n')[0]).toBe('pear')
    await user.click(filterButtons[2])
    expect((editor as HTMLTextAreaElement).value.split('\n')[0]).toBe('a')
    await user.click(filterButtons[3])
    expect((editor as HTMLTextAreaElement).value.match(/pear/g)).toHaveLength(1)
    await user.click(filterButtons[4])
    expect(editor).not.toHaveValue(expect.stringContaining('   '))

    await user.click(screen.getAllByRole('button')[10])
    expect((editor as HTMLTextAreaElement).value).toMatch(/^Lorem ipsum dolor sit amet/)
  })
})

describe('TimeTools', () => {
  it('converts seconds and milliseconds and validates timestamp input', async () => {
    const user = userEvent.setup()
    render(<TimeTools />)
    const [timestamp] = screen.getAllByRole('textbox')
    const convert = screen.getAllByRole('button')[0]

    await user.type(timestamp, '0')
    await user.click(convert)
    expect(screen.getByText(/ISO 8601: 1970-01-01T00:00:00.000Z/)).toBeInTheDocument()

    await user.clear(timestamp)
    await user.type(timestamp, '1718000000000')
    await user.click(convert)
    expect(screen.getByText(/2024-/)).toBeInTheDocument()

    await user.clear(timestamp)
    await user.type(timestamp, 'invalid')
    await user.click(convert)
    expect(screen.queryByText(/ISO 8601/)).not.toBeInTheDocument()

    await user.clear(timestamp)
    await user.click(convert)
    expect(screen.queryByText(/ISO 8601/)).not.toBeInTheDocument()
  })

  it('sets the current timestamp and explains valid, empty, and invalid cron input', async () => {
    const user = userEvent.setup()
    vi.spyOn(Date, 'now').mockReturnValue(1718000000000)
    render(<TimeTools />)
    const [timestamp, cron] = screen.getAllByRole('textbox')

    await user.click(screen.getAllByRole('button')[1])
    expect(timestamp).toHaveValue('1718000000000')
    await waitFor(() => expect(cron.closest('.tool-card')).not.toHaveTextContent(/waiting|绛夊緟/i))

    await user.clear(cron)
    await waitFor(() => expect(cron.closest('.tool-card')).toHaveTextContent(/等待输入/))
    await user.type(cron, 'invalid cron')
    await waitFor(() => expect(cron.closest('.tool-card')!.querySelector('.result-box')).not.toBeEmptyDOMElement())
  })
})

describe('MediaTools', () => {
  beforeEach(() => {
    class FakeFileReader {
      result: string | ArrayBuffer | null = null
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null

      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,dGVzdA==`
        this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>)
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader)
  })

  it('converts uploaded and dropped images to a local data URL', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaTools />)
    const file = new File(['test'], 'pixel.png', { type: 'image/png' })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(fileInput, file)
    expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'data:image/png;base64,dGVzdA==')
    expect(screen.getByPlaceholderText(/Base64/)).toHaveValue('data:image/png;base64,dGVzdA==')

    const dropZone = fileInput.parentElement!
    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveStyle({ background: 'rgba(56, 189, 248, 0.1)' })
    fireEvent.dragLeave(dropZone)
    fireEvent.dragOver(dropZone)
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })
    expect(dropZone).toHaveStyle({ background: 'rgba(0, 0, 0, 0.2)' })
  })

  it('updates QR content and size and keeps a non-empty fallback value', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaTools />)
    const textareas = screen.getAllByRole('textbox')
    const qrInput = textareas.find((element) => !element.hasAttribute('readonly'))!
    const range = screen.getByRole('slider')

    await user.clear(qrInput)
    fireEvent.change(range, { target: { value: '320' } })
    expect(range).toHaveValue('320')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('Cheatsheets', () => {
  it('filters commands, switches sheets, and copies a command with transient feedback', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<Cheatsheets />)
    const search = screen.getByRole('textbox')

    await user.type(search, 'definitely-no-command')
    expect(screen.queryAllByTitle(/复制命令/)).toHaveLength(0)
    await user.clear(search)

    const copyButton = screen.getAllByTitle(/复制命令/)[0]
    const command = copyButton.parentElement!.querySelector('code')!.textContent!
    await user.click(copyButton)
    expect(writeText).toHaveBeenCalledWith(command)

    const tabs = screen.getAllByRole('button').filter((button) => button.querySelector('svg') && !button.title)
    await user.click(tabs[1])
    expect(search).toHaveValue('')
  })

  it('keeps the page usable when clipboard permission is denied', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    render(<Cheatsheets />)

    await user.click(screen.getAllByTitle(/复制命令/)[0])
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to copy', expect.any(Error)))
  })
})
