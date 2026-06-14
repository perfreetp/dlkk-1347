import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  LogPackage,
  LogEntry,
  FilterOptions,
  AppSettings,
  SensitiveRule,
  CaseItem,
  ComparePair,
  LogLevel,
} from '../types'
import { DEFAULT_SENSITIVE_RULES } from '../utils/sensitiveMask'
import { filterLogs } from '../utils/logFilter'

interface LogState {
  packages: LogPackage[]
  currentPackageId: string | null
  currentFileId: string | null
  selectedEntryId: string | null
  filterOptions: FilterOptions
  settings: AppSettings
  cases: CaseItem[]
  viewMode: 'home' | 'import' | 'analysis' | 'report' | 'cases' | 'settings'

  setViewMode: (mode: LogState['viewMode']) => void
  addPackage: (pkg: LogPackage) => void
  removePackage: (pkgId: string) => void
  updatePackage: (pkgId: string, updates: Partial<LogPackage>) => void
  setCurrentPackage: (pkgId: string | null) => void
  setCurrentFile: (fileId: string | null) => void
  setSelectedEntry: (entryId: string | null) => void

  updateFilter: (updates: Partial<FilterOptions>) => void
  resetFilter: () => void

  toggleStar: (entryId: string) => void
  addTag: (entryId: string, tag: string) => void
  removeTag: (entryId: string, tag: string) => void

  addComparePair: (pkgId: string, entryAId: string, entryBId: string) => string
  removeComparePair: (pkgId: string, pairId: string) => void
  setCurrentCompare: (pkgId: string, pairId: string | null) => void

  updateSettings: (updates: Partial<AppSettings>) => void
  addSensitiveRule: (rule: Omit<SensitiveRule, 'id'>) => void
  updateSensitiveRule: (ruleId: string, updates: Partial<SensitiveRule>) => void
  deleteSensitiveRule: (ruleId: string) => void

  addCase: (caseItem: Omit<CaseItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  removeCase: (caseId: string) => void
  updateCase: (caseId: string, updates: Partial<CaseItem>) => void
}

const defaultFilterOptions: FilterOptions = {
  keyword: '',
  isRegex: false,
  levels: [],
  threads: [],
  loggers: [],
  errorCodes: [],
  caseSensitive: false,
  onlyStarred: false,
  tagFilter: [],
}

const defaultSettings: AppSettings = {
  theme: 'light',
  defaultLogLevel: 'debug',
  sensitiveRules: DEFAULT_SENSITIVE_RULES,
  autoDetectEncoding: true,
  maxFileSize: 100 * 1024 * 1024,
  caseSensitiveSearch: false,
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const updatePackageEntries = (
  packages: LogPackage[],
  updater: (entry: LogEntry) => LogEntry
): LogPackage[] => {
  return packages.map((pkg) => ({
    ...pkg,
    files: pkg.files.map((file) => ({
      ...file,
      entries: file.entries.map(updater),
    })),
  }))
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      packages: [],
      currentPackageId: null,
      currentFileId: null,
      selectedEntryId: null,
      filterOptions: defaultFilterOptions,
      settings: defaultSettings,
      cases: [],
      viewMode: 'home',

      setViewMode: (mode) => set({ viewMode: mode }),

      addPackage: (pkg) =>
        set((state) => ({
          packages: [...state.packages, pkg],
        })),

      removePackage: (pkgId) =>
        set((state) => ({
          packages: state.packages.filter((p) => p.id !== pkgId),
          currentPackageId: state.currentPackageId === pkgId ? null : state.currentPackageId,
        })),

      updatePackage: (pkgId, updates) =>
        set((state) => ({
          packages: state.packages.map((p) =>
            p.id === pkgId ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        })),

      setCurrentPackage: (pkgId) => set({ currentPackageId: pkgId }),
      setCurrentFile: (fileId) => set({ currentFileId: fileId }),
      setSelectedEntry: (entryId) => set({ selectedEntryId: entryId }),

      updateFilter: (updates) =>
        set((state) => ({
          filterOptions: { ...state.filterOptions, ...updates },
        })),

      resetFilter: () => set({ filterOptions: defaultFilterOptions }),

      toggleStar: (entryId) =>
        set((state) => ({
          packages: updatePackageEntries(state.packages, (entry) =>
            entry.id === entryId ? { ...entry, isStarred: !entry.isStarred } : entry
          ),
        })),

      addTag: (entryId, tag) =>
        set((state) => ({
          packages: updatePackageEntries(state.packages, (entry) =>
            entry.id === entryId && !entry.tags.includes(tag)
              ? { ...entry, tags: [...entry.tags, tag] }
              : entry
          ),
        })),

      removeTag: (entryId, tag) =>
        set((state) => ({
          packages: updatePackageEntries(state.packages, (entry) =>
            entry.id === entryId ? { ...entry, tags: entry.tags.filter((t) => t !== tag) } : entry
          ),
        })),

      addComparePair: (pkgId, entryAId, entryBId) => {
        const pairId = `cmp-${genId()}`
        const newPair: ComparePair = {
          id: pairId,
          entryAId,
          entryBId,
          createdAt: Date.now(),
        }
        set((state) => ({
          packages: state.packages.map((pkg) =>
            pkg.id === pkgId
              ? {
                  ...pkg,
                  comparePairs: [...(pkg.comparePairs || []), newPair],
                  currentCompareId: pairId,
                  updatedAt: Date.now(),
                }
              : pkg
          ),
        }))
        return pairId
      },

      removeComparePair: (pkgId, pairId) =>
        set((state) => ({
          packages: state.packages.map((pkg) =>
            pkg.id === pkgId
              ? {
                  ...pkg,
                  comparePairs: (pkg.comparePairs || []).filter((p) => p.id !== pairId),
                  currentCompareId: pkg.currentCompareId === pairId ? null : pkg.currentCompareId,
                  updatedAt: Date.now(),
                }
              : pkg
          ),
        })),

      setCurrentCompare: (pkgId, pairId) =>
        set((state) => ({
          packages: state.packages.map((pkg) =>
            pkg.id === pkgId ? { ...pkg, currentCompareId: pairId, updatedAt: Date.now() } : pkg
          ),
        })),

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      addSensitiveRule: (rule) =>
        set((state) => ({
          settings: {
            ...state.settings,
            sensitiveRules: [
              ...state.settings.sensitiveRules,
              { ...rule, id: `rule-${Date.now()}` },
            ],
          },
        })),

      updateSensitiveRule: (ruleId, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            sensitiveRules: state.settings.sensitiveRules.map((r) =>
              r.id === ruleId ? { ...r, ...updates } : r
            ),
          },
        })),

