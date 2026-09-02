'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AutoLogin() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function performAutoLogin() {
      try {
        const hasCaregiver = localStorage.getItem('care_companion_caregiver')
        const hasPatient = localStorage.getItem('care_companion_patient')

        // If either is missing, we auto-login both for testing
        if (!hasCaregiver || !hasPatient) {
          // Fetch caregiver1
          const { data: caregiver } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', 'caregiver1@test.com')
            .eq('role', 'caregiver')
            .single()

          // Fetch patient1
          const { data: patient } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', 'patient1@test.com')
            .eq('role', 'patient')
            .single()

          if (caregiver) {
            localStorage.setItem('care_companion_caregiver', JSON.stringify(caregiver))
          }
          if (patient) {
            localStorage.setItem('care_companion_patient', JSON.stringify(patient))
            // Set this patient as the most recent patient for the caregiver
            localStorage.setItem('care_companion_recent_patient_id', patient.id)
          }
        }
      } catch (err) {
        console.error('Auto-login failed', err)
      } finally {
        setLoading(false)
      }
    }

    if (process.env.NEXT_PUBLIC_ENABLE_AUTO_LOGIN === 'true') {
      performAutoLogin()
    } else {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Setting up test environment...</p>
      </div>
    )
  }

  return null
}
