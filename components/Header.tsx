'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

interface HeaderProps {
  userName?: string;
  userEmail?: string;
  roleTitle?: string;
  onLogout?: () => void;
  showSwitchToPatient?: boolean;
  showSwitchToCaregiver?: boolean;
  patients?: any[];
  onSwitchToPatient?: (patient: any) => void;
}

export default function Header({ 
  userName, 
  userEmail,
  roleTitle, 
  onLogout, 
  showSwitchToPatient, 
  showSwitchToCaregiver,
  patients,
  onSwitchToPatient
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <header className="w-full sticky top-0 z-50 border-b-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 shadow-sm" role="banner">
      <div className="w-full flex items-center justify-between flex-wrap gap-4">
        {/* Left: Brand & User Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/dementia-webapp-logo.png" 
              alt="Care Companion Logo" 
              className="w-10 h-10 object-contain shrink-0"
            />
            <div>
               <h1 className="text-accessible-lg font-bold tracking-tight text-content-primary m-0 leading-tight">
                 Care Companion
               </h1>
               {userName && (
                 <p className="text-sm text-slate-500 m-0 leading-tight mt-1 font-medium">
                   {userName} {userEmail ? `(${userEmail})` : ''} &mdash; {roleTitle}
                 </p>
               )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          {showSwitchToPatient && (
            <div className="relative" ref={dropdownRef}>
              {patients && patients.length > 0 ? (
                <>
                  <button 
                    title="Switch to Patient Portal"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-3 h-10 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors border border-blue-200 dark:border-slate-700 font-bold text-sm"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                    <span>Patient</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="py-2">
                        <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">
                          Select a Patient
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {patients.map((p, idx) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setDropdownOpen(false);
                                if (onSwitchToPatient) onSwitchToPatient(p);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.full_name}</div>
                                <div className="text-xs text-slate-500">{p.email}</div>
                              </div>
                              {idx === 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Recent</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link href="/patient" style={{ textDecoration: 'none' }}>
                  <button 
                    title="Switch to Patient Portal"
                    className="flex items-center gap-2 px-3 h-10 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors border border-blue-200 dark:border-slate-700 font-bold text-sm"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                    <span>Patient</span>
                  </button>
                </Link>
              )}
            </div>
          )}
          
          {showSwitchToCaregiver && (
            <Link href="/caregiver" style={{ textDecoration: 'none' }}>
              <button 
                title="Switch to Caregiver Portal"
                className="flex items-center gap-2 px-3 h-10 rounded-full bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-slate-700 transition-colors border border-purple-200 dark:border-slate-700 font-bold text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                <span>Caregiver</span>
              </button>
            </Link>
          )}

          {onLogout && (!userEmail || !userEmail.includes('@test.com')) && (
            <button 
              onClick={onLogout}
              title="Log Out"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
