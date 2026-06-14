import { useMemo, useState } from 'react'
import { useLogStore, useCurrentPackage, useAllEntries } from '../store/useLogStore'
import { generateReport, formatReportAsMarkdown } from '../utils/reportGenerator'
import { exportDiagnosticPackage, formatDuration } from '../utils/exportUtils'
import { useLogStore as _useLogStore } from '../store/useLogStore'

export default function ReportView() {
  const currentPkg = useCurrentPackage()
  const allEntries = useAllEntries()
  const { settings, setViewMode } = useLogStore()
  const [isExporting, setIsExporting] = useState(false)
  
  const report = useMemo(() => {
    if (!currentPkg || allEntries.length === 0) return null
    return generateReport(currentPkg, allEntries)
  }, [currentPkg, allEntries])
  
  const handleExportReport = () => {
    if (!report || !currentPkg) return
    
    const markdown = formatReportAsMarkdown(report, currentPkg.name)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentPkg.name}-report.md`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleExportDiagnosticPackage = async () => {
    if (!currentPkg) return
    
    setIsExporting(true)
    try {
      await exportDiagnosticPackage(currentPkg, {
        includeOriginal: true,
        maskSensitive: true,
        includeReport: true,
        includeSummary: true,
        sensitiveRules: settings.sensitiveRules,
      })
    } catch (error) {
      console.error('Export failed:', error)
      alert('导出失败')
    } finally {
      setIsExporting(false)
    }
  }
  
  if (!currentPkg) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            请先选择一个日志包
          </h3>
          <button
            onClick={() => setViewMode('home')}
            className="btn-primary"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }
  
  if (!report) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            暂无日志数据
          </h3>
        </div>
      </div>
    )
  }
  
  const errorRate = report.totalEntries > 0
    ? ((report.errorCount / report.totalEntries) * 100).toFixed(2)
    : '0'
  
  const riskLevel = report.errorCount === 0
    ? { level: '良好', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
    : report.errorCount > 100
      ? { level: '严重', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
      : report.errorCount > 10
        ? { level: '警告', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
        : { level: '轻微', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' }
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              分析报告
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {currentPkg.name} · {currentPkg.project} v{currentPkg.version}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              className="btn-secondary"
            >
              📄 导出报告
            </button>
            <button
              onClick={handleExportDiagnosticPackage}
              disabled={isExporting}
              className="btn-primary"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  导出中...
                </span>
              ) : (
                <span>📦 导出诊断包</span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                日志总数
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {report.totalEntries.toLocaleString()}
              </div>
            </div>
            
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                错误数量
              </div>
              <div className="text-2xl font-bold text-red-600">
                {report.errorCount.toLocaleString()}
              </div>
            </div>
            
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                警告数量
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {report.warnCount.toLocaleString()}
              </div>
            </div>
            
            <div className={`card p-4 ${riskLevel.bg}`}>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                风险等级
              </div>
              <div className={`text-2xl font-bold ${riskLevel.color}`}>
                {riskLevel.level}
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
              📅 时间范围
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400">开始时间</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">
                  {new Date(report.timeRange.start).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">结束时间</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">
                  {new Date(report.timeRange.end).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">总时长</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">
                  {formatDuration(report.timeRange.end - report.timeRange.start)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">错误率</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">
                  {errorRate}%
                </div>
              </div>
            </div>
            
            {report.firstErrorTime && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ 首次错误时间: {new Date(report.firstErrorTime).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">
              🔥 高频错误 Top 10
            </h3>
            
            {report.topErrors.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                暂无错误数据
              </p>
            ) : (
              <div className="space-y-3">
                {report.topErrors.map((error, index) => (
                  <div
                    key={error.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {error.pattern}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>出现 {error.count} 次</span>
                        <span>首次: {new Date(error.firstOccurrence).toLocaleTimeString()}</span>
                        {error.affectedFiles.length > 0 && (
                          <span>涉及 {error.affectedFiles.length} 个文件</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className="h-8 w-16 bg-red-500 rounded"
                        style={{
                          opacity: 0.3 + (error.count / report.topErrors[0].count) * 0.7,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
              👤 关键用户操作
            </h3>
            
            {report.userActions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                未检测到明显的用户操作
              </p>
            ) : (
              <ul className="space-y-2">
                {report.userActions.slice(0, 10).map((action, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span className="line-clamp-2">{action}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
              ⚠️ 可疑配置/问题点
            </h3>
            
            {report.suspiciousConfigs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                未发现明显的可疑配置
              </p>
            ) : (
              <ul className="space-y-2">
                {report.suspiciousConfigs.slice(0, 10).map((config, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"
                  >
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <span className="line-clamp-2">{config}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
              📝 排查摘要
            </h3>
            <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg whitespace-pre-wrap font-mono">
              {report.summary}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
