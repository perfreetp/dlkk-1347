import type { LogEntry, LogLevel, FilterOptions, AggregatedError } from '../types'
import { getExceptionType } from './logParser'

export function filterLogs(entries: LogEntry[], options: FilterOptions): LogEntry[] {
  let filtered = [...entries]
  
  if (options.levels.length > 0) {
    filtered = filtered.filter(e => options.levels.includes(e.level))
  }
  
  if (options.threads.length > 0) {
    filtered = filtered.filter(e => e.thread && options.threads.includes(e.thread))
  }
  
  if (options.loggers.length > 0) {
    filtered = filtered.filter(e => e.logger && options.loggers.includes(e.logger))
  }
  
  if (options.errorCodes.length > 0) {
    filtered = filtered.filter(e => e.errorCode && options.errorCodes.includes(e.errorCode))
  }
  
  if (options.startTime) {
    filtered = filtered.filter(e => e.timestamp >= options.startTime!)
  }
  
  if (options.endTime) {
    filtered = filtered.filter(e => e.timestamp <= options.endTime!)
  }
  
  if (options.keyword.trim()) {
    const keyword = options.keyword.trim()
    
    if (options.isRegex) {
      try {
        const flags = options.caseSensitive ? 'g' : 'gi'
        const regex = new RegExp(keyword, flags)
        filtered = filtered.filter(e => regex.test(e.raw))
      } catch {
        filtered = filtered.filter(e => 
          (options.caseSensitive ? e.raw : e.raw.toLowerCase()).includes(
            options.caseSensitive ? keyword : keyword.toLowerCase()
          )
        )
      }
    } else {
      filtered = filtered.filter(e => 
        (options.caseSensitive ? e.raw : e.raw.toLowerCase()).includes(
          options.caseSensitive ? keyword : keyword.toLowerCase()
        )
      )
    }
  }

  if (options.onlyStarred) {
    filtered = filtered.filter(e => e.isStarred)
  }

  if (options.tagFilter && options.tagFilter.length > 0) {
    filtered = filtered.filter(e =>
      options.tagFilter!.some(tag => e.tags.includes(tag))
    )
  }

  if (options.sourceFilter && options.sourceFilter.length > 0) {
    filtered = filtered.filter(e =>
      e.sourceId && options.sourceFilter!.includes(e.sourceId)
    )
  }
  
  return filtered
}

export function searchHighlights(text: string, keyword: string, isRegex: boolean, caseSensitive: boolean): Array<{start: number; end: number}> {
  if (!keyword.trim()) return []
  
  const results: Array<{start: number; end: number}> = []
  
  try {
    if (isRegex) {
      const flags = caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(keyword, flags)
      let match: RegExpExecArray | null
      
      while ((match = regex.exec(text)) !== null) {
        results.push({ start: match.index, end: match.index + match[0].length })
        
        if (match[0].length === 0) {
          regex.lastIndex++
        }
      }
    } else {
      const searchText = caseSensitive ? text : text.toLowerCase()
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
      
      let index = 0
      while ((index = searchText.indexOf(searchKeyword, index)) !== -1) {
        results.push({ start: index, end: index + searchKeyword.length })
        index += searchKeyword.length
      }
    }
  } catch {
    // ignore errors
  }
  
  return results
}

export function getContextEntries(entries: LogEntry[], targetId: string, contextSize: number = 5): LogEntry[] {
  const targetIndex = entries.findIndex(e => e.id === targetId)
  if (targetIndex === -1) return []
  
  const start = Math.max(0, targetIndex - contextSize)
  const end = Math.min(entries.length - 1, targetIndex + contextSize)
  
  return entries.slice(start, end + 1)
}

