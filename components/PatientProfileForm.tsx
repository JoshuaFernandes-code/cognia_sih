'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PatientProfileFormProps {
  patientId: string
  onSave?: () => void
}

export default function PatientProfileForm({ patientId, onSave }: PatientProfileFormProps) {
  const [foods, setFoods] = useState('')
  const [hobbies, setHobbies] = useState('')
  const [region, setRegion] = useState('')
  const [routine, setRoutine] = useState('')
  const [dailyTask, setDailyTask] = useState('')
  
  // New Fields for Memory Recall
  const [address, setAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [familyMembers, setFamilyMembers] = useState('')

  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [initialState, setInitialState] = useState('')

  const currentStateString = JSON.stringify({
    foods,
    hobbies,
    region,
    routine,
    dailyTask,
    address,
    phoneNumber,
    familyMembers
  })
  
  const hasChanges = currentStateString !== initialState

  useEffect(() => {
    async function loadPreferences() {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', patientId)
        .single()

      if (!error && data?.preferences) {
        const p = data.preferences
        const loadedFoods = Array.isArray(p.favorite_foods) ? p.favorite_foods.join(', ') : ''
        const loadedHobbies = Array.isArray(p.hobbies) ? p.hobbies.join(', ') : ''
        const loadedRegion = p.cultural_region || ''
        const loadedDailyTask = p.caregiver_daily_task || ''
        const loadedAddress = p.address || ''
        const loadedPhoneNumber = p.phone_number || ''
        let loadedFamily = ''
        let loadedRoutine = ''

        if (p.family_members && Array.isArray(p.family_members)) {
          loadedFamily = p.family_members.map((fm: any) => `${fm.relation}: ${fm.name}`).join('\n')
        }
        
        if (p.daily_routine) {
          if (typeof p.daily_routine === 'string') {
            loadedRoutine = p.daily_routine
          } else {
            loadedRoutine = Object.entries(p.daily_routine).map(([k, v]) => `${k}: ${v}`).join('\n')
          }
        }

        setFoods(loadedFoods)
        setHobbies(loadedHobbies)
        setRegion(loadedRegion)
        setDailyTask(loadedDailyTask)
        setAddress(loadedAddress)
        setPhoneNumber(loadedPhoneNumber)
        setFamilyMembers(loadedFamily)
        setRoutine(loadedRoutine)

        setInitialState(JSON.stringify({
          foods: loadedFoods,
          hobbies: loadedHobbies,
          region: loadedRegion,
          routine: loadedRoutine,
          dailyTask: loadedDailyTask,
          address: loadedAddress,
          phoneNumber: loadedPhoneNumber,
          familyMembers: loadedFamily
        }))
      }
      setLoading(false)
    }
    loadPreferences()
  }, [patientId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveStatus('saving')
    setErrorMessage('')

    const foodArray = foods.split(',').map(f => f.trim()).filter(Boolean)
    const hobbyArray = hobbies.split(',').map(h => h.trim()).filter(Boolean)
    
    // Parse routine string into an object if possible, else keep as string
    let routineObj: any = routine
    try {
      const lines = routine.split('\n').filter(Boolean)
      if (lines.length > 0 && lines.some(l => l.includes(':'))) {
        routineObj = {}
        lines.forEach(l => {
          const [k, ...v] = l.split(':')
          if (k && v.length) {
            routineObj[k.trim()] = v.join(':').trim()
          }
        })
      }
    } catch (err) {}

    // Parse family members string to array of objects
    const familyArray: {relation: string, name: string}[] = []
    try {
      const lines = familyMembers.split('\n').filter(Boolean)
      lines.forEach(l => {
        const [rel, ...nm] = l.split(':')
        if (rel && nm.length) {
          familyArray.push({ relation: rel.trim(), name: nm.join(':').trim() })
        }
      })
    } catch (err) {}

    const preferences = {
      favorite_foods: foodArray,
      hobbies: hobbyArray,
      cultural_region: region.trim(),
      daily_routine: routineObj,
      caregiver_daily_task: dailyTask.trim(),
      address: address.trim(),
      phone_number: phoneNumber.trim(),
      family_members: familyArray
    }

    try {
      const { updatePatientStreak } = await import('@/lib/db') // We don't use this here
      const { error } = await supabase
        .from('profiles')
        .update({ preferences })
        .eq('id', patientId)

      if (error) throw error
      
      setSaveStatus('saved')
      setInitialState(currentStateString)
      if (onSave) onSave()
      
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: any) {
      console.error(err)
      setSaveStatus('error')
      setErrorMessage(err.message || 'Failed to save preferences')
    }
  }

  if (loading) {
    return <div className="p-4 text-slate-500">Loading personalization profile...</div>
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">✨</span>
          AI Personalization Profile
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Fill out these details to help our AI generate highly personalized cognitive exercises matching the patient's lived experience.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="region" className="block text-sm font-bold text-slate-700 mb-1">
            Cultural & Geographic Region
          </label>
          <input
            id="region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g., Assam, Meghalaya, Scotland, etc."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
          />
        </div>

        <div>
          <label htmlFor="foods" className="block text-sm font-bold text-slate-700 mb-1">
            Favorite Foods (comma separated)
          </label>
          <input
            id="foods"
            type="text"
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            placeholder="e.g., Assam Tea, Pitha, Masor Tenga"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
          />
        </div>

        <div>
          <label htmlFor="hobbies" className="block text-sm font-bold text-slate-700 mb-1">
            Hobbies & Interests (comma separated)
          </label>
          <input
            id="hobbies"
            type="text"
            value={hobbies}
            onChange={(e) => setHobbies(e.target.value)}
            placeholder="e.g., Gardening, Knitting, Reading"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
          />
        </div>

        <div>
          <label htmlFor="routine" className="block text-sm font-bold text-slate-700 mb-1">
            Daily Routine (key events)
          </label>
          <textarea
            id="routine"
            value={routine}
            onChange={(e) => setRoutine(e.target.value)}
            placeholder="e.g.&#10;Morning: Tea at 8 AM&#10;Evening: Walk in the garden"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
          ></textarea>
        </div>

        <div>
          <label htmlFor="dailyTask" className="block text-sm font-bold text-slate-700 mb-1">
            Caregiver Daily Task Message
          </label>
          <input
            id="dailyTask"
            type="text"
            value={dailyTask}
            onChange={(e) => setDailyTask(e.target.value)}
            placeholder="e.g., Please remind them to water the Tulsi plant today."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
          />
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Vital Details (For Memory Exercises)</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-bold text-slate-700 mb-1">
                Home Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Maple Street, Springville"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 555-0198"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="family" className="block text-sm font-bold text-slate-700 mb-1">
                Family Members (Relation: Name)
              </label>
              <textarea
                id="family"
                value={familyMembers}
                onChange={(e) => setFamilyMembers(e.target.value)}
                placeholder="e.g.&#10;Daughter: Sarah&#10;Son: David"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
              ></textarea>
            </div>
          </div>
        </div>

        {saveStatus === 'error' && (
          <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-200">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saveStatus === 'saving' || !hasChanges}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-sm transition-colors"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Profile'}
          </button>
          
          {saveStatus === 'saved' && (
            <span className="text-green-600 font-bold flex items-center gap-2 animate-in fade-in duration-300">
              <span>✅</span> Saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
