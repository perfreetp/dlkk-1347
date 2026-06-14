import { useState, useCallback, useRef } from 'react'
import { useLogStore } from '../store/useLogStore'
import { parseLogContent, detectTimeFormat } from '../utils/logParser'
import type { LogPackage, LogFile, LogEntry, ImportSource, ImportSourceType } from '../types'
import { formatFileSize } from '../utils/exportUtils'
import JSZip from 'jszip'

type ImportTab = 'drag' | 'folder' | 'clipboard'

interface PreviewFile {
  name: string
  path: string
  size: number
  content?: string
  entries?: LogEntry[]
  parsed: boolean
  timeFormat?: string
  levelCounts?: Record<string, number>
  entryCount?: number
  timeRange?: { start: number; end: number }
  sourceId: string
}

interface PreviewSource {
  id: string
  type: ImportSourceType
  name: string
  path?: string
  files: PreviewFile[]
  expanded: boolean
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export default function ImportView() {
  const { addPackage, setViewMode, setCurrentPackage } = useLogStore()
  const [activeTab, setActiveTab] = useState<ImportTab>('drag')
  const [isDragOver, setIsDragOver] = useState(false)
  const [sources, setSources] = useState<PreviewSource[]>([])
  const [projectName, setProjectName] = useState('')
  const [version, setVersion] = useState('')
  const [packageName, setPackageName] = useState('')
  const [description, setDescription] = useState('')
  const [clipboardText, setClipboardText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [processingText, setProcessingText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalPreviewFiles = sources.reduce((sum, s) => sum + s.files.length, 0)
  const parsedFilesCount = sources.reduce((sum, s) => sum + s.files.filter((f) => f.parsed).length, 0)
  const totalEntries = sources.reduce((sum, s) => sum + s.files.reduce((s2, f) => s2 + (f.entryCount || f.entries?.length || 0), 0), 0)

  const addSource = (source: PreviewSource) => {
    setSources((prev) => [...prev, source])
  }

  const replaceClipboardSource = (source: PreviewSource) => {
    setSources((prev) => {
      const filtered = prev.filter((s) => s.type !== 'clipboard')
      return [...filtered, source]
    })
  }

  const removeFile = (sourceId: string, fileIndex: number) => {
    setSources((prev) => {
      return prev
        .map((s) => {
          if (s.id !== sourceId) return s
          return { ...s, files: s.files.filter((_, i) => i !== fileIndex) }
        })
        .filter((s) => s.files.length > 0)
    })
  }

  const removeSource = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId))
  }

