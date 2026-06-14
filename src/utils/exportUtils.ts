import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { LogPackage, LogEntry, ReportData, SensitiveRule } from '../types'
import { formatReportAsMarkdown, generateReport } from './reportGenerator'
import { maskLogEntries } from './sensitiveMask'

export interface DiagnosticPackageOptions {
  includeOriginal: boolean
  maskSensitive: boolean
  includeReport: boolean
  includeSummary: boolean
  sensitiveRules?: SensitiveRule[]
}

export async function exportDiagnosticPackage(
  logPackage: LogPackage,
  options: DiagnosticPackageOptions
): Promise<void> {
  const zip = new JSZip()
  
  const baseName = logPackage.name || `diagnostic-${Date.now()}`
  
  let entries: LogEntry[] = []
  for (const file of logPackage.files) {
    entries = entries.concat(file.entries)
  }
  
  if (options.maskSensitive && options.sensitiveRules) {
    entries = maskLogEntries(entries, options.sensitiveRules)
  }
  
  if (options.includeOriginal) {
    const logsFolder = zip.folder('logs')
    if (logsFolder) {
      for (const file of logPackage.files) {
        let content = file.entries.map(e => e.raw).join('\n')
        
        if (options.maskSensitive && options.sensitiveRules) {
          const maskedEntries = maskLogEntries(file.entries, options.sensitiveRules)
          content = maskedEntries.map(e => e.raw).join('\n')
        }
        
        logsFolder.file(file.name, content)
      }
    }
  }
  
  if (options.includeReport) {
    const report = generateReport(logPackage, entries)
    const reportMarkdown = formatReportAsMarkdown(report, logPackage.name)
    zip.file('report.md', reportMarkdown)
  }
  
  if (options.includeSummary) {
    const summary = generateSummaryFile(logPackage, entries)
    zip.file('summary.txt', summary)
  }
  
  const metadata = generateMetadata(logPackage, entries, options)
  zip.file('metadata.json', JSON.stringify(metadata, null, 2))
  
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${baseName}.zip`)
}

function generateSummaryFile(logPackage: LogPackage, entries: LogEntry[]): string {
  let summary = ''
  
  summary += `日志分析摘要\n`
  summary += `================\n\n`
  summary += `项目: ${logPackage.project || '未知'}\n`
  summary += `版本: ${logPackage.version || '未知'}\n`
  summary += `日志包: ${logPackage.name}\n`
  summary += `生成时间: ${new Date().toLocaleString()}\n\n`
  
  summary += `文件列表:\n`
  for (const file of logPackage.files) {
    summary += `  - ${file.name} (${formatFileSize(file.size)})\n`
  }
  summary += '\n'
  
  const levelCounts: Record<string, number> = {
    debug: 0, info: 0, warn: 0, error: 0, fatal: 0, unknown: 0
  }
  
  for (const entry of entries) {
    levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1
  }
  
  summary += `日志级别统计:\n`
  for (const [level, count] of Object.entries(levelCounts)) {
    if (count > 0) {
      summary += `  ${level.toUpperCase()}: ${count}\n`
    }
  }
  summary += `  总计: ${entries.length}\n\n`
  
  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
    summary += `时间范围:\n`
    summary += `  开始: ${new Date(sorted[0].timestamp).toLocaleString()}\n`
    summary += `  结束: ${new Date(sorted[sorted.length - 1].timestamp).toLocaleString()}\n`
    
    const duration = sorted[sorted.length - 1].timestamp - sorted[0].timestamp
    summary += `  时长: ${formatDuration(duration)}\n\n`
  }
  
  const threads = new Set(entries.filter(e => e.thread).map(e => e.thread))
  if (threads.size > 0) {
    summary += `线程数量: ${threads.size}\n`
    summary += `  ${[...threads].slice(0, 10).join(', ')}${threads.size > 10 ? '...' : ''}\n\n`
  }
  
  const errorEntries = entries.filter(e => e.level === 'error' || e.level === 'fatal')
  if (errorEntries.length > 0) {
    summary += `最近错误 (前10条):\n`
    const recentErrors = [...errorEntries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
    
    for (let i = 0; i < recentErrors.length; i++) {
      const entry = recentErrors[i]
      const time = entry.timestampStr || new Date(entry.timestamp).toLocaleTimeString()
      summary += `  [${i + 1}] ${time} ${entry.message.split('\n')[0].substring(0, 80)}\n`
    }
  }
  
  return summary
}

function generateMetadata(
  logPackage: LogPackage,
  entries: LogEntry[],
  options: DiagnosticPackageOptions
): Record<string, unknown> {
  return {
    package: {
      id: logPackage.id,
      name: logPackage.name,
      project: logPackage.project,
      version: logPackage.version,
      createdAt: logPackage.createdAt,
      fileCount: logPackage.files.length,
    },
    stats: {
      totalEntries: entries.length,
      timeRange: entries.length > 0 ? {
        start: entries.reduce((min, e) => Math.min(min, e.timestamp), Infinity),
        end: entries.reduce((max, e) => Math.max(max, e.timestamp), -Infinity),
      } : null,
    },
    exportOptions: {
      includeOriginal: options.includeOriginal,
      maskSensitive: options.maskSensitive,
      includeReport: options.includeReport,
      includeSummary: options.includeSummary,
    },
    exportedAt: Date.now(),
    exporter: 'LogAnalyzer Desktop',
    version: '1.0.0',
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`
  }
  if (minutes > 0) {
    return `${minutes}分钟 ${seconds % 60}秒`
  }
  return `${seconds}秒`
}

export async function exportLogEntriesAsText(entries: LogEntry[], filename: string): Promise<void> {
  const content = entries.map(e => e.raw).join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, filename)
}

export async function exportReportAsMarkdown(report: ReportData, packageName: string, filename: string): Promise<void> {
  const content = formatReportAsMarkdown(report, packageName)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, filename)
}
