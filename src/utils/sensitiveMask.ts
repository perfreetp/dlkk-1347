import type { SensitiveRule, LogEntry } from '../types'

export const DEFAULT_SENSITIVE_RULES: SensitiveRule[] = [
  {
    id: 'phone',
    name: '手机号',
    pattern: '1[3-9]\\d{9}',
    replacement: '1***-****-***',
    enabled: true,
  },
  {
    id: 'email',
    name: '邮箱地址',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    replacement: '***@***.com',
    enabled: true,
  },
  {
    id: 'id-card',
    name: '身份证号',
    pattern: '[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
    replacement: '****************',
    enabled: true,
  },
  {
    id: 'password',
    name: '密码字段',
    pattern: '(password|pwd|passwd)["\\s:=]+["\']?[^"\'\\s,;]+',
    replacement: '$1=***',
    enabled: true,
  },
  {
    id: 'token',
    name: 'Token/密钥',
    pattern: '(token|access_token|secret|api_key|apikey)["\\s:=]+["\']?[A-Za-z0-9._\\-]{10,}',
    replacement: '$1=***',
    enabled: true,
  },
  {
    id: 'ip-address',
    name: 'IP 地址',
    pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    replacement: '***.***.***.***',
    enabled: false,
  },
  {
    id: 'uuid',
    name: 'UUID',
    pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    replacement: '********-****-****-****-************',
    enabled: false,
  },
]

export function maskSensitive(text: string, rules: SensitiveRule[]): string {
  let result = text
  
  const enabledRules = rules.filter(r => r.enabled)
  
  for (const rule of enabledRules) {
    try {
      const regex = new RegExp(rule.pattern, 'gi')
      result = result.replace(regex, rule.replacement)
    } catch {
      // skip invalid patterns
    }
  }
  
  return result
}

export function maskLogEntries(entries: LogEntry[], rules: SensitiveRule[]): LogEntry[] {
  return entries.map(entry => ({
    ...entry,
    raw: maskSensitive(entry.raw, rules),
    message: maskSensitive(entry.message, rules),
  }))
}

export function addSensitiveRule(rules: SensitiveRule[], rule: Omit<SensitiveRule, 'id'>): SensitiveRule[] {
  return [...rules, { ...rule, id: `rule-${Date.now()}` }]
}

export function updateSensitiveRule(rules: SensitiveRule[], ruleId: string, updates: Partial<SensitiveRule>): SensitiveRule[] {
  return rules.map(rule => 
    rule.id === ruleId ? { ...rule, ...updates } : rule
  )
}

export function deleteSensitiveRule(rules: SensitiveRule[], ruleId: string): SensitiveRule[] {
  return rules.filter(rule => rule.id !== ruleId)
}
