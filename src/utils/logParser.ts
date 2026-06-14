import type { LogEntry, LogLevel } from '../types'

export const TIME_PATTERNS: { regex: RegExp; format: string; name: string }[] = [
  { regex: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d{1,3}/, format: 'ISO', name: 'ISO 8601' },
  { regex: /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}[.,]\d{1,3}/, format: 'SLASH', name: '斜线格式' },
  { regex: /\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/, format: 'DMY', name: '日-月-年' },
  { regex: /\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}:\d{2}/, format: 'CHINESE', name: '中文格式' },
  { regex: /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/, format: 'BRACKET', name: '方括号格式' },
  { regex: /\d{2}:\d{2}:\d{2}[.,]\d{1,3}/, format: 'TIME_ONLY', name: '仅时间' },
]

export const LEVEL_PATTERNS: { level: LogLevel; patterns: RegExp[] }[] = [
  { level: 'fatal', patterns: [/\bFATAL\b/i, /\bCRITICAL\b/i, /\bSEVERE\b/i, /💀/, /🚨/] },
  { level: 'error', patterns: [/\bERROR\b/i, /\bERR\b/i, /\bException\b/, /\bError\b/, /❌/, /🔥/] },
  { level: 'warn', patterns: [/\bWARN\b/i, /\bWARNING\b/i, /\bWarnung\b/i, /⚠️/, /⚡/] },
  { level: 'info', patterns: [/\bINFO\b/i, /\bINFORMATION\b/i, /\bNotice\b/i, /ℹ️/, /📝/] },
  { level: 'debug', patterns: [/\bDEBUG\b/i, /\bTRACE\b/i, /\bVERBOSE\b/i, /\bLOG\b/i, /🔍/, /🐛/] },
]

export const THREAD_PATTERNS: RegExp[] = [
  /\[thread:\s*([^\]]+)\]/i,
  /\[Thread-(\d+)\]/i,
  /thread\s*[=:]\s*["']?([^"'\s,]+)/i,
  /tid\s*[=:]\s*(\d+)/i,
  /#(\d+)/,
  /<(\w+)>/,
]

export const ERROR_CODE_PATTERNS: RegExp[] = [
  /\b([A-Z]{2,}_\d{3,})\b/,
  /\berror[_-]?code\s*[=:]\s*["']?([^"'\s,]+)/i,
  /\berr[_-]?code\s*[=:]\s*["']?([^"'\s,]+)/i,
  /\[Error:\s*([^\]]+)\]/i,
  /\b(\d{5,})\b/,
]

const LOGGER_PATTERNS: RegExp[] = [
  /\b([\w.]+)\s*[-:|]\s/,
  /\[([\w.]+)\]/,
  /<([\w.]+)>/,
]

let entryIdCounter = 0

export function generateId(): string {
  entryIdCounter++
  return `entry-${Date.now()}-${entryIdCounter}`
}

export function detectTimeFormat(content: string): { regex: RegExp; format: string; name: string } | null {
  const firstLines = content.split('\n').slice(0, 50).join('\n')
  
  for (const pattern of TIME_PATTERNS) {
    if (pattern.regex.test(firstLines)) {
      return pattern
    }
  }
  
  return null
}

export function detectLogLevel(line: string): LogLevel {
  for (const { level, patterns } of LEVEL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return level
      }
    }
  }
  return 'unknown'
}

export function extractThread(line: string): string | undefined {
  for (const pattern of THREAD_PATTERNS) {
    const match = line.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return undefined
}

export function extractErrorCode(line: string): string | undefined {
  for (const pattern of ERROR_CODE_PATTERNS) {
    const match = line.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return undefined
}

export function extractLogger(line: string): string | undefined {
  for (const pattern of LOGGER_PATTERNS) {
    const match = line.match(pattern)
    if (match && match[1] && match[1].length < 50 && !match[1].match(/^\d+$/)) {
      return match[1].trim()
    }
  }
  return undefined
}

export function parseTimestamp(timeStr: string): number {
  const cleanStr = timeStr.replace(/[\[\]]/g, '').replace(/[T ]/, ' ')
  
  try {
    let date: Date
    
    if (/^\d{2}:\d{2}:\d{2}/.test(cleanStr)) {
      const today = new Date().toISOString().split('T')[0]
      date = new Date(`${today} ${cleanStr}`)
    } else if (/^\d{4}年/.test(cleanStr)) {
      const match = cleanStr.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2}):(\d{2})/)
      if (match) {
        date = new Date(`${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`)
      } else {
        date = new Date(cleanStr)
      }
    } else if (/^\d{2}-\d{2}-\d{4}/.test(cleanStr)) {
      const match = cleanStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
      if (match) {
        date = new Date(`${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}:${match[6]}`)
      } else {
        date = new Date(cleanStr)
      }
    } else {
      date = new Date(cleanStr.replace(',', '.'))
    }
    
    const timestamp = date.getTime()
    if (!isNaN(timestamp) && timestamp > 0) {
      return timestamp
    }
  } catch {
    // ignore
  }
  
  return Date.now()
}

