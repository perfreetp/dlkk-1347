import { useState } from 'react'
import { useLogStore } from '../store/useLogStore'

export default function CasesView() {
  const { cases, removeCase, updateCase, addCase, packages, setCurrentPackage, setViewMode } = useLogStore()
  const [showCreate, setShowCreate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    logPackageId: '',
    tags: '',
  })
  
  const allTags = Array.from(new Set(cases.flatMap((c) => c.tags)))
  
  const filteredCases = cases.filter((c) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      if (
        !c.title.toLowerCase().includes(query) &&
        !c.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }
    
    if (selectedTag && !c.tags.includes(selectedTag)) {
      return false
    }
    
    return true
  })
  
  const handleCreateCase = () => {
    if (!newCase.title.trim()) return
    
    addCase({
      title: newCase.title,
      description: newCase.description,
      logPackageId: newCase.logPackageId,
      relatedEntryIds: [],
      tags: newCase.tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    
    setNewCase({ title: '', description: '', logPackageId: '', tags: '' })
    setShowCreate(false)
  }
  
  const handleOpenPackage = (pkgId: string) => {
    if (pkgId && packages.some((p) => p.id === pkgId)) {
      setCurrentPackage(pkgId)
      setViewMode('analysis')
    }
  }
  
  const getPackageName = (pkgId: string) => {
    return packages.find((p) => p.id === pkgId)?.name || '未知日志包'
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            案例库
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            ➕ 新建案例
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索案例..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
            />
          </div>
          
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">标签:</span>
              <button
                onClick={() => setSelectedTag(null)}
                className={`tag cursor-pointer ${
                  selectedTag === null ? 'tag-info' : 'tag-debug'
                }`}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`tag cursor-pointer ${
                    selectedTag === tag ? 'tag-info' : 'tag-debug'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {showCreate && (
          <div className="card p-6 mb-6">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">
              新建案例
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  标题 *
                </label>
                <input
                  type="text"
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  placeholder="案例标题"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  描述
                </label>
                <textarea
                  value={newCase.description}
                  onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                  placeholder="问题描述、排查过程、解决方案..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  关联日志包
                </label>
                <select
                  value={newCase.logPackageId}
                  onChange={(e) => setNewCase({ ...newCase, logPackageId: e.target.value })}
                  className="input-field"
                >
                  <option value="">选择日志包...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  标签 (逗号分隔)
                </label>
                <input
                  type="text"
                  value={newCase.tags}
                  onChange={(e) => setNewCase({ ...newCase, tags: e.target.value })}
                  placeholder="如: 登录失败, 网络问题"
                  className="input-field"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCase}
                  disabled={!newCase.title.trim()}
                  className="btn-primary"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}
        
        {filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              暂无案例
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              创建案例记录常见问题和解决方案
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary"
            >
              创建第一个案例
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCases.map((caseItem) => (
              <div key={caseItem.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white">
                    {caseItem.title}
                  </h4>
                  <button
                    onClick={() => {
                      if (confirm('确定删除此案例？')) {
                        removeCase(caseItem.id)
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {caseItem.description || '暂无描述'}
                </p>
                
                {caseItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {caseItem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="tag tag-debug"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {caseItem.logPackageId && (
                  <button
                    onClick={() => handleOpenPackage(caseItem.logPackageId)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    📦 {getPackageName(caseItem.logPackageId)}
                  </button>
                )}
                
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  创建于 {new Date(caseItem.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
