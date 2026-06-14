import { useMemo, useState } from 'react'
import { useLogStore } from '../store/useLogStore'
import { formatFileSize, formatDuration } from '../utils/exportUtils'

type GroupBy = 'project' | 'version' | 'time'

export default function HomeView() {
  const { packages, setViewMode, setCurrentPackage, removePackage } = useLogStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [searchQuery, setSearchQuery] = useState('')
  
  const groupedPackages = useMemo(() => {
    let filtered = packages
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = packages.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.project.toLowerCase().includes(query) ||
          p.version.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      )
    }
    
    const groups = new Map<string, typeof packages>()
    
    for (const pkg of filtered) {
      let key: string
      
      switch (groupBy) {
        case 'project':
          key = pkg.project || '未分类项目'
          break
        case 'version':
          key = pkg.version || '未指定版本'
          break
        case 'time': {
          const date = new Date(pkg.createdAt)
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        }
        default:
          key = '其他'
      }
      
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(pkg)
    }
    
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [packages, groupBy, searchQuery])
  
  const handleOpenPackage = (pkgId: string) => {
    setCurrentPackage(pkgId)
    setViewMode('analysis')
  }
  
  const handleDeletePackage = (pkgId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这个日志包吗？')) {
      removePackage(pkgId)
    }
  }
  
  const getPackageStats = (pkg: typeof packages[0]) => {
    let totalEntries = 0
    let errorCount = 0
    let warnCount = 0
    let minTime = Infinity
    let maxTime = -Infinity
    
    for (const file of pkg.files) {
      totalEntries += file.entries.length
      for (const entry of file.entries) {
        if (entry.level === 'error' || entry.level === 'fatal') errorCount++
        if (entry.level === 'warn') warnCount++
        if (entry.timestamp < minTime) minTime = entry.timestamp
        if (entry.timestamp > maxTime) maxTime = entry.timestamp
      }
    }
    
    return {
      totalEntries,
      errorCount,
      warnCount,
      duration: maxTime > minTime ? maxTime - minTime : 0,
    }
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">日志包管理</h2>
          <button
            onClick={() => setViewMode('import')}
            className="btn-primary flex items-center gap-2"
          >
            <span>📥</span>
            导入日志
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索日志包..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">分组：</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="input-field w-auto"
            >
              <option value="project">按项目</option>
              <option value="version">按版本</option>
              <option value="time">按时间</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              暂无日志包
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              导入你的第一个日志包开始分析
            </p>
            <button
              onClick={() => setViewMode('import')}
              className="btn-primary"
            >
              立即导入
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedPackages.map(([groupName, groupPackages]) => (
              <div key={groupName}>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {groupName}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({groupPackages.length} 个日志包)
                  </span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupPackages.map((pkg) => {
                    const stats = getPackageStats(pkg)
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => handleOpenPackage(pkg.id)}
                        className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white truncate">
                              {pkg.name}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {pkg.project} · {pkg.version}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeletePackage(pkg.id, e)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm mb-3">
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <span>📄</span>
                            <span>{pkg.files.length} 个文件</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <span>📝</span>
                            <span>{stats.totalEntries.toLocaleString()} 条</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          {stats.errorCount > 0 && (
                            <span className="tag tag-error">
                              {stats.errorCount} 错误
                            </span>
                          )}
                          {stats.warnCount > 0 && (
                            <span className="tag tag-warn">
                              {stats.warnCount} 警告
                            </span>
                          )}
                          {stats.duration > 0 && (
                            <span className="tag tag-info">
                              {formatDuration(stats.duration)}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <span>🕐</span>
                          <span>
                            {new Date(pkg.createdAt).toLocaleString()}
                          </span>
                        </div>
                        
                        {pkg.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {pkg.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