      deleteSensitiveRule: (ruleId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            sensitiveRules: state.settings.sensitiveRules.filter((r) => r.id !== ruleId),
          },
        })),

      addCase: (caseItem) =>
        set((state) => ({
          cases: [
            ...state.cases,
            {
              ...caseItem,
              id: `case-${Date.now()}`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        })),

      removeCase: (caseId) =>
        set((state) => ({
          cases: state.cases.filter((c) => c.id !== caseId),
        })),

      updateCase: (caseId, updates) =>
        set((state) => ({
          cases: state.cases.map((c) =>
            c.id === caseId ? { ...c, ...updates, updatedAt: Date.now() } : c
          ),
        })),
    }),
    {
      name: 'log-analyzer-storage',
      partialize: (state) => ({
        packages: state.packages,
        settings: state.settings,
        cases: state.cases,
      }),
    }
  )
)

export const useCurrentPackage = (): LogPackage | null => {
  const { packages, currentPackageId } = useLogStore()
  return packages.find((p) => p.id === currentPackageId) || null
}

export const useAllEntries = (): LogEntry[] => {
  const currentPkg = useCurrentPackage()
  if (!currentPkg) return []

  const allEntries: LogEntry[] = []
  for (const file of currentPkg.files) {
    allEntries.push(...file.entries)
  }
  return allEntries.sort((a, b) => a.timestamp - b.timestamp)
}

export const useFilteredEntries = (): LogEntry[] => {
  const allEntries = useAllEntries()
  const { filterOptions } = useLogStore()

  return filterLogs(allEntries, filterOptions)
}

export const useAllTags = (): string[] => {
  const { packages } = useLogStore()
  const tagSet = new Set<string>()
  for (const pkg of packages) {
    for (const tag of pkg.tags) tagSet.add(tag)
    for (const file of pkg.files) {
      for (const entry of file.entries) {
        for (const tag of entry.tags) tagSet.add(tag)
      }
    }
  }
  return Array.from(tagSet).sort()
}
