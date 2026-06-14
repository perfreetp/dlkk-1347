import { useMemo, useState } from 'react'
import type { LogEntry } from '../types'
import { aggregateErrors } from '../utils/logFilter'

interface Props {
  entries: LogEntry[]
  onEntryClick: (entryId: string) => void
}

export default function ErrorAggregationView({ entries, onEntryClick }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const aggregatedErrors = useMemo(() => {
    return aggregateErrors(entries)
  }, [entries])
  
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }
  
  if (aggregatedErrors.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          未发现错误日志
        </p>
      </div>
    )
  }
  
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          异常聚合
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {aggregatedErrors.length} 种异常
        </span>
      </div>
      
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {aggregatedErrors.slice(0, 20).map((error) => (
          <div
            key={error.id}
            className="card overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(error.id)}
              className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {error.pattern.substring(0, 60)}
                    {error.pattern.length > 60 && '...'}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      {error.count} 次
                    </span>
                    <span>
                      首次: {new Date(error.firstOccurrence).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <span className="text-gray-400 text-lg">
                  {expandedId === error.id ? '−' : '+'}
                </span>
              </div>
            </button>
            
            {expandedId === error.id && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    出现时间范围
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <div>首次: {new Date(error.firstOccurrence).toLocaleString()}</div>
                    <div>最近: {new Date(error.lastOccurrence).toLocaleString()}</div>
                  </div>
                </div>
                
                {error.affectedFiles.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      涉及文件 ({error.affectedFiles.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {error.affectedFiles.map((file) => (
                        <span
                          key={file}
                          className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded truncate max-w-full"
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    样例日志
                  </div>
                  <div className="space-y-1">
                    {error.sampleEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => onEntryClick(entry.id)}
                        className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                      >
                        {entry.message.split('\n')[0].substring(0, 80)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {aggregatedErrors.length > 20 && (
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          仅显示前 20 种，共 {aggregatedErrors.length} 种
        </div>
      )}
    </div>
  )
}
