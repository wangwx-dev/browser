export const PASSWORD_MIN_LENGTH = 4
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_GROUPS = [
  'abcdefghijkmnopqrstuvwxyz',
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%^&*()-_=+[]{};:,.?/|~',
] as const

export const PASSWORD_CHARSET = PASSWORD_GROUPS.join('')

export type CryptoRandomSource = Pick<Crypto, 'getRandomValues'>

function createSecureRandomIndex(source: CryptoRandomSource) {
  const randomBytes = new Uint8Array(64)
  let cursor = randomBytes.length

  return (upperBound: number): number => {
    if (!Number.isInteger(upperBound) || upperBound < 2 || upperBound > 256) {
      throw new RangeError('Secure random index bound is invalid.')
    }

    const rejectionLimit = Math.floor(256 / upperBound) * upperBound
    while (true) {
      if (cursor >= randomBytes.length) {
        source.getRandomValues(randomBytes)
        cursor = 0
      }

      const candidate = randomBytes[cursor]
      cursor += 1
      if (candidate < rejectionLimit) return candidate % upperBound
    }
  }
}

export function generateSecurePassword(
  length: number,
  source: CryptoRandomSource | undefined = globalThis.crypto,
): string {
  if (!Number.isInteger(length) || length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new RangeError(`Password length must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH}.`)
  }
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure random source is unavailable.')
  }

  const secureRandomIndex = createSecureRandomIndex(source)
  const characters = PASSWORD_GROUPS.map((group) => group[secureRandomIndex(group.length)])

  while (characters.length < length) {
    characters.push(PASSWORD_CHARSET[secureRandomIndex(PASSWORD_CHARSET.length)])
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1)
    const current = characters[index]
    characters[index] = characters[swapIndex]
    characters[swapIndex] = current
  }

  return characters.join('')
}
