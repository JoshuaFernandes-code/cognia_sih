'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function GlobalLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Force at least 1 second of loading on initial mount
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center animate-out fade-out duration-500 fill-mode-forwards" style={{ animationDelay: '0.8s' }}>
        <div className="relative flex items-center justify-center">
          {/* Rotating ring */}
          <div className="absolute inset-[-1.5rem] rounded-full border-[6px] border-slate-200 dark:border-slate-800 border-t-blue-600 dark:border-t-blue-500 animate-spin" style={{ animationDuration: '1.2s' }}></div>
          
          {/* Logo */}
          <div className="relative w-32 h-32 p-2 flex items-center justify-center">
            <Image 
              src="/dementia-webapp-logo.png" 
              alt="Loading Care Companion" 
              fill 
              style={{ objectFit: 'contain' }} 
              sizes="128px"
              priority
            />
          </div>
        </div>
        <h2 className="mt-12 text-2xl font-black text-slate-700 dark:text-slate-200 animate-pulse tracking-tight">Loading Care Companion...</h2>
      </div>
    )
  }

  return <>{children}</>
}
