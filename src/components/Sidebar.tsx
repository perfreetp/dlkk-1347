import { useLogStore } from '../store/useLogStore'

const navItems = [
  { key: 'home', label: '首页', icon: '🏠' },
  { key: 'import', label: '导入', icon: '📥' },
  { key: 'analysis', label: '分析', icon: '🔍' },
  { key: 'report', label: '报告', icon: '📊' },
  { key: 'cases', label: '案例库', icon: '📚' },
  { key: 'settings', label: '设置', icon: '⚙️' },
]

export default function Sidebar() {
  const { viewMode, setViewMode, packages } = useLogStore()
  
  return (
    <div className="w-56 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <span className="text-2xl">📋</span>
          日志分析
        </h1>
      </div>
      
      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setViewMode(item.key as typeof viewMode)}
            className={`sidebar-item w-full text-left ${
              viewMode === item.key ? 'active' : ''
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.key === 'home' && packages.length > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
                {packages.length}
              </span>
            )}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          v1.0.0
        </div>
      </div>
    </div>
  )
}
