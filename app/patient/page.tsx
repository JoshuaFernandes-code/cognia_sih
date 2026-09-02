'use client'

import { useState, useEffect } from 'react'
import LoginScreen from '@/components/LoginScreen'
import DailySessionScreen from '@/components/DailySessionScreen'
import StreakBanner from '@/components/StreakBanner'
import { fetchPatientHistory, fetchPatientPreferences } from '@/lib/db'
import Header from '@/components/Header'

export default function PatientPage() {
  const [patient, setPatient] = useState<{ id: string; full_name: string; email: string } | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [preferences, setPreferences] = useState<any>(null)

  useEffect(() => {
    // Check localStorage on mount
    const saved = localStorage.getItem('care_companion_patient')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPatient(parsed)
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (patient) {
      fetchPatientHistory(patient.id).then((history) => {
        setSessions(history as any)
      })
      fetchPatientPreferences(patient.id).then((prefs) => {
        setPreferences(prefs)
      })
    }
  }, [patient])

  function handleLogin(profile: { id: string; full_name: string; email: string }) {
    setPatient(profile)
    localStorage.setItem('care_companion_patient', JSON.stringify(profile))
    
    // Sync logic: Only one email can be logged in across the app.
    const savedCaregiver = localStorage.getItem('care_companion_caregiver')
    if (savedCaregiver) {
      try {
        const parsed = JSON.parse(savedCaregiver)
        if (parsed.email !== profile.email) {
          const isTest = parsed.email.includes('@test.com') || profile.email.includes('@test.com')
          if (!isTest) {
            localStorage.removeItem('care_companion_caregiver')
          }
        }
      } catch (e) {}
    }
  }

  function handleLogout() {
    setPatient(null)
    setSessions([])
    localStorage.removeItem('care_companion_patient')
  }

  if (!patient) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 flex flex-col">
        <LoginScreen role="patient" onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <>
      <Header 
        userName={patient.full_name}
        userEmail={patient.email}
        roleTitle="Patient Portal"
        onLogout={handleLogout}
        showSwitchToCaregiver={true}
      />
      
      <StreakBanner patientId={patient.id} />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 flex flex-col">
        {preferences !== null && (
          <DailySessionScreen
            patientId={patient.id}
            patientName={patient.full_name}
            patientHistory={sessions}
            preferences={preferences}
            onSessionComplete={() => {
              window.location.reload()
            }}
          />
        )}
      </div>
    </>
  )
}
