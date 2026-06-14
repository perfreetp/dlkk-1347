import type { LogEntry, ReportData, AggregatedError, LogPackage } from '../types'
import { aggregateErrors, getLogLevelCount } from './logFilter'

export function generateReport(
  logPackage: LogPackage,
  entries: LogEntry[]
): ReportData {
  const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  
  const levelCounts = getLogLevelCount(sortedEntries)
  const topErrors = aggregateErrors(sortedEntries).slice(0, 10)
  
  const firstError = sortedEntries.find(e => e.level === 'error' || e.level === 'fatal')
  
  const userActions = extractUserActions(sortedEntries)
  const suspiciousConfigs = extractSuspiciousConfigs(sortedEntries)
  
  const summary = generateSummary(sortedEntries, topErrors, userActions, suspiciousConfigs)
  
  return {
    totalEntries: sortedEntries.length,
    errorCount: levelCounts.error + levelCounts.fatal,
    warnCount: levelCounts.warn,
    timeRange: {
      start: sortedEntries[0]?.timestamp ?? Date.now(),
      end: sortedEntries[sortedEntries.length - 1]?.timestamp ?? Date.now(),
    },
    topErrors,
    firstErrorTime: firstError?.timestamp,
    userActions,
    suspiciousConfigs,
    summary,
  }
}

function extractUserActions(entries: LogEntry[]): string[] {
  const actions: string[] = []
  const actionPatterns = [
    /用户.*?(登录|登出|注册|提交|点击|选择|操作|发起|取消|确认)/i,
    /user.*?(login|logout|register|submit|click|action|initiate)/i,
    /(启动|关闭|打开|退出|重启|切换|刷新|加载)/i,
    /(start|stop|open|close|exit|restart|switch|refresh|load)/i,
  ]
  
  const seen = new Set<string>()
  
  for (const entry of entries) {
    if (entry.level === 'info' || entry.level === 'debug') {
      for (const pattern of actionPatterns) {
        const match = entry.message.match(pattern)
        if (match) {
          const action = entry.message.substring(0, 100)
          if (!seen.has(action)) {
            seen.add(action)
            actions.push(action)
            break
          }
        }
      }
    }
    
    if (actions.length >= 20) break
  }
  
  return actions
}

function extractSuspiciousConfigs(entries: LogEntry[]): string[] {
  const configs: string[] = []
  const suspiciousPatterns = [
    /(配置|config|setting|参数).*?(异常|错误|失败|无效|过期|缺失)/i,
    /(超时|timeout|延迟|delay|slow).*?(\d+ms|\d+s)/i,
    /(内存|memory|CPU|cpu|磁盘|disk).*?(不足|溢出|过高|紧张)/i,
    /(版本|version).*?(不兼容|过低|过期)/i,
    /(网络|network|连接|connection).*?(失败|超时|断开|异常)/i,
  ]
  
  const seen = new Set<string>()
  
  for (const entry of entries) {
    if (entry.level === 'warn' || entry.level === 'error') {
      for (const pattern of suspiciousPatterns) {
        const match = entry.message.match(pattern)
        if (match) {
          const config = entry.message.substring(0, 100)
          if (!seen.has(config)) {
            seen.add(config)
            configs.push(config)
            break
          }
        }
      }
    }
    
    if (configs.length >= 15) break
  }
  
  return configs
}

