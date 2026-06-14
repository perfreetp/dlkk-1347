export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown'

export type ImportSourceType = 'directory' | 'zip' | 'file' | 'clipboard'

export interface ImportSource {
  id: string
  type: ImportSourceType
  name: string
  path?: string
  files: LogFile[]
  remark?: string
}

export interface ComparePair {
  id: string
  entryAId: string
  entryBId: string
  createdAt: number
}

export interface LogEntry {
  id: string
  timestamp: number
  timestampStr: string
  level: LogLevel
  thread?: string
  logger?: string
  message: string
  errorCode?: string
  raw: string
  lineNumber: number
  sourceFile?: string
  tags: string[]
  isStarred: boolean
  sourceId?: string
}

export interface LogFile {
  id: string
  name: string
  path: string
  size: number
  entries: LogEntry[]
  parsed: boolean
  encoding?: string
  entryCount?: number
  timeRange?: { start: number; end: number }
  sourceId?: string
}

export type RightPanelType = 'detail' | 'timeline' | 'aggregation' | 'compare'

export interface LogPackage {
  id: string
  name: string
  project: string
  version: string
  createdAt: number
  updatedAt: number
  files: LogFile[]
  description?: string
  tags: string[]
  sources?: ImportSource[]
  comparePairs?: ComparePair[]
  currentCompareId?: string | null
  selectedSourceIds?: string[]
  uiState?: {
    rightPanel?: RightPanelType
    showContext?: boolean
    contextSize?: number
    selectedEntryId?: string | null
    compareEntryId?: string | null
    compareMode?: 'idle' | 'selectA' | 'selectB'
  }
}

export interface FilterOptions {
  keyword: string
  isRegex: boolean
  levels: LogLevel[]
  threads: string[]
  loggers: string[]
  errorCodes: string[]
  startTime?: number
  endTime?: number
  caseSensitive: boolean
  onlyStarred?: boolean
  tagFilter?: string[]
  sourceFilter?: string[]
}

export interface AggregatedError {
  id: string
  pattern: string
  count: number
  firstOccurrence: number
  lastOccurrence: number
  sampleEntries: LogEntry[]
  affectedFiles: string[]
}

export interface ReportData {
  totalEntries: number
  errorCount: number
  warnCount: number
  timeRange: { start: number; end: number }
  topErrors: AggregatedError[]
  firstErrorTime?: number
  userActions: string[]
  suspiciousConfigs: string[]
  summary: string
}

export interface SensitiveRule {
  id: string
  name: string
  pattern: string
  replacement: string
  enabled: boolean
}

export interface CaseItem {
  id: string
  title: string
  description: string
  logPackageId: string
  relatedEntryIds: string[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  defaultLogLevel: LogLevel
  sensitiveRules: SensitiveRule[]
  autoDetectEncoding: boolean
  maxFileSize: number
  caseSensitiveSearch: boolean
}

declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string[]>
      selectFiles: () => Promise<string[]>
      readFile: (filePath: string) => Promise<string>
      readDirectory: (dirPath: string) => Promise<Array<{
        name: string
        path: string
        isDirectory: boolean
        size: number
      }>>
      getClipboardText: () => Promise<string>
      saveDialog: (defaultPath: string) => Promise<string | undefined>
      saveFile: (filePath: string, content: string | Buffer) => Promise<boolean>
      openExternal: (url: string) => Promise<void>
      showItemInFolder: (filePath: string) => Promise<void>
      getFileStats: (filePath: string) => Promise<{
        size: number
        birthTime: number
        mtime: number
      }>
    }
  }
}

export {}