  const toggleSource = (sourceId: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, expanded: !s.expanded } : s))
    )
  }

  const clearAllFiles = () => {
    setSources([])
    setClipboardText('')
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      await processDroppedItems(items)
    } else {
      const files = e.dataTransfer.files
      await processFileList(files)
    }
  }, [])

  const processDroppedItems = async (items: DataTransferItemList) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.()

        if (entry) {
          if (entry.isDirectory) {
            const sourceId = generateId()
            setProcessingText(`正在扫描文件夹: ${entry.name}`)
            const dirFiles = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, sourceId, '')
            if (dirFiles.length > 0) {
              addSource({
                id: sourceId,
                type: 'directory',
                name: entry.name,
                files: dirFiles,
                expanded: true,
              })
            }
            setProcessingText('')
          } else {
            const file = item.getAsFile()
            if (file) {
              await processExternalFile(file, file.name)
            }
          }
        }
      }
    }
  }

  const readDirectoryRecursive = (
    dirEntry: FileSystemDirectoryEntry,
    sourceId: string,
    path: string = ''
  ): Promise<PreviewFile[]> => {
    return new Promise((resolve) => {
      const reader = dirEntry.createReader()
      const results: PreviewFile[] = []

      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(results)
            return
          }

          for (const entry of entries) {
            if (entry.isFile) {
              const isLogFile =
                entry.name.endsWith('.log') ||
                entry.name.endsWith('.txt') ||
                entry.name.endsWith('.zip')

              if (isLogFile) {
                const fileEntry = entry as FileSystemFileEntry
                try {
                  const file = await new Promise<File>((res, rej) => {
                    fileEntry.file(res, rej)
                  })

                  const filePath = path ? `${path}/${entry.name}` : entry.name
                  const processed = await processSingleFile(file, filePath, sourceId)
                  results.push(...processed)
                } catch {
                  // skip
                }
              }
            } else if (entry.isDirectory) {
              const subDir = entry as FileSystemDirectoryEntry
              const subPath = path ? `${path}/${entry.name}` : entry.name
              const subFiles = await readDirectoryRecursive(subDir, sourceId, subPath)
              results.push(...subFiles)
            }
          }

          readEntries()
        }, () => {
          resolve(results)
        })
      }

      readEntries()
    })
  }

  const processFileList = async (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      await processExternalFile(file, file.name)
    }
  }

  const processExternalFile = async (file: File, displayName: string) => {
    const sourceId = generateId()
    const processed = await processSingleFile(file, displayName, sourceId)

    if (file.name.endsWith('.zip')) {
      if (processed.length > 0) {
        addSource({
          id: sourceId,
          type: 'zip',
          name: file.name,
          files: processed,
          expanded: true,
        })
      }
    } else {
      if (processed.length > 0) {
        addSource({
          id: sourceId,
          type: 'file',
          name: file.name,
          files: processed,
          expanded: true,
        })
      }
    }
  }

  const processSingleFile = async (file: File, displayName: string, sourceId: string): Promise<PreviewFile[]> => {
    const results: PreviewFile[] = []

    if (file.name.endsWith('.zip')) {
      try {
        setProcessingText(`正在解析压缩包: ${file.name}`)
        const zipFiles = await processZipFile(file, displayName, sourceId)
        results.push(...zipFiles)
        setProcessingText('')
      } catch {
        results.push({
          name: displayName,
          path: displayName,
          size: file.size,
          parsed: false,
          sourceId,
        })
        setProcessingText('')
      }
    } else if (file.name.endsWith('.log') || file.name.endsWith('.txt') || file.type === '') {
      try {
        const content = await readFileAsText(file)
        const entries = parseLogContent(content, displayName)
        const timePattern = detectTimeFormat(content)
        const levelCounts = getLevelCounts(entries)
        const timeRange = entries.length > 0 ? { start: entries[0].timestamp, end: entries[entries.length - 1].timestamp } : undefined

        results.push({
          name: displayName,
          path: displayName,
          size: file.size,
          entries,
          parsed: true,
          timeFormat: timePattern?.name,
          levelCounts,
          entryCount: entries.length,
          timeRange,
          sourceId,
        })
      } catch {
        results.push({
          name: displayName,
          path: displayName,
          size: file.size,
          parsed: false,
          sourceId,
        })
      }
    }

    return results
  }

  const processZipFile = async (file: File, zipName: string, sourceId: string): Promise<PreviewFile[]> => {
    const results: PreviewFile[] = []

    try {
      const zip = await JSZip.loadAsync(file)
      const fileList: { name: string; content: string; size: number }[] = []

      const processPromises: Promise<void>[] = []

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const isLogFile = relativePath.endsWith('.log') || relativePath.endsWith('.txt')

          if (isLogFile) {
            const promise = zipEntry.async('string').then((content) => {
              fileList.push({
                name: relativePath,
                content,
                size: content.length,
              })
            })
            processPromises.push(promise)
          }
        }
      })

      await Promise.all(processPromises)

      for (const f of fileList) {
        const entries = parseLogContent(f.content, f.name)
        const timePattern = detectTimeFormat(f.content)
        const levelCounts = getLevelCounts(entries)
        const timeRange = entries.length > 0 ? { start: entries[0].timestamp, end: entries[entries.length - 1].timestamp } : undefined

        results.push({
          name: f.name,
          path: `${zipName}/${f.name}`,
          size: f.size,
          entries,
          parsed: true,
          timeFormat: timePattern?.name,
          levelCounts,
          entryCount: entries.length,
          timeRange,
          sourceId,
        })
      }
    } catch (error) {
      console.error('Zip processing error:', error)
    }

    return results
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
        for (const dirPath of paths) {
          const sourceId = generateId()
          const dirName = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath
          setProcessingText(`正在扫描文件夹: ${dirName}`)

          const previewFiles: PreviewFile[] = []
          await scanDirectoryElectron(dirPath, sourceId, previewFiles, '')

          if (previewFiles.length > 0) {
            addSource({
              id: sourceId,
              type: 'directory',
              name: dirName,
              path: dirPath,
              files: previewFiles,
              expanded: true,
            })
          }
          setProcessingText('')
        }
      }
    }
  }

  const scanDirectoryElectron = async (dirPath: string, sourceId: string, outFiles: PreviewFile[], relativePath: string) => {
    if (!window.electronAPI) return

    const entries = await window.electronAPI.readDirectory(dirPath)

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (entry.isDirectory) {
        await scanDirectoryElectron(fullPath, sourceId, outFiles, relPath)
      } else {
        const isLogFile =
          entry.name.endsWith('.log') ||
          entry.name.endsWith('.txt') ||
          entry.name.endsWith('.zip')

        if (!isLogFile) continue

        if (entry.name.endsWith('.zip')) {
          try {
            setProcessingText(`正在解析压缩包: ${entry.name}`)
            const content = await window.electronAPI.readFile(fullPath)
            const zip = await JSZip.loadAsync(content)

            const processPromises: Promise<void>[] = []
            const extracted: { name: string; content: string; size: number }[] = []

            zip.forEach((zipRelPath, zipEntry) => {
              if (!zipEntry.dir && (zipRelPath.endsWith('.log') || zipRelPath.endsWith('.txt'))) {
                const promise = zipEntry.async('string').then((textContent) => {
                  extracted.push({ name: zipRelPath, content: textContent, size: textContent.length })
                })
                processPromises.push(promise)
              }
            })

            await Promise.all(processPromises)

            for (const f of extracted) {
              const parsedEntries = parseLogContent(f.content, f.name)
              const timePattern = detectTimeFormat(f.content)
              const levelCounts = getLevelCounts(parsedEntries)
              const timeRange = parsedEntries.length > 0 ? { start: parsedEntries[0].timestamp, end: parsedEntries[parsedEntries.length - 1].timestamp } : undefined

              outFiles.push({
                name: f.name,
                path: `${relPath}/${f.name}`,
                size: f.size,
                entries: parsedEntries,
                parsed: true,
                timeFormat: timePattern?.name,
                levelCounts,
                entryCount: parsedEntries.length,
                timeRange,
                sourceId,
              })
            }
            setProcessingText('')
          } catch (e) {
            console.error('zip parse error', e)
          }
        } else {
          try {
            const content = await window.electronAPI.readFile(fullPath)
            const parsedEntries = parseLogContent(content, relPath)
            const timePattern = detectTimeFormat(content)
            const levelCounts = getLevelCounts(parsedEntries)
            const timeRange = parsedEntries.length > 0 ? { start: parsedEntries[0].timestamp, end: parsedEntries[parsedEntries.length - 1].timestamp } : undefined

            outFiles.push({
              name: relPath,
              path: fullPath,
              size: entry.size,
              entries: parsedEntries,
              parsed: true,
              timeFormat: timePattern?.name,
              levelCounts,
              entryCount: parsedEntries.length,
              timeRange,
              sourceId,
            })
          } catch {
            outFiles.push({
              name: relPath,
              path: fullPath,
              size: entry.size,
              parsed: false,
              sourceId,
            })
          }
        }
      }
    }
  }

  const handleSelectFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processFileList(files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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
    const timeRange = entries.length > 0 ? { start: entries[0].timestamp, end: entries[entries.length - 1].timestamp } : undefined
    const sourceId = generateId()

    const clipboardFile: PreviewFile = {
      name: 'clipboard.log',
      path: 'clipboard.log',
      size: text.length,
      entries,
      parsed: true,
      timeFormat: timePattern?.name,
      levelCounts,
      entryCount: entries.length,
      timeRange,
      sourceId,
    }

    replaceClipboardSource({
      id: sourceId,
      type: 'clipboard',
      name: '剪贴板内容',
      files: [clipboardFile],
      expanded: true,
    })
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

  const formatTime = (ts?: number) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const handleImport = async () => {
    if (sources.length === 0) {
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
      const allPreviewFiles: PreviewFile[] = []
      sources.forEach((s) => allPreviewFiles.push(...s.files))
      const totalFiles = allPreviewFiles.length

      const logFiles: LogFile[] = []
      const importSources: ImportSource[] = []

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]
        const sourceFiles: LogFile[] = []

        for (const file of source.files) {
          if (file.entries && file.parsed) {
            const logFile: LogFile = {
              id: `file-${generateId()}`,
              name: file.name,
              path: file.path,
              size: file.size,
              entries: file.entries,
              parsed: true,
              entryCount: file.entryCount || file.entries.length,
              timeRange: file.timeRange,
            }
            logFiles.push(logFile)
            sourceFiles.push(logFile)
          }

          setImportProgress(Math.round(((logFiles.length) / Math.max(totalFiles, 1)) * 100))
        }

        importSources.push({
          id: source.id,
          type: source.type,
          name: source.name,
          path: source.path,
          files: sourceFiles,
        })
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
        sources: importSources,
        comparePairs: [],
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

  const getSourceIcon = (type: ImportSourceType) => {
    switch (type) {
      case 'directory':
        return '📁'
      case 'zip':
        return '📦'
      case 'file':
        return '📄'
      case 'clipboard':
        return '📋'
    }
  }

  const getSourceTypeLabel = (type: ImportSourceType) => {
    switch (type) {
      case 'directory':
        return '文件夹'
      case 'zip':
        return '压缩包'
      case 'file':
        return '文件'
      case 'clipboard':
        return '剪贴板'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".log,.txt,.zip"
        className="hidden"
        onChange={handleFileInputChange}
      />

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
                      拖拽日志文件、文件夹或压缩包到这里
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      支持 .log、.txt、.zip 格式，支持文件夹递归扫描
                    </p>
                    {processingText && (
                      <p className="text-sm text-blue-500 mb-4">
                        ⏳ {processingText}...
                      </p>
                    )}
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
                    {processingText && (
                      <p className="text-sm text-blue-500">
                        ⏳ {processingText}...
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      选择包含日志文件的文件夹，将自动递归扫描所有子目录下的 .log、.txt 和 .zip 文件
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

            {sources.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    预览 ({sources.length} 个来源 / {totalPreviewFiles} 个文件)
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

                <div className="max-h-[480px] overflow-y-auto">
                  {sources.map((source) => {
                    const sourceEntryCount = source.files.reduce((s, f) => s + (f.entryCount || f.entries?.length || 0), 0)
                    return (
                      <div key={source.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <div
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => toggleSource(source.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-gray-400 text-sm w-4 text-center">
                              {source.expanded ? '▼' : '▶'}
                            </span>
                            <span className="text-xl flex-shrink-0">{getSourceIcon(source.type)}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-800 dark:text-white truncate">
                                {source.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                <span className="tag tag-info">{getSourceTypeLabel(source.type)}</span>
                                <span className="ml-2">{source.files.length} 个文件</span>
                                <span className="ml-2">·</span>
                                <span className="ml-2">{sourceEntryCount.toLocaleString()} 条日志</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeSource(source.id)
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                          >
                            ✕
                          </button>
                        </div>

                        {source.expanded && (
                          <div className="bg-white dark:bg-gray-800">
                            {source.files.map((file, fileIdx) => (
                              <div
                                key={fileIdx}
                                className="flex items-center justify-between p-3 pl-14 border-t border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <span className="text-lg flex-shrink-0">
                                    📄
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-800 dark:text-white truncate text-sm">
                                      {file.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
                                      <span>{formatFileSize(file.size)}</span>
                                      {file.timeFormat && <span>· {file.timeFormat}</span>}
                                      {file.timeRange && (
                                        <span>
                                          · 🕒 {formatTime(file.timeRange.start)} ~ {formatTime(file.timeRange.end)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                  {file.parsed && file.levelCounts && (
                                    <div className="flex items-center gap-1">
                                      {file.levelCounts.fatal && (
                                        <span className="tag tag-error">{file.levelCounts.fatal}</span>
                                      )}
                                      {file.levelCounts.error && (
                                        <span className="tag tag-error">{file.levelCounts.error}</span>
                                      )}
                                      {file.levelCounts.warn && (
                                        <span className="tag tag-warn">{file.levelCounts.warn}</span>
                                      )}
                                      <span className="text-xs text-gray-500 font-medium">
                                        {(file.entryCount || file.entries?.length || 0).toLocaleString()} 条
                                      </span>
                                    </div>
                                  )}

                                  {!file.parsed && (
                                    <span className="text-xs text-amber-500">未解析</span>
                                  )}

                                  <button
                                    onClick={() => removeFile(source.id, fileIdx)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  支持 ZIP 压缩包自动解压
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  文件夹递归扫描子目录
                </li>
              </ul>
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting || sources.length === 0 || !projectName.trim()}
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
