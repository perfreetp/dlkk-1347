import { useEffect } from 'react'
import { useLogStore } from './store/useLogStore'
import Sidebar from './components/Sidebar'
import HomeView from './components/HomeView'
import ImportView from './components/ImportView'
import AnalysisView from './components/AnalysisView'
import ReportView from './components/ReportView'
import CasesView from './components/CasesView'
import SettingsView from './components/SettingsView'

function App() {
  const { viewMode, settings } = useLogStore()
  
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      }
    }
  }, [settings.theme])
  
  const renderView = () => {
    switch (viewMode) {
      case 'home':
        return <HomeView />
      case 'import':
        return <ImportView />
      case 'analysis':
        return <AnalysisView />
      case 'report':
        return <ReportView />
      case 'cases':
        return <CasesView />
      case 'settings':
        return <SettingsView />
      default:
        return <HomeView />
    }
  }
  
  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderView()}
      </main>
    </div>
  )
}

export default App