export function aggregateErrors(entries: LogEntry[]): AggregatedError[] {
  const errorEntries = entries.filter(e => e.level === 'error' || e.level === 'fatal')
  
  if (errorEntries.length === 0) return []
  
  const groups = new Map<string, LogEntry[]>()
  
  for (const entry of errorEntries) {
    const pattern = getErrorPattern(entry)
    
    if (!groups.has(pattern)) {
      groups.set(pattern, [])
    }
    groups.get(pattern)!.push(entry)
  }
  
  const aggregated: AggregatedError[] = []
  
  for (const [pattern, groupEntries] of groups) {
    const sorted = [...groupEntries].sort((a, b) => a.timestamp - b.timestamp)
    
    aggregated.push({
      id: `agg-${pattern.substring(0, 20).replace(/\s/g, '-')}-${Date.now()}`,
      pattern,
      count: groupEntries.length,
      firstOccurrence: sorted[0].timestamp,
      lastOccurrence: sorted[sorted.length - 1].timestamp,
      sampleEntries: sorted.slice(0, 5),
      affectedFiles: [...new Set(groupEntries.map(e => e.sourceFile).filter(Boolean) as string[])],
    })
  }
  
  return aggregated.sort((a, b) => b.count - a.count)
}

function getErrorPattern(entry: LogEntry): string {
  const exceptionType = getExceptionType(entry)
  if (exceptionType) {
    return exceptionType
  }
  
  const errorCode = entry.errorCode
  if (errorCode) {
    return errorCode
  }
  
  const firstLine = entry.message.split('\n')[0]
  const cleaned = firstLine
    .replace(/\b\d+\b/g, 'N')
    .replace(/0x[0-9a-fA-F]+/g, '0xN')
    .replace(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/gi, 'UUID')
    .replace(/["'][^"']{20,}["']/g, '...')
    .trim()
  
  return cleaned.substring(0, 100)
}

export function getUniqueValues(entries: LogEntry[], key: keyof LogEntry): string[] {
  const values = new Set<string>()
  
  for (const entry of entries) {
    const value = entry[key]
    if (value !== undefined && value !== null && value !== '') {
      values.add(String(value))
    }
  }
  
  return [...values].sort()
}

export function getLogLevelCount(entries: LogEntry[]): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
    unknown: 0,
  }
  
  for (const entry of entries) {
    counts[entry.level]++
  }
  
  return counts
}

export function getTimelineData(entries: LogEntry[], bucketSize: number = 60000): Array<{time: number; count: number; levels: Record<LogLevel, number>}> {
  if (entries.length === 0) return []
  
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  const startTime = Math.floor(sorted[0].timestamp / bucketSize) * bucketSize
  const endTime = Math.ceil(sorted[sorted.length - 1].timestamp / bucketSize) * bucketSize
  
  const buckets: Map<number, { count: number; levels: Record<LogLevel, number> }> = new Map()
  
  for (let time = startTime; time <= endTime; time += bucketSize) {
    buckets.set(time, {
      count: 0,
      levels: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0, unknown: 0 }
    })
  }
  
  for (const entry of sorted) {
    const bucketTime = Math.floor(entry.timestamp / bucketSize) * bucketSize
    const bucket = buckets.get(bucketTime)
    
    if (bucket) {
      bucket.count++
      bucket.levels[entry.level]++
    }
  }
  
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, data]) => ({ time, ...data }))
}

export function compareEntries(entry1: LogEntry, entry2: LogEntry): {
  timeDiff: number
  levelDiff: boolean
  messageDiff: string[]
} {
  const msg1 = entry1.message.split('\n')
  const msg2 = entry2.message.split('\n')
  
  const messageDiff: string[] = []
  const maxLen = Math.max(msg1.length, msg2.length)
  
  for (let i = 0; i < maxLen; i++) {
    const line1 = msg1[i] || ''
    const line2 = msg2[i] || ''
    
    if (line1 !== line2) {
      messageDiff.push(`- ${line1}`)
      messageDiff.push(`+ ${line2}`)
    }
  }
  
  return {
    timeDiff: entry2.timestamp - entry1.timestamp,
    levelDiff: entry1.level !== entry2.level,
    messageDiff,
  }
}
