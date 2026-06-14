import { useState, useCallback } from 'react'
import { useLogStore } from '../store/useLogStore'
import { parseLogContent, detectTimeFormat, detectLogLevel, extractThread, extractErrorCode } from '../utils/logParser'
import type { LogPackage, LogFile, LogEntry } from '../types'
import { formatFileSize } from '../utils/exportUtils'

type ImportTab = 'drag' | 'folder' | 'clipboard'

interface PreviewFile {
  name: string
  size: number
  content?: string
  entries?: LogEntry[]
  parsed: boolean
  timeFormat?: string
  levelCounts?: Record<string, number>
}

export default function ImportView() {
  const { addPackage, setViewMode, setCurrentPackage } = useLogStore()
  const [activeTab, setActiveTab] = useState<ImportTab>('drag')
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([])
  const [projectName, setProjectName] = useState('')
  const [version, setVersion] = useState('')
  const [packageName, setPackageName] = useState('')
  const [description, setDescription] = useState('')
  const [clipboardText, setClipboardText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    await processFiles(files)
  }, [])
  
  const processFiles = async (fileList: FileList) => {
    const files: PreviewFile[] = []
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        files.push({
          name: file.name,
          size: file.size,
          parsed: false,
        })
      } else if (file.type === '' || file.name.endsWith('.log') || file.name.endsWith('.txt')) {
        try {
          const content = await readFileAsText(file)
          const entries = parseLogContent(content, file.name)
          const timePattern = detectTimeFormat(content)
          const levelCounts = getLevelCounts(entries)
          
          files.push({
            name: file.name,
            size: file.size,
            content,
            entries,
            parsed: true,
            timeFormat: timePattern?.name,
            levelCounts,
          })
        } catch {
          files.push({
            name: file.name,
            size: file.size,
            parsed: false,
          })
        }
      }
    }
    
    setPreviewFiles((prev) => [...prev, ...files])
  }
  
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }
  
  const getLevelCounts = (entries: LogEntry[]): Record<string, number> => {
    const counts: Record<string, number> = {}
    for (const entry of entries) {
      counts[entry.level] = (counts[entry.level] || 0) + 1
    }
    return counts
  }
  
  const handleSelectFolder = async () => {
    if (window.electronAPI) {
      const paths = await window.electronAPI.selectDirectory()
      if (paths && paths.length > 0) {
        const files: PreviewFile[] = []
        
        for (const dirPath of paths) {
          const dirFiles = await window.electronAPI.readDirectory(dirPath)
          const logFiles = dirFiles.filter(
            (f) => !f.isDirectory && (f.name.endsWith('.log') || f.name.endsWith('.txt'))
          )
          
          for (const file of logFiles) {
            try {
              const content = await window.electronAPI.readFile(file.path)
              const entries = parseLogContent(content, file.name)
              const timePattern = detectTimeFormat(content)
              const levelCounts = getLevelCounts(entries)
              
              files.push({
                name: file.name,
                size: file.size,
                content,
                entries,
                parsed: true,
                timeFormat: timePattern?.name,
                levelCounts,
              })
            } catch {
              files.push({
                name: file.name,
                size: file.size,
                parsed: false,
              })
            }
          }
        }
        
        setPreviewFiles((prev) => [...prev, ...files])
      }
    }
  }
  
  const handleSelectFiles = async () => {
    if (window.electronAPI) {
      const paths = await window.electronAPI.selectFiles()
      if (paths && paths.length > 0) {
        const files: PreviewFile[] = []
        
        for (const filePath of paths) {
          const fileName = filePath.split(/[/\\]/).pop() || 'unknown.log'
          
          try {
            const content = await window.electronAPI.readFile(filePath)
            const entries = parseLogContent(content, fileName)
            const timePattern = detectTimeFormat(content)
            const levelCounts = getLevelCounts(entries)
            
            files.push({
              name: fileName,
              size: content.length,
              content,
              entries,
              parsed: true,
              timeFormat: timePattern?.name,
              levelCounts,
            })
          } catch {
            files.push({
              name: fileName,
              size: 0,
              parsed: false,
            })
          }
        }
        
        setPreviewFiles((prev) => [...prev, ...files])
      }
    }
  }
  
  const handlePasteFromClipboard = async () => {
    if (window.electronAPI) {
      const text = await window.electronAPI.getClipboardText()
      if (text) {
        setClipboardText(text)
        previewClipboardContent(text)
      }
    } else {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          setClipboardText(text)
          previewClipboardContent(text)
        }
      } catch {
        alert('无法读取剪贴板，请手动粘贴')
      }
    }
  }
  
  const previewClipboardContent = (text: string) => {
    const entries = parseLogContent(text, 'clipboard.log')
    const timePattern = detectTimeFormat(text)
    const levelCounts = getLevelCounts(entries)
    
    const clipboardFile: PreviewFile = {
      name: 'clipboard.log',
      size: text.length,
      content: text,
      entries,
      parsed: true,
      timeFormat: timePattern?.name,
      levelCounts,
    }
    
    setPreviewFiles([clipboardFile])
  }
  
  const handleClipboardTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setClipboardText(text)
  }
  
  const handleParseClipboard = () => {
    if (clipboardText.trim()) {
      previewClipboardContent(clipboardText)
    }
  }
  
  const removeFile = (index: number) => {
    setPreviewFiles((prev) => prev.filter((_, i) => i !== index))
  }
  
  const clearAllFiles = () => {
    setPreviewFiles([])
    setClipboardText('')
  }
  
  const handleImport = async () => {
    if (previewFiles.length === 0) {
      alert('请先添加日志文件')
      return
    }
    
    if (!projectName.trim()) {
      alert('请输入项目名称')
      return
    }
    
    setIsImporting(true)
    setImportProgress(0)
    
    try {
      const logFiles: LogFile[] = []
      
      for (let i = 0; i < previewFiles.length; i++) {
        const file = previewFiles[i]
        
        if (file.entries) {
          logFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            path: file.name,
            size: file.size,
            entries: file.entries,
            parsed: true,
          })
        }
        
        setImportProgress(Math.round(((i + 1) / previewFiles.length) * 100))
      }
      
      const now = Date.now()
      const newPackage: LogPackage = {
        id: `pkg-${now}`,
        name: packageName.trim() || `${projectName}-${version || 'unknown'}-${new Date().toISOString().split('T')[0]}`,
        project: projectName.trim(),
        version: version.trim() || 'unknown',
        createdAt: now,
        updatedAt: now,
        files: logFiles,
        description: description.trim(),
        tags: [],
      }
      
      addPackage(newPackage)
      setCurrentPackage(newPackage.id)
      
      setIsImporting(false)
      setViewMode('analysis')
    } catch (error) {
      console.error('Import failed:', error)
      alert('导入失败，请重试')
      setIsImporting(false)
    }
  }
  
  const parsedFilesCount = previewFiles.filter((f) => f.parsed).length
  const totalEntries = previewFiles.reduce((sum, f) => sum + (f.entries?.length || 0), 0)
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">导入日志</h2>
        <p className="text-gray-500 dark:text-gray-400">
          支持导入日志文件、文件夹、压缩包和剪贴板文本，自动识别时间格式、级别、线程和错误码
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card mb-6">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {[
                  { key: 'drag', label: '拖拽导入', icon: '📁' },
                  { key: 'folder', label: '选择文件', icon: '📂' },
                  { key: 'clipboard', label: '剪贴板', icon: '📋' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as ImportTab)}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="p-4">
                {activeTab === 'drag' && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isDragOver
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-5xl mb-4">📁</div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      拖拽日志文件或文件夹到这里
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      支持 .log、.txt、.zip 格式
                    </p>
                    <button
                      onClick={handleSelectFiles}
                      className="btn-secondary"
                    >
                      或点击选择文件
                    </button>
                  </div>
                )}
                
                {activeTab === 'folder' && (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <button
                        onClick={handleSelectFolder}
                        className="btn-primary flex-1"
                      >
                        📂 选择文件夹
                      </button>
                      <button
                        onClick={handleSelectFiles}
                        className="btn-secondary flex-1"
                      >
                        📄 选择文件
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      选择包含日志文件的文件夹，将自动解析所有 .log 和 .txt 文件
                    </p>
                  </div>
                )}
                
                {activeTab === 'clipboard' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={handlePasteFromClipboard}
                        className="btn-primary"
                      >
                        📋 从剪贴板粘贴
                      </button>
                      <button
                        onClick={handleParseClipboard}
                        className="btn-secondary"
                      >
                        🔍 解析文本
                      </button>
                    </div>
                    <textarea
                      value={clipboardText}
                      onChange={handleClipboardTextChange}
                      placeholder="或在此粘贴日志文本..."
                      className="w-full h-48 input-field font-mono text-sm resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {previewFiles.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    预览 ({previewFiles.length} 个文件)
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      已解析 {parsedFilesCount} 个，共 {totalEntries.toLocaleString()} 条日志
                    </span>
                    <button
                      onClick={clearAllFiles}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      清空全部
                    </button>
                  </div>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {previewFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {file.name.endsWith('.zip') ? '📦' : '📄'}
                        </span>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">
                            {file.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                            {file.timeFormat && ` · ${file.timeFormat}`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {file.parsed && file.levelCounts && (
                          <div className="flex items-center gap-1">
                            {file.levelCounts.error && (
                              <span className="tag tag-error">{file.levelCounts.error}</span>
                            )}
                            {file.levelCounts.warn && (
                              <span className="tag tag-warn">{file.levelCounts.warn}</span>
                            )}
                            {file.entries && (
                              <span className="text-xs text-gray-500">
                                {file.entries.length} 条
                              </span>
                            )}
                          </div>
                        )}
                        
                        {!file.parsed && (
                          <span className="text-xs text-amber-500">未解析</span>
                        )}
                        
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4">
                日志包信息
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    项目名称 *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="如：移动端APP"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    版本号
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="如：v1.2.3"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    日志包名称
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="留空自动生成"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="问题描述、复现步骤等..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="card p-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
                自动识别功能
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  自动识别多种时间格式
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  自动识别日志级别 (DEBUG/INFO/WARN/ERROR/FATAL)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  自动提取线程信息
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  自动识别错误码
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  自动解析异常堆栈
                </li>
              </ul>
            </div>
            
            <button
              onClick={handleImport}
              disabled={isImporting || previewFiles.length === 0 || !projectName.trim()}
              className="w-full btn-primary text-lg py-3"
            >
              {isImporting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  导入中... {importProgress}%
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>🚀</span>
                  开始导入
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