function generateSummary(
  entries: LogEntry[],
  topErrors: AggregatedError[],
  userActions: string[],
  suspiciousConfigs: string[]
): string {
  const levelCounts = getLogLevelCount(entries)
  const total = entries.length
  
  let summary = ''
  
  summary += `日志总数: ${total} 条\n`
  summary += `  - DEBUG: ${levelCounts.debug} 条\n`
  summary += `  - INFO: ${levelCounts.info} 条\n`
  summary += `  - WARN: ${levelCounts.warn} 条\n`
  summary += `  - ERROR: ${levelCounts.error} 条\n`
  summary += `  - FATAL: ${levelCounts.fatal} 条\n\n`
  
  if (topErrors.length > 0) {
    summary += `## 高频错误 (Top ${Math.min(topErrors.length, 5)})\n\n`
    for (let i = 0; i < Math.min(topErrors.length, 5); i++) {
      const error = topErrors[i]
      summary += `${i + 1}. ${error.pattern.substring(0, 80)}\n`
      summary += `   出现次数: ${error.count} 次\n`
      summary += `   首次出现: ${new Date(error.firstOccurrence).toLocaleString()}\n\n`
    }
  }
  
  if (userActions.length > 0) {
    summary += `## 关键用户操作\n\n`
    for (let i = 0; i < Math.min(userActions.length, 5); i++) {
      summary += `- ${userActions[i]}\n`
    }
    summary += '\n'
  }
  
  if (suspiciousConfigs.length > 0) {
    summary += `## 可疑配置/问题点\n\n`
    for (let i = 0; i < Math.min(suspiciousConfigs.length, 5); i++) {
      summary += `- ${suspiciousConfigs[i]}\n`
    }
    summary += '\n'
  }
  
  if (levelCounts.error + levelCounts.fatal > 0) {
    const errorRate = ((levelCounts.error + levelCounts.fatal) / total * 100).toFixed(2)
    summary += `## 风险评估\n\n`
    summary += `错误率: ${errorRate}%\n`
    
    if (levelCounts.fatal > 0) {
      summary += `⚠️ 存在严重错误 (FATAL)，建议优先排查\n`
    } else if (levelCounts.error > 10) {
      summary += `⚠️ 错误数量较多，建议排查主要错误类型\n`
    } else if (levelCounts.error > 0) {
      summary += `✅ 错误数量在正常范围内，建议关注\n`
    }
  } else {
    summary += `## 风险评估\n\n`
    summary += `✅ 未发现错误日志，运行状态良好\n`
  }
  
  return summary
}

export function formatReportAsMarkdown(report: ReportData, packageName: string): string {
  let md = `# 日志分析报告 - ${packageName}\n\n`
  
  md += `## 概览\n\n`
  md += `- **日志总数**: ${report.totalEntries}\n`
  md += `- **错误数量**: ${report.errorCount}\n`
  md += `- **警告数量**: ${report.warnCount}\n`
  md += `- **时间范围**: ${new Date(report.timeRange.start).toLocaleString()} ~ ${new Date(report.timeRange.end).toLocaleString()}\n`
  
  if (report.firstErrorTime) {
    md += `- **首次错误时间**: ${new Date(report.firstErrorTime).toLocaleString()}\n`
  }
  
  md += '\n---\n\n'
  
  md += `## 高频错误\n\n`
  
  if (report.topErrors.length > 0) {
    md += `| 排名 | 错误模式 | 出现次数 | 首次出现 |\n`
    md += `|------|----------|----------|----------|\n`
    
    report.topErrors.forEach((error, index) => {
      md += `| ${index + 1} | ${error.pattern.substring(0, 50).replace(/\|/g, '\\|')} | ${error.count} | ${new Date(error.firstOccurrence).toLocaleString()} |\n`
    })
  } else {
    md += `暂无错误数据\n`
  }
  
  md += '\n---\n\n'
  
  md += `## 关键用户操作\n\n`
  
  if (report.userActions.length > 0) {
    report.userActions.slice(0, 10).forEach((action, index) => {
      md += `${index + 1}. ${action}\n`
    })
  } else {
    md += `未检测到明显的用户操作\n`
  }
  
  md += '\n---\n\n'
  
  md += `## 可疑配置/问题点\n\n`
  
  if (report.suspiciousConfigs.length > 0) {
    report.suspiciousConfigs.slice(0, 10).forEach((config, index) => {
      md += `- ${config}\n`
    })
  } else {
    md += `未发现明显的可疑配置\n`
  }
  
  md += '\n---\n\n'
  
  md += `## 排查摘要\n\n`
  md += `\`\`\`\n${report.summary}\n\`\`\`\n`
  
  return md
}
