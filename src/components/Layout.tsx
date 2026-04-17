import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  )
}
