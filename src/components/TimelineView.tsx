import { useMemo, useState } from 'react'
import type { LogEntry, LogLevel } from '../types'
import { getTimelineData } from '../utils/logFilter'

interface Props {
  entries: LogEntry[]
  onEntryClick: (entryId: string) => void
}

type BucketSize = '1s' | '10s' | '1m' | '10m' | '1h'

const bucketSizeMap: Record<BucketSize, number> = {
  '1s': 1000,
  '10s': 10000,
  '1m': 60000,
  '10m': 600000,
  '1h': 3600000,
}

export default function TimelineView({ entries, onEntryClick }: Props) {
  const [bucketSize, setBucketSize] = useState<BucketSize>('1m')
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  
  const timelineData = useMemo(() => {
    return getTimelineData(entries, bucketSizeMap[bucketSize])
  }, [entries, bucketSize])
  
  const maxCount = useMemo(() => {
    return Math.max(...timelineData.map((d) => d.count), 1)
  }, [timelineData])
  
  const handleBarClick = (time: number) => {
    setSelectedTime(time)
    
    const bucketEntries = entries.filter(
      (e) =>
        e.timestamp >= time &&
        e.timestamp < time + bucketSizeMap[bucketSize]
    )
    
    if (bucketEntries.length > 0) {
      onEntryClick(bucketEntries[0].id)
    }
  }
  
  const formatTimeLabel = (timestamp: number) => {
    const date = new Date(timestamp)
    
    if (bucketSize === '1h') {
      return `${date.getHours()}:00`
    }
    if (bucketSize === '10m' || bucketSize === '1m') {
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  }
  
  const getBarColor = (levels: Record<LogLevel, number>) => {
    if (levels.fatal > 0) return 'bg-red-800'
    if (levels.error > 0) return 'bg-red-500'
    if (levels.warn > 0) return 'bg-amber-500'
    if (levels.info > 0) return 'bg-blue-500'
    return 'bg-gray-400'
  }
  
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        暂无数据
      </div>
    )
  }
  
  const stats = {
    maxPerBucket: maxCount,
    totalBuckets: timelineData.length,
    peakTime: timelineData.reduce((max, d) => (d.count > max.count ? d : max), timelineData[0]),
  }
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          时间粒度
        </span>
        <select
          value={bucketSize}
          onChange={(e) => setBucketSize(e.target.value as BucketSize)}
          className="input-field text-sm w-auto"
        >
          <option value="1s">1 秒</option>
          <option value="10s">10 秒</option>
          <option value="1m">1 分钟</option>
          <option value="10m">10 分钟</option>
          <option value="1h">1 小时</option>
        </select>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          日志数量随时间分布
        </div>
        <div className="relative h-48 bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto">
          <div className="flex items-end h-full gap-px min-w-full">
            {timelineData.map((data, index) => {
              const height = (data.count / maxCount) * 100
              const isSelected = selectedTime === data.time
              
              return (
                <div
                  key={data.time}
                  className="flex-1 min-w-[2px] relative group cursor-pointer"
                  onClick={() => handleBarClick(data.time)}
                  title={`${formatTimeLabel(data.time)} - ${data.count} 条`}
                >
                  <div
                    className={`w-full ${getBarColor(data.levels)} rounded-t transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              )
            })}
          </div>
          
          {timelineData.length > 0 && (
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{formatTimeLabel(timelineData[0].time)}</span>
              <span>
                {formatTimeLabel(timelineData[timelineData.length - 1].time)}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="card p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">峰值数量</div>
          <div className="font-semibold text-gray-800 dark:text-white">
            {stats.maxPerBucket} 条
          </div>
        </div>
        <div className="card p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">时间桶数</div>
          <div className="font-semibold text-gray-800 dark:text-white">
            {stats.totalBuckets}
          </div>
        </div>
      </div>
      
      <div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          图例
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-800"></span>
            <span className="text-gray-600 dark:text-gray-400">FATAL</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500"></span>
            <span className="text-gray-600 dark:text-gray-400">ERROR</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500"></span>
            <span className="text-gray-600 dark:text-gray-400">WARN</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500"></span>
            <span className="text-gray-600 dark:text-gray-400">INFO</span>
          </div>
        </div>
      </div>
    </div>
  )
}