export function parseLogContent(content: string, sourceFile?: string): LogEntry[] {
  const entries: LogEntry[] = []
  const lines = content.split('\n')
  
  const timePattern = detectTimeFormat(content)
  
  let currentEntry: Partial<LogEntry> | null = null
  let lineNumber = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    lineNumber++
    
    if (!line.trim()) continue
    
    const isNewLogEntry = timePattern ? timePattern.regex.test(line) : /^[\d\[\]/-]/.test(line)
    
    if (isNewLogEntry || !currentEntry) {
      if (currentEntry && currentEntry.raw) {
        entries.push(finalizeEntry(currentEntry as LogEntry))
      }
      
      currentEntry = {
        id: generateId(),
        raw: line,
        lineNumber,
        sourceFile,
        tags: [],
        isStarred: false,
      }
      
      if (timePattern) {
        const timeMatch = line.match(timePattern.regex)
        if (timeMatch) {
          currentEntry.timestampStr = timeMatch[0]
          currentEntry.timestamp = parseTimestamp(timeMatch[0])
        }
      }
      
      currentEntry.level = detectLogLevel(line)
      currentEntry.thread = extractThread(line)
      currentEntry.errorCode = extractErrorCode(line)
      currentEntry.logger = extractLogger(line)
      
      const messageStart = timePattern 
        ? (line.match(timePattern.regex)?.index ?? 0) + (line.match(timePattern.regex)?.[0]?.length ?? 0)
        : 0
      
      let message = line.substring(messageStart).trim()
      message = message.replace(/^\s*[-:|]\s*/, '')
      
      const levelMatch = line.match(/\b(FATAL|ERROR|WARN|INFO|DEBUG|TRACE|CRITICAL)\b/i)
      if (levelMatch) {
        const levelEnd = (levelMatch.index ?? 0) + levelMatch[0].length
        message = line.substring(levelEnd).replace(/^\s*[-:|]\s*/, '').trim()
      }
      
      currentEntry.message = message || line
    } else {
      currentEntry.raw += '\n' + line
      currentEntry.message += '\n' + line
    }
  }
  
  if (currentEntry && currentEntry.raw) {
    entries.push(finalizeEntry(currentEntry as LogEntry))
  }
  
  return entries
}

function finalizeEntry(entry: LogEntry): LogEntry {
  if (!entry.timestamp) {
    entry.timestamp = Date.now()
    entry.timestampStr = ''
  }
  
  if (entry.message && entry.message.length > 5000) {
    entry.message = entry.message.substring(0, 5000) + '... [truncated]'
  }
  
  return entry
}

export function isMultilineStart(line: string): boolean {
  return /^\s+at\s+/.test(line) || /^\s+Caused by:/.test(line) || /^\s+\.\.\. \d+ more/.test(line)
}

export function getExceptionType(entry: LogEntry): string | null {
  const match = entry.message.match(/([\w.]+(?:Exception|Error))/i)
  if (match) {
    return match[1]
  }
  return null
}

export function extractStackTrace(message: string): string[] {
  const lines = message.split('\n')
  const stackLines: string[] = []
  
  for (const line of lines) {
    if (/^\s+at\s+/.test(line) || /^\s+Caused by:/.test(line) || /^\s+\.\.\. \d+ more/.test(line)) {
      stackLines.push(line.trim())
    }
  }
  
  return stackLines
}
