export function safeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确，请检查后重试。'
  if (/email not confirmed/i.test(message)) return '邮箱尚未验证，请先完成验证。'
  if (/already registered|already exists/i.test(message)) return '这个邮箱已经注册，请直接登录。'
  if (/rate limit|too many/i.test(message)) return '尝试次数过多，请稍后再试。'
  if (/password/i.test(message) && /short|weak|least/i.test(message)) {
    return '密码强度不足，请使用至少 8 位密码。'
  }
  return '暂时无法完成认证，请检查网络后重试。'
}
