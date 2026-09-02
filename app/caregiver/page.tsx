'use client'

import { useState, useEffect, useCallback } from 'react'
import LoginScreen from '@/components/LoginScreen'
import CaregiverDashboard from '@/components/CaregiverDashboard'
import ConsentModal from '@/components/ConsentModal'
import PatientProfileForm from '@/components/PatientProfileForm'
import EditProfileModal from '@/components/EditProfileModal'
import { supabase } from '@/lib/supabase'
import { fetchPatientHistory } from '@/lib/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'

export default function CaregiverPage() {
  const router = useRouter()
  const [caregiver, setCaregiver] = useState<{ id: string; full_name: string; email: string } | null>(null)
  
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'info' | 'stats'>('info')

  // Add Patient Form State
  const [isAdding, setIsAdding] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [isSelfPatient, setIsSelfPatient] = useState(false)
  const [addError, setAddError] = useState('')
  const [isAddingLoading, setIsAddingLoading] = useState(false)
  
  // Profile Editing State
  const [editingProfile, setEditingProfile] = useState<{ id: string; full_name: string; email: string; role: string } | null>(null)
  
  function handleProfileSave(updated: any) {
    if (updated.id === caregiver?.id) {
      setCaregiver(updated)
      localStorage.setItem('care_companion_caregiver', JSON.stringify(updated))
    } else {
      // Update patient list
      setPatients(prev => prev.map(p => p.id === updated.id ? updated : p))
      // Also update localStorage if this is the currently active patient
      const savedPatient = localStorage.getItem('care_companion_patient')
      if (savedPatient) {
        try {
          const parsed = JSON.parse(savedPatient)
          if (parsed.id === updated.id) {
            localStorage.setItem('care_companion_patient', JSON.stringify(updated))
          }
        } catch (e) {}
      }
    }
    setEditingProfile(null)
  }

  // Consent State
  const [consentSigned, setConsentSigned] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('care_companion_caregiver')
    if (saved) {
      try {
        setCaregiver(JSON.parse(saved))
      } catch (e) {}
    }
    const consent = localStorage.getItem('care_companion_consent')
    if (consent === 'true') {
      setConsentSigned(true)
    }
  }, [])

  const fetchPatients = useCallback(async () => {
    if (!caregiver) return
    const { data, error } = await supabase
      .from('patient_caregiver_relations')
      .select('last_switched_at, patient:profiles!patient_caregiver_relations_patient_id_fkey(id, full_name, email)')
      .eq('caregiver_id', caregiver.id)
      .order('last_switched_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      let recentLocalId = null;
      if (typeof window !== 'undefined') {
        recentLocalId = localStorage.getItem('care_companion_recent_patient_id');
      }

      const mapped = data.map((d: any) => d.patient)
      
      mapped.sort((a: any, b: any) => {
        if (a.id === recentLocalId) return -1;
        if (b.id === recentLocalId) return 1;
        return 0; // Keep the DB sorting order (last_switched_at desc) for the rest
      })

      setPatients(mapped)
    }
  }, [caregiver])

  useEffect(() => {
    if (caregiver && !selectedPatientId) {
      fetchPatients()
    }
  }, [caregiver, selectedPatientId, fetchPatients])

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientHistory(selectedPatientId).then((history) => {
        setSessions(history as any)
      })
    }
  }, [selectedPatientId])

  function handleLogin(profile: { id: string; full_name: string; email: string }) {
    setCaregiver(profile)
    localStorage.setItem('care_companion_caregiver', JSON.stringify(profile))
    
    // Sync logic: Only one email can be logged in across the app.
    const savedPatient = localStorage.getItem('care_companion_patient')
    if (savedPatient) {
      try {
        const parsed = JSON.parse(savedPatient)
        if (parsed.email !== profile.email) {
          const isTest = parsed.email.includes('@test.com') || profile.email.includes('@test.com')
          if (!isTest) {
            localStorage.removeItem('care_companion_patient')
          }
        }
      } catch (e) {}
    }
  }

  function handleLogout() {
    setCaregiver(null)
    setSelectedPatientId(null)
    localStorage.removeItem('care_companion_caregiver')
  }

  async function handleSwitchToPatient(patient: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('care_companion_recent_patient_id', patient.id)
      localStorage.setItem('care_companion_patient', JSON.stringify(patient))
      
      // Sync logic: Clear caregiver if emails mismatch (except for test accounts)
      if (caregiver && caregiver.email !== patient.email) {
        const isTest = caregiver.email.includes('@test.com') || patient.email.includes('@test.com')
        if (!isTest) {
          localStorage.removeItem('care_companion_caregiver')
        }
      }
    }

    if (caregiver) {
      await supabase
        .from('patient_caregiver_relations')
        .update({ last_switched_at: new Date().toISOString() })
        .eq('caregiver_id', caregiver.id)
        .eq('patient_id', patient.id)
    }

    router.push('/patient')
  }

  function handleAddPatientClick() {
    if (!consentSigned) {
      setShowConsentModal(true)
    } else {
      setIsAdding(!isAdding)
    }
  }

  function handleConsentAccept() {
    localStorage.setItem('care_companion_consent', 'true')
    setConsentSigned(true)
    setShowConsentModal(false)
    setIsAdding(true)
  }

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (!caregiver) return

    const targetEmail = isSelfPatient ? caregiver.email : addEmail.trim()
    const targetName = isSelfPatient ? caregiver.full_name : addName.trim()

    if (!targetEmail) {
      setAddError('Please provide an email.')
      return
    }
    if (!targetName && !isSelfPatient) {
      setAddError('Please provide the patient\'s full name.')
      return
    }

    setIsAddingLoading(true)
    const cleanEmail = targetEmail.toLowerCase()

    try {
      // 1. Find if patient profile exists
      let patientId: string | null = null
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'patient')
        .eq('email', cleanEmail)
        .single()

      if (existing) {
        patientId = existing.id
      } else {
        // Create new patient
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            email: cleanEmail,
            full_name: targetName,
            role: 'patient'
          })
          .select('id')
          .single()

        if (createError) throw createError
        if (created) patientId = created.id
      }

      if (patientId) {
        // 2. Link them
        const { error: linkError } = await supabase
          .from('patient_caregiver_relations')
          .upsert({ patient_id: patientId, caregiver_id: caregiver.id })
        
        if (linkError) throw linkError

        // Success!
        setIsAdding(false)
        setAddEmail('')
        setAddName('')
        setIsSelfPatient(false)
        fetchPatients()
      }
    } catch (err: any) {
      console.error(err)
      setAddError(err.message || 'Failed to add patient.')
    } finally {
      setIsAddingLoading(false)
    }
  }

  if (!caregiver) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 flex flex-col">
        <LoginScreen role="caregiver" onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <>
      {showConsentModal && (
        <ConsentModal 
          onAccept={handleConsentAccept} 
          onDecline={() => setShowConsentModal(false)} 
        />
      )}
      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={handleProfileSave}
        />
      )}
      <Header 
        userName={caregiver.full_name}
        userEmail={caregiver.email}
        roleTitle="Caregiver Portal"
        onLogout={handleLogout}
        showSwitchToPatient={true}
        patients={patients}
        onSwitchToPatient={handleSwitchToPatient}
      />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 flex flex-col">
      {!selectedPatientId ? (
        <div style={{ padding: '1rem', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Your Patients</h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setEditingProfile({ ...caregiver, role: 'caregiver' } as any)}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontWeight: 700, cursor: 'pointer' }}
              >
                Edit My Profile
              </button>
              <button 
                onClick={handleAddPatientClick}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#DBEAFE', color: '#1E40AF', borderRadius: '0.5rem', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                {isAdding ? 'Cancel' : '+ Add Patient'}
              </button>
            </div>
          </div>

          {isAdding && (
            <div className="card-accessible" style={{ backgroundColor: '#F8FAFC', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Add or Link Patient</h2>
              <form onSubmit={handleAddPatient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={isSelfPatient} 
                    onChange={(e) => setIsSelfPatient(e.target.checked)} 
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  I am the patient (create a patient profile under my current email)
                </label>
                
                {!isSelfPatient && (
                  <>
                    <input
                      type="text"
                      placeholder="Patient Full Name"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                    />
                    <input
                      type="email"
                      placeholder="Patient Email Address"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                    />
                  </>
                )}
                
                {addError && <p style={{ color: 'var(--color-accessible-red)', fontWeight: 600, margin: 0 }}>{addError}</p>}
                
                <button 
                  type="submit" 
                  disabled={isAddingLoading}
                  style={{ padding: '0.75rem', backgroundColor: 'var(--color-accessible-blue)', color: '#fff', borderRadius: '0.5rem', border: 'none', fontWeight: 700, cursor: isAddingLoading ? 'not-allowed' : 'pointer', opacity: isAddingLoading ? 0.7 : 1 }}
                >
                  {isAddingLoading ? 'Processing...' : 'Add Patient'}
                </button>
              </form>
            </div>
          )}

          {patients.length === 0 ? (
            <p style={{ color: 'var(--color-content-muted)' }}>You have no linked patients yet. Click "+ Add Patient" to get started.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {patients.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className="card-accessible"
                  style={{ textAlign: 'left', cursor: 'pointer', border: '3px solid #E2E8F0', backgroundColor: '#fff' }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{p.full_name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-content-muted)' }}>{p.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ padding: '0 1.5rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setSelectedPatientId(null)}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', cursor: 'pointer', fontWeight: 600, backgroundColor: '#fff' }}
            >
              ← Back to Patient List
            </button>
            
            {selectedPatientId && (
              <button
                onClick={() => {
                  const p = patients.find(p => p.id === selectedPatientId)
                  if (p) setEditingProfile({ ...p, role: 'patient' })
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontWeight: 700, cursor: 'pointer' }}
              >
                Edit Patient
              </button>
            )}
          </div>
          
          <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
            <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md mx-auto">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${activeTab === 'info' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                Patient Info
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${activeTab === 'stats' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                Statistics
              </button>
            </div>
          </div>
          
          {activeTab === 'info' ? (
            <div className="mb-8 mx-6 animate-in fade-in duration-300">
              <PatientProfileForm patientId={selectedPatientId} />
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              {sessions.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0F172A' }}>No sessions yet</h2>
                  <p>This patient has not completed any cognitive dual-task exercises yet.</p>
                </div>
              ) : (
                <CaregiverDashboard liveSessions={sessions} />
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  )
}
