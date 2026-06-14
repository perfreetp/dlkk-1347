import { useMemo, useState } from 'react'
import { useLogStore } from '../store/useLogStore'
import { formatFileSize, formatDuration } from '../utils/exportUtils'
import type { LogPackage, LogEntry, ImportSource, ImportSourceType } from '../types'

type GroupBy = 'project' | 'version' | 'time'

const getSourceIcon = (type: ImportSourceType) => {
  switch (type) {
    case 'directory': return '📁'
    case 'zip': return '📦'
    case 'file': return '📄'
    case 'clipboard': return '📋'
  }
}

const getSourceLabel = (type: ImportSourceType) => {
  switch (type) {
    case 'directory': return '文件夹'
    case 'zip': return '压缩包'
    case 'file': return '文件'
    case 'clipboard': return '剪贴板'
  }
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

interface HitEntry {
  pkg: LogPackage
  entry: LogEntry
}

export default function HomeView() {
  const { packages, setViewMode, setCurrentPackage, removePackage, openEntry, updateSource, updatePackage } = useLogStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyWithStarred, setOnlyWithStarred] = useState(false)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [expandedPkgIds, setExpandedPkgIds] = useState<Set<string>>(new Set())
  const [expandedSourceIds, setExpandedSourceIds] = useState<Set<string>>(new Set())
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [editingSourceName, setEditingSourceName] = useState('')
  const [editingSourceRemark, setEditingSourceRemark] = useState('')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const pkg of packages) {
      for (const tag of pkg.tags) set.add(tag)
      for (const file of pkg.files) {
        for (const entry of file.entries) {
          for (const tag of entry.tags) set.add(tag)
        }
      }
    }
    return Array.from(set).sort()
  }, [packages])

  // 命中的具体日志条目（用于筛选后直接展开清单）
  const hitEntries = useMemo<HitEntry[]>(() => {
    if (!onlyWithStarred && tagFilter.length === 0 && !searchQuery.trim()) return []
    const hits: HitEntry[] = []
    for (const pkg of packages) {
      for (const file of pkg.files) {
        for (const entry of file.entries) {
          let ok = true
          if (onlyWithStarred && !entry.isStarred) ok = false
          if (ok && tagFilter.length > 0 && !tagFilter.some((t) => entry.tags.includes(t))) ok = false
          if (ok && searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            if (
              !entry.raw.toLowerCase().includes(q) &&
              !entry.message.toLowerCase().includes(q) &&
              !file.name.toLowerCase().includes(q) &&
              !pkg.name.toLowerCase().includes(q)
            ) {
              ok = false
            }
          }
          if (ok) hits.push({ pkg, entry })
        }
      }
    }
    return hits.sort((a, b) => b.entry.timestamp - a.entry.timestamp).slice(0, 200)
  }, [packages, onlyWithStarred, tagFilter, searchQuery])

  const groupedPackages = useMemo(() => {
    let filtered = packages

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.project.toLowerCase().includes(query) ||
          p.version.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.files.some((f) => f.name.toLowerCase().includes(query)) ||
          p.sources?.some((s) => s.name.toLowerCase().includes(query))
      )
    }

    if (onlyWithStarred) {
      filtered = filtered.filter((pkg) =>
        pkg.files.some((f) => f.entries.some((e) => e.isStarred))
      )
    }

    if (tagFilter.length > 0) {
      filtered = filtered.filter((pkg) =>
        tagFilter.some((tag) =>
          pkg.tags.includes(tag) ||
          pkg.files.some((f) => f.entries.some((e) => e.tags.includes(tag)))
        )
      )
    }

    const groups = new Map<string, LogPackage[]>()

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
  }, [packages, groupBy, searchQuery, onlyWithStarred, tagFilter])

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

  const getPackageStats = (pkg: LogPackage) => {
    let totalEntries = 0
    let errorCount = 0
    let warnCount = 0
    let starredCount = 0
    let uniqueTags = new Set<string>()
    let minTime = Infinity
    let maxTime = -Infinity

    for (const file of pkg.files) {
      totalEntries += file.entries.length
      for (const entry of file.entries) {
        if (entry.level === 'error' || entry.level === 'fatal') errorCount++
        if (entry.level === 'warn') warnCount++
        if (entry.isStarred) starredCount++
        for (const t of entry.tags) uniqueTags.add(t)
        if (entry.timestamp < minTime) minTime = entry.timestamp
        if (entry.timestamp > maxTime) maxTime = entry.timestamp
      }
    }

    return {
      totalEntries,
      errorCount,
      warnCount,
      starredCount,
      tagCount: uniqueTags.size,
      duration: maxTime > minTime ? maxTime - minTime : 0,
    }
  }

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const togglePkgExpand = (pkgId: string) => {
    setExpandedPkgIds((prev) => {
      const next = new Set(prev)
      if (next.has(pkgId)) next.delete(pkgId)
      else next.add(pkgId)
      return next
    })
  }

  const toggleSourceExpand = (sourceId: string) => {
    setExpandedSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  const startEditSource = (pkgId: string, source: ImportSource) => {
    setEditingSourceId(`${pkgId}::${source.id}`)
    setEditingSourceName(source.name)
    setEditingSourceRemark(source.remark || '')
  }

  const saveSourceEdit = (pkgId: string, sourceId: string) => {
    updateSource(pkgId, sourceId, {
      name: editingSourceName.trim() || '未命名批次',
      remark: editingSourceRemark.trim() || undefined,
    })
    setEditingSourceId(null)
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

        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索日志包、文件、日志内容..."
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

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setOnlyWithStarred(!onlyWithStarred)}
            className={`tag cursor-pointer transition-colors ${
              onlyWithStarred
                ? 'tag-warn ring-2 ring-offset-1 ring-amber-400'
                : 'tag-debug opacity-60 hover:opacity-100'
            }`}
          >
            ⭐ 仅含收藏 ({packages.filter((p) => p.files.some((f) => f.entries.some((e) => e.isStarred))).length})
          </button>

          {allTags.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">标签筛选：</span>
              {allTags.slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTagFilter(tag)}
                  className={`tag cursor-pointer transition-colors ${
                    tagFilter.includes(tag)
                      ? 'tag-info ring-2 ring-offset-1 ring-blue-400'
                      : 'tag-debug opacity-60 hover:opacity-100'
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {tagFilter.length > 0 && (
                <button
                  onClick={() => setTagFilter([])}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                >
                  清除标签
                </button>
              )}
            </>
          )}

          {hitEntries.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-sm text-blue-500 font-medium">
                🎯 命中 {hitEntries.length} 条具体日志（下方可查看）
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {hitEntries.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                🎯 命中日志清单（最近 {hitEntries.length} 条，点击直接跳转）
              </h3>
              <span className="text-xs text-gray-500">
                按时间倒序
              </span>
            </div>
            <div className="max-h-80 overflow-auto font-mono text-xs">
              {hitEntries.map((h, i) => (
                <div
                  key={`${h.pkg.id}-${h.entry.id}-${i}`}
                  onClick={() => openEntry(h.pkg.id, h.entry.id)}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                >
                  <span className="w-20 shrink-0 text-gray-400">{formatTime(h.entry.timestamp)}</span>
                  <span className={`w-14 shrink-0 font-medium log-${h.entry.level}`}>
                    {h.entry.level.toUpperCase().slice(0, 5)}
                  </span>
                  <span className="flex-1 truncate">{h.entry.message.split('\n')[0]}</span>
                  {h.entry.isStarred && <span className="text-amber-500">⭐</span>}
                  {h.entry.tags.slice(0, 2).map((t) => (
                    <span key={t} className="tag tag-info text-[10px]">#{t}</span>
                  ))}
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                    in {h.pkg.name.length > 12 ? h.pkg.name.slice(0, 10) + '...' : h.pkg.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
        ) : groupedPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              没有匹配的日志包
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              尝试调整搜索条件或筛选器
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setOnlyWithStarred(false)
                setTagFilter([])
              }}
              className="btn-secondary"
            >
              清除筛选
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

                <div className="space-y-3">
                  {groupPackages.map((pkg) => {
                    const stats = getPackageStats(pkg)
                    const pkgExpanded = expandedPkgIds.has(pkg.id)
                    return (
                      <div
                        key={pkg.id}
                        className="card overflow-hidden"
                      >
                        <div
                          onClick={() => togglePkgExpand(pkg.id)}
                          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-gray-400 text-sm w-4 text-center">
                                {pkgExpanded ? '▼' : '▶'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4
                                  className="font-semibold text-gray-800 dark:text-white truncate inline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenPackage(pkg.id)
                                  }}
                                >
                                  {pkg.name}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {pkg.project} · {pkg.version}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenPackage(pkg.id)
                                }}
                                className="btn-secondary text-xs"
                              >
                                打开
                              </button>
                              <button
                                onClick={(e) => handleDeletePackage(pkg.id, e)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {pkg.sources && pkg.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {pkg.sources.slice(0, 4).map((s) => (
                                <span
                                  key={s.id}
                                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1"
                                  title={`${getSourceLabel(s.type)}: ${s.name}${s.remark ? ' · ' + s.remark : ''}`}
                                >
                                  {getSourceIcon(s.type)} {s.name.length > 16 ? s.name.substring(0, 14) + '...' : s.name}
                                </span>
                              ))}
                              {pkg.sources.length > 4 && (
                                <span className="text-xs text-gray-400">
                                  +{pkg.sources.length - 4}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <span>📄</span>
                              <span>{pkg.files.length} 个文件</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <span>📝</span>
                              <span>{stats.totalEntries.toLocaleString()} 条</span>
                            </div>
                            {stats.starredCount > 0 && (
                              <div className="flex items-center gap-1 text-amber-500">
                                <span>⭐</span>
                                <span>{stats.starredCount}</span>
                              </div>
                            )}
                            {stats.tagCount > 0 && (
                              <div className="flex items-center gap-1 text-blue-500">
                                <span>🏷️</span>
                                <span>{stats.tagCount}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-3 flex-wrap">
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

                          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-3">
                            <span>🕐</span>
                            <span>
                              {new Date(pkg.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {pkgExpanded && pkg.sources && pkg.sources.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/20 p-3 space-y-2">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                              📦 导入批次（{pkg.sources.length}）
                            </div>
                            {pkg.sources.map((src) => {
                              const srcExpanded = expandedSourceIds.has(src.id)
                              const editingKey = `${pkg.id}::${src.id}`
                              const isEditing = editingSourceId === editingKey
                              const srcEntryCount = src.files.reduce((s, f) => s + (f.entryCount || f.entries?.length || 0), 0)
                              return (
                                <div key={src.id} className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                                  <div className="flex items-center justify-between px-3 py-2">
                                    <div
                                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                      onClick={() => toggleSourceExpand(src.id)}
                                    >
                                      <span className="text-gray-400 text-xs w-3 text-center">
                                        {srcExpanded ? '▼' : '▶'}
                                      </span>
                                      <span className="text-lg">{getSourceIcon(src.type)}</span>
                                      <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                          <input
                                            autoFocus
                                            value={editingSourceName}
                                            onChange={(e) => setEditingSourceName(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-sm font-medium w-full bg-transparent border-b border-blue-400 outline-none text-gray-800 dark:text-white"
                                          />
                                        ) : (
                                          <div className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                            {src.name}
                                            {src.remark && (
                                              <span className="text-gray-400 font-normal ml-2">
                                                · {src.remark}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-400">
                                          {getSourceLabel(src.type)} · {src.files.length} 文件 · {srcEntryCount.toLocaleString()} 条
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {isEditing ? (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              saveSourceEdit(pkg.id, src.id)
                                            }}
                                            className="text-xs text-green-600 hover:text-green-500 px-2 py-1"
                                          >
                                            保存
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setEditingSourceId(null)
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-400 px-2 py-1"
                                          >
                                            取消
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            startEditSource(pkg.id, src)
                                          }}
                                          className="text-xs text-gray-400 hover:text-blue-500 px-2 py-1"
                                          title="编辑批次名和备注"
                                        >
                                          ✏️
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isEditing && (
                                    <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700/50 pt-2">
                                      <label className="text-xs text-gray-500 block mb-1">
                                        备注
                                      </label>
                                      <input
                                        value={editingSourceRemark}
                                        onChange={(e) => setEditingSourceRemark(e.target.value)}
                                        placeholder="例如：2025/06/14 用户反馈崩溃日志"
                                        className="input-field text-sm w-full"
                                      />
                                    </div>
                                  )}

                                  {srcExpanded && !isEditing && (
                                    <div className="border-t border-gray-100 dark:border-gray-700/50 max-h-48 overflow-auto">
                                      {src.files.map((f) => (
                                        <div
                                          key={f.id}
                                          className="px-3 py-1.5 text-xs border-b border-gray-50 dark:border-gray-700/30 last:border-b-0 flex items-center gap-2"
                                        >
                                          <span>📄</span>
                                          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                            {f.name}
                                          </span>
                                          <span className="text-gray-400">
                                            {(f.entryCount || f.entries?.length || 0).toLocaleString()} 条
                                          </span>
                                          {f.timeRange && (
                                            <span className="text-gray-400">
                                              ~{formatTime(f.timeRange.end)}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
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
