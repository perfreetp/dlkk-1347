import { useState } from 'react'
import { useLogStore } from '../store/useLogStore'
import type { SensitiveRule } from '../types'

export default function SettingsView() {
  const { settings, updateSettings, addSensitiveRule, updateSensitiveRule, deleteSensitiveRule } = useLogStore()
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    replacement: '***',
  })
  
  const handleAddRule = () => {
    if (!newRule.name.trim() || !newRule.pattern.trim()) return
    
    addSensitiveRule({
      name: newRule.name,
      pattern: newRule.pattern,
      replacement: newRule.replacement,
      enabled: true,
    })
    
    setNewRule({ name: '', pattern: '', replacement: '***' })
    setShowAddRule(false)
  }
  
  const toggleRule = (rule: SensitiveRule) => {
    updateSensitiveRule(rule.id, { enabled: !rule.enabled })
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          设置
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <section className="card p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              🎨 外观
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  主题
                </label>
                <div className="flex gap-3">
                  {[
                    { key: 'light', label: '浅色', icon: '☀️' },
                    { key: 'dark', label: '深色', icon: '🌙' },
                    { key: 'system', label: '跟随系统', icon: '💻' },
                  ].map((theme) => (
                    <button
                      key={theme.key}
                      onClick={() => updateSettings({ theme: theme.key as typeof settings.theme })}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                        settings.theme === theme.key
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{theme.icon}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{theme.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          
          <section className="card p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              🔍 搜索设置
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.caseSensitiveSearch}
                  onChange={(e) => updateSettings({ caseSensitiveSearch: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    默认区分大小写
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    搜索时默认区分大小写
                  </div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoDetectEncoding}
                  onChange={(e) => updateSettings({ autoDetectEncoding: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    自动检测编码
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    导入时自动检测文件编码
                  </div>
                </div>
              </label>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  最大文件大小
                </label>
                <select
                  value={settings.maxFileSize}
                  onChange={(e) => updateSettings({ maxFileSize: Number(e.target.value) })}
                  className="input-field w-auto"
                >
                  <option value={10 * 1024 * 1024}>10 MB</option>
                  <option value={50 * 1024 * 1024}>50 MB</option>
                  <option value={100 * 1024 * 1024}>100 MB</option>
                  <option value={500 * 1024 * 1024}>500 MB</option>
                  <option value={1024 * 1024 * 1024}>1 GB</option>
                </select>
              </div>
            </div>
          </section>
          
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                🔒 敏感信息遮罩
              </h3>
              <button
                onClick={() => setShowAddRule(true)}
                className="btn-secondary text-sm"
              >
                ➕ 添加规则
              </button>
            </div>
            
            {showAddRule && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      规则名称
                    </label>
                    <input
                      type="text"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="如：姓名"
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      正则表达式
                    </label>
                    <input
                      type="text"
                      value={newRule.pattern}
                      onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                      placeholder="如：[\u4e00-\u9fa5]{2,4}"
                      className="input-field text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      替换文本
                    </label>
                    <input
                      type="text"
                      value={newRule.replacement}
                      onChange={(e) => setNewRule({ ...newRule, replacement: e.target.value })}
                      placeholder="***"
                      className="input-field text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddRule(false)}
                      className="btn-secondary text-sm"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddRule}
                      disabled={!newRule.name.trim() || !newRule.pattern.trim()}
                      className="btn-primary text-sm"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {settings.sensitiveRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    rule.enabled
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRule(rule)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        rule.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-white">
                        {rule.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {rule.pattern} → {rule.replacement}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (confirm('确定删除此规则？')) {
                        deleteSensitiveRule(rule.id)
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              导出诊断包时，会根据启用的规则自动遮罩敏感信息
            </p>
          </section>
          
          <section className="card p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              ℹ️ 关于
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>日志分析客户端 v1.0.0</p>
              <p>供客服支持和测试人员排查客户端或设备运行问题</p>
              <p className="text-xs text-gray-400">
                支持多种日志格式解析、智能搜索、异常聚合、报告生成等功能
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
