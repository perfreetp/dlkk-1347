import { useState, useMemo, useRef, useEffect } from 'react'
import { useLogStore, useCurrentPackage, useAllEntries } from '../store/useLogStore'
import { filterLogs, getContextEntries, searchHighlights, getUniqueValues } from '../utils/logFilter'
import type { LogEntry, LogLevel } from '../types'
import LogDetailPanel from './LogDetailPanel'
import TimelineView from './TimelineView'
import ErrorAggregationView from './ErrorAggregationView'

type RightPanel = 'detail' | 'timeline' | 'aggregation' | 'compare'

export default function AnalysisView() {
  const currentPkg = useCurrentPackage()
  const allEntries = useAllEntries()
  const {
    filterOptions,
    updateFilter,
    resetFilter,
    selectedEntryId,
    setSelectedEntry,
    toggleStar,
    addTag,
    removeTag,
    setViewMode,
  } = useLogStore()
  
  const [rightPanel, setRightPanel] = useState<RightPanel>('detail')
  const [showContext, setShowContext] = useState(false)
  const [contextSize, setContextSize] = useState(10)
  const [compareEntryId, setCompareEntryId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState<'idle' | 'selectA' | 'selectB'>('idle')
  
  const logContainerRef = useRef<HTMLDivElement>(null)
  
  const filteredEntries = useMemo(() => {
    return filterLogs(allEntries, filterOptions)
  }, [allEntries, filterOptions])
  
  const selectedEntry = useMemo(() => {
    return allEntries.find((e) => e.id === selectedEntryId) || null
  }, [allEntries, selectedEntryId])
  
  const compareEntry = useMemo(() => {
    if (!compareEntryId) return null
    return allEntries.find((e) => e.id === compareEntryId) || null
  }, [allEntries, compareEntryId])
  
  const displayEntries = useMemo(() => {
    if (showContext && selectedEntryId) {
      return getContextEntries(allEntries, selectedEntryId, contextSize)
    }
    return filteredEntries
  }, [filteredEntries, showContext, selectedEntryId, allEntries, contextSize])
  
  const threads = useMemo(() => getUniqueValues(allEntries, 'thread'), [allEntries])
  const loggers = useMemo(() => getUniqueValues(allEntries, 'logger'), [allEntries])
  const errorCodes = useMemo(() => getUniqueValues(allEntries, 'errorCode'), [allEntries])
  
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = {
      debug: 0, info: 0, warn: 0, error: 0, fatal: 0, unknown: 0,
    }
    for (const e of allEntries) {
      counts[e.level]++
    }
    return counts
  }, [allEntries])
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  }
  
  const toggleLevelFilter = (level: LogLevel) => {
    const levels = filterOptions.levels
    const newLevels = levels.includes(level)
      ? levels.filter((l) => l !== level)
      : [...levels, level]
    updateFilter({ levels: newLevels })
  }
  
  const handleEntryClick = (entry: LogEntry) => {
    if (rightPanel === 'compare') {
      if (compareMode === 'idle' || compareMode === 'selectA') {
        setSelectedEntry(entry.id)
        setCompareEntryId(null)
        setCompareMode('selectB')
      } else if (compareMode === 'selectB') {
        if (selectedEntryId !== entry.id) {
          setCompareEntryId(entry.id)
          setCompareMode('idle')
        }
      }
    } else {
      setSelectedEntry(entry.id)
    }
  }
  
  const startCompareMode = () => {
    setRightPanel('compare')
    if (selectedEntryId) {
      setCompareMode('selectB')
    } else {
      setCompareMode('selectA')
    }
  }
  
  const resetCompare = () => {
    setCompareEntryId(null)
    setCompareMode('selectA')
  }
  
  const swapCompare = () => {
    if (selectedEntryId && compareEntryId) {
      const temp = selectedEntryId
      setSelectedEntry(compareEntryId)
      setCompareEntryId(temp)
    }
  }
  
  const handleScrollToEntry = (entryId: string) => {
    setSelectedEntry(entryId)
    setShowContext(false)
    
    setTimeout(() => {
      const element = document.getElementById(`log-entry-${entryId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' +
      String(date.getMilliseconds()).padStart(3, '0')
  }
  
  const formatFullTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
  }
  
  const renderHighlightedText = (text: string) => {
    if (!filterOptions.keyword.trim()) {
      return text
    }
    
    const highlights = searchHighlights(
      text,
      filterOptions.keyword,
      filterOptions.isRegex,
      filterOptions.caseSensitive
    )
    
    if (highlights.length === 0) {
      return text
    }
    
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    
    highlights.forEach((h, i) => {
      if (h.start > lastIndex) {
        parts.push(text.substring(lastIndex, h.start))
      }
      parts.push(
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-700">
          {text.substring(h.start, h.end)}
        </mark>
      )
      lastIndex = h.end
    })
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts
  }
  
  if (!currentPkg) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
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
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {currentPkg.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentPkg.project} · {currentPkg.version} · {allEntries.length.toLocaleString()} 条日志
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('report')}
              className="btn-secondary"
            >
              📊 生成报告
            </button>
            <button
              onClick={() => setViewMode('import')}
              className="btn-primary"
            >
              📥 导入
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={filterOptions.keyword}
              onChange={(e) => updateFilter({ keyword: e.target.value })}
              placeholder="搜索日志内容..."
              className="input-field pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
          
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={filterOptions.isRegex}
              onChange={(e) => updateFilter({ isRegex: e.target.checked })}
              className="rounded"
            />
            正则
          </label>
          
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={filterOptions.caseSensitive}
              onChange={(e) => updateFilter({ caseSensitive: e.target.checked })}
              className="rounded"
            />
            区分大小写
          </label>
          
          <button
            type="button"
            onClick={resetFilter}
            className="btn-secondary text-sm"
          >
            重置
          </button>
        </form>
        
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400">级别：</span>
          {(['debug', 'info', 'warn', 'error', 'fatal'] as LogLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => toggleLevelFilter(level)}
              className={`tag cursor-pointer transition-colors ${
                filterOptions.levels.includes(level)
                  ? `tag-${level} ring-2 ring-offset-1 ring-blue-400`
                  : 'tag-debug opacity-50 hover:opacity-100'
              }`}
            >
              {level.toUpperCase()} ({levelCounts[level]})
            </button>
          ))}
          
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-2"></div>
          
          <span className="text-sm text-gray-500 dark:text-gray-400">显示：</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {filteredEntries.length.toLocaleString()} / {allEntries.length.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-8">#</span>
            <span className="w-28">时间</span>
            <span className="w-16">级别</span>
            <span className="flex-1">消息</span>
          </div>
          
          <div
            ref={logContainerRef}
            className="flex-1 overflow-auto font-mono text-sm"
          >
            {displayEntries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                没有匹配的日志
              </div>
            ) : (
              displayEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  id={`log-entry-${entry.id}`}
                  onClick={() => handleEntryClick(entry)}
                  className={`log-line flex px-3 py-1 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                    selectedEntryId === entry.id ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <span className="w-8 text-gray-400 shrink-0">
                    {index + 1}
                  </span>
                  <span className="w-28 text-gray-500 dark:text-gray-400 shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={`w-16 shrink-0 font-medium log-${entry.level}`}>
                    {entry.level.toUpperCase().substring(0, 5)}
                  </span>
                  <span className="flex-1 truncate">
                    {renderHighlightedText(entry.message.split('\n')[0])}
                  </span>
                  {entry.isStarred && (
                    <span className="text-amber-500 ml-2">⭐</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { key: 'detail', label: '详情', icon: '📄' },
              { key: 'timeline', label: '时间线', icon: '📈' },
              { key: 'aggregation', label: '异常聚合', icon: '📊' },
              { key: 'compare', label: '对比', icon: '⚖️' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'compare') {
                    startCompareMode()
                  } else {
                    setRightPanel(tab.key as RightPanel)
                    setCompareEntryId(null)
                    setCompareMode('idle')
                  }
                }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  rightPanel === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {rightPanel === 'detail' && (
              <LogDetailPanel
                entry={selectedEntry}
                allEntries={allEntries}
                onToggleStar={toggleStar}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                onShowContext={() => setShowContext(true)}
                onScrollToEntry={handleScrollToEntry}
              />
            )}
            
            {rightPanel === 'timeline' && (
              <TimelineView
                entries={allEntries}
                onEntryClick={handleScrollToEntry}
              />
            )}
            
            {rightPanel === 'aggregation' && (
              <ErrorAggregationView
                entries={allEntries}
                onEntryClick={handleScrollToEntry}
              />
            )}
            
            {rightPanel === 'compare' && (
              <ComparePanel
                entry1={selectedEntry}
                entry2={compareEntry}
                compareMode={compareMode}
                onReset={resetCompare}
                onSwap={swapCompare}
                onSelectNext={(entryId) => {
                  setCompareEntryId(entryId)
                  setCompareMode('idle')
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComparePanel({
  entry1,
  entry2,
  compareMode,
  onReset,
  onSwap,
  onSelectNext,
}: {
  entry1: LogEntry | null
  entry2: LogEntry | null
  compareMode: 'idle' | 'selectA' | 'selectB'
  onReset: () => void
  onSwap: () => void
  onSelectNext: (entryId: string) => void
}) {
  if (!entry1 && compareMode === 'selectA') {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">⚖️</div>
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          选择日志 A
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          在左侧日志列表中点击选择第一条日志
        </p>
      </div>
    )
  }
  
  if (entry1 && compareMode === 'selectB' && !entry2) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">📍 日志 A (已选)</div>
          <div className={`text-sm font-medium log-${entry1.level}`}>
            [{entry1.level.toUpperCase()}] {entry1.message.split('\n')[0].substring(0, 60)}
          </div>
          <div className="text-xs text-blue-500 dark:text-blue-300 mt-1">
            {new Date(entry1.timestamp).toLocaleString()}
          </div>
        </div>
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
            ↓
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            请在左侧列表中点击选择 <span className="font-medium text-blue-600 dark:text-blue-400">日志 B</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            选择后将自动进行对比
          </p>
        </div>
        
        <button
          onClick={onReset}
          className="btn-secondary w-full text-sm"
        >
          重新选择
        </button>
      </div>
    )
  }
  
  if (!entry1 || !entry2) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">⚖️</div>
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          日志对比
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          选择两条日志进行内容对比
        </p>
      </div>
    )
  }
  
  const timeDiff = entry2.timestamp - entry1.timestamp
  const levelDiff = entry1.level !== entry2.level
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">
          对比结果
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onSwap}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            title="交换 A/B"
          >
            🔄 交换
          </button>
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            重新选择
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className={`card p-3 border-l-4 border-l-blue-500`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
              A
            </span>
            <span className={`text-xs tag-${entry1.level}`}>
              {entry1.level.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
            {entry1.message.split('\n')[0]}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono">
            {new Date(entry1.timestamp).toLocaleString()}
          </div>
          {entry1.thread && (
            <div className="text-xs text-gray-500 mt-1">
              线程: {entry1.thread}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-4 py-1">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          <span className="text-xs text-gray-400">
            ⏱️ 时间差: {(timeDiff / 1000).toFixed(3)} 秒
          </span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        </div>
        
        <div className={`card p-3 border-l-4 border-l-green-500`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">
              B
            </span>
            <span className={`text-xs tag-${entry2.level}`}>
              {entry2.level.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
            {entry2.message.split('\n')[0]}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono">
            {new Date(entry2.timestamp).toLocaleString()}
          </div>
          {entry2.thread && (
            <div className="text-xs text-gray-500 mt-1">
              线程: {entry2.thread}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">级别变化</div>
          <div className={`text-sm font-medium mt-1 ${levelDiff ? 'text-amber-500' : 'text-green-500'}`}>
            {levelDiff ? '不同' : '相同'}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">时间差</div>
          <div className="text-sm font-medium mt-1 text-gray-800 dark:text-gray-200">
            {(Math.abs(timeDiff) / 1000).toFixed(3)}s
          </div>
        </div>
      </div>
      
      <div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          📝 消息差异
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono text-xs max-h-64 overflow-auto">
          {compareMessages(entry1.message, entry2.message)}
        </div>
      </div>
      
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          💡 提示：点击其他日志可替换日志 B
        </p>
        <button
          onClick={onReset}
          className="btn-secondary w-full text-sm"
        >
          重新选择两条日志
        </button>
      </div>
    </div>
  )
}

function compareMessages(msg1: string, msg2: string): React.ReactNode {
  const lines1 = msg1.split('\n')
  const lines2 = msg2.split('\n')
  const maxLen = Math.max(lines1.length, lines2.length)
  
  const result: React.ReactNode[] = []
  
  for (let i = 0; i < maxLen; i++) {
    const line1 = lines1[i] || ''
    const line2 = lines2[i] || ''
    
    if (line1 === line2) {
      result.push(
        <div key={i} className="text-gray-500 dark:text-gray-400">
          {line1 || ' '}
        </div>
      )
    } else {
      if (line1) {
        result.push(
          <div key={`${i}-a`} className="text-red-500 bg-red-50 dark:bg-red-900/20 -mx-2 px-2">
            - {line1}
          </div>
        )
      }
      if (line2) {
        result.push(
          <div key={`${i}-b`} className="text-green-500 bg-green-50 dark:bg-green-900/20 -mx-2 px-2">
            + {line2}
          </div>
        )
      }
    }
  }
  
  return result
}
