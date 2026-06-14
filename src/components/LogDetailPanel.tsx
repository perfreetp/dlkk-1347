import { useState } from 'react'
import type { LogEntry } from '../types'
import { extractStackTrace } from '../utils/logParser'

interface Props {
  entry: LogEntry | null
  allEntries: LogEntry[]
  onToggleStar: (entryId: string) => void
  onAddTag: (entryId: string, tag: string) => void
  onRemoveTag: (entryId: string, tag: string) => void
  onShowContext: () => void
  onScrollToEntry: (entryId: string) => void
}

export default function LogDetailPanel({
  entry,
  allEntries,
  onToggleStar,
  onAddTag,
  onRemoveTag,
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
  
  const currentIndex = allEntries.findIndex((e) => e.id === entry.id)
  
  const goToPrevEntry = () => {
    if (currentIndex > 0) {
      onScrollToEntry(allEntries[currentIndex - 1].id)
    }
  }
  
  const goToNextEntry = () => {
    if (currentIndex < allEntries.length - 1) {
      onScrollToEntry(allEntries[currentIndex + 1].id)
    }
  }
  
  const handleAddTag = () => {
    const tag = newTag.trim()
    if (tag && !entry.tags.includes(tag)) {
      onAddTag(entry.id, tag)
      setNewTag('')
    }
  }
  
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className={`tag tag-${entry.level}`}>
          {entry.level.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStar(entry.id)}
            className={`text-lg transition-colors ${
              entry.isStarred 
                ? 'text-amber-500' 
                : 'text-gray-400 hover:text-amber-400'
            }`}
            title={entry.isStarred ? '取消收藏' : '收藏'}
          >
            {entry.isStarred ? '⭐' : '☆'}
          </button>
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded">
            <button
              onClick={goToPrevEntry}
              disabled={currentIndex <= 0}
              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↑
            </button>
            <span className="px-2 text-xs text-gray-500 border-x border-gray-300 dark:border-gray-600">
              {currentIndex + 1} / {allEntries.length}
            </span>
            <button
              onClick={goToNextEntry}
              disabled={currentIndex >= allEntries.length - 1}
              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓
            </button>
          </div>
        </div>
      </div>
      
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">时间</div>
          <div className="font-mono text-gray-800 dark:text-gray-200">
            {new Date(entry.timestamp).toLocaleString('zh-CN', { hour12: false })}
          </div>
        </div>
        
        {entry.thread && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">线程</div>
            <div className="font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
              {entry.thread}
            </div>
          </div>
        )}
        
        {entry.logger && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Logger</div>
            <div className="font-mono text-gray-800 dark:text-gray-200">
              {entry.logger}
            </div>
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
          title="复制原始日志"
        >
          📋 复制
        </button>
      </div>
      
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
          <span>标签</span>
          <span className="text-gray-400">{entry.tags.length} 个</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {entry.tags.length === 0 ? (
            <span className="text-xs text-gray-400">暂无标签，添加一个吧</span>
          ) : (
            entry.tags.map((tag) => (
              <span
                key={tag}
                className="tag tag-info group flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => onRemoveTag(entry.id, tag)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity ml-1"
                  title="移除标签"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="输入标签后回车添加"
            className="input-field text-sm flex-1"
          />
          <button
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="btn-primary text-sm disabled:opacity-50"
          >
            添加
          </button>
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
