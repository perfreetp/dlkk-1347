import { useState } from 'react'
import type { LogEntry } from '../types'
import { extractStackTrace } from '../utils/logParser'

interface Props {
  entry: LogEntry | null
  allEntries: LogEntry[]
  onToggleStar: (entryId: string) => void
  onShowContext: () => void
  onScrollToEntry: (entryId: string) => void
}

export default function LogDetailPanel({
  entry,
  allEntries,
  onToggleStar,
  onShowContext,
  onScrollToEntry,
}: Props) {
  const [newTag, setNewTag] = useState('')
  
  if (!entry) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        选择一条日志查看详情
      </div>
    )
  }
  
  const stackTrace = extractStackTrace(entry.message)
  
  const goToPrevEntry = () => {
    const currentIndex = allEntries.findIndex((e) => e.id === entry.id)
    if (currentIndex > 0) {
      onScrollToEntry(allEntries[currentIndex - 1].id)
    }
  }
  
  const goToNextEntry = () => {
    const currentIndex = allEntries.findIndex((e) => e.id === entry.id)
    if (currentIndex < allEntries.length - 1) {
      onScrollToEntry(allEntries[currentIndex + 1].id)
    }
  }
  
  const currentIndex = allEntries.findIndex((e) => e.id === entry.id)
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className={`tag tag-${entry.level}`}>
          {entry.level.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStar(entry.id)}
            className={`text-lg ${entry.isStarred ? 'text-amber-500' : 'text-gray-400 hover:text-amber-400'}`}
          >
            {entry.isStarred ? '⭐' : '☆'}
          </button>
          <div className="flex items-center border rounded">
            <button
              onClick={goToPrevEntry}
              disabled={currentIndex <= 0}
              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
            >
              ↑
            </button>
            <span className="px-2 text-xs text-gray-500 border-x">
              {currentIndex + 1} / {allEntries.length}
            </span>
            <button
              onClick={goToNextEntry}
              disabled={currentIndex >= allEntries.length - 1}
              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">时间</div>
          <div className="font-mono text-gray-800 dark:text-gray-200">
            {new Date(entry.timestamp).toLocaleString('zh-CN', { hour12: false })}
          </div>
        </div>
        
        {entry.thread && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">线程</div>
            <div className="font-mono text-gray-800 dark:text-gray-200">{entry.thread}</div>
          </div>
        )}
        
        {entry.logger && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Logger</div>
            <div className="font-mono text-gray-800 dark:text-gray-200">{entry.logger}</div>
          </div>
        )}
        
        {entry.errorCode && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">错误码</div>
            <div className="font-mono text-red-600 dark:text-red-400 font-medium">
              {entry.errorCode}
            </div>
          </div>
        )}
        
        {entry.sourceFile && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">源文件</div>
            <div className="font-mono text-gray-800 dark:text-gray-200 truncate">
              {entry.sourceFile}
            </div>
          </div>
        )}
        
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">行号</div>
          <div className="font-mono text-gray-800 dark:text-gray-200">{entry.lineNumber}</div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onShowContext}
          className="btn-secondary text-xs flex-1"
        >
          🔍 查看上下文
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(entry.raw)}
          className="btn-secondary text-xs"
        >
          📋 复制
        </button>
      </div>
      
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">标签</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.tags.length === 0 ? (
            <span className="text-xs text-gray-400">暂无标签</span>
          ) : (
            entry.tags.map((tag) => (
              <span
                key={tag}
                className="tag tag-info"
              >
                {tag}
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="添加标签..."
            className="input-field text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTag.trim()) {
                // TODO: add tag
                setNewTag('')
              }
            }}
          />
        </div>
      </div>
      
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">日志内容</div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">
          <span className={`log-${entry.level}`}>{entry.raw}</span>
        </div>
      </div>
      
      {stackTrace.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            堆栈跟踪 ({stackTrace.length} 行)
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
            {stackTrace.map((line, i) => (
              <div key={i} className="text-red-600 dark:text-red-400">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
