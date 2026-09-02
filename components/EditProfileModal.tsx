'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
}

interface EditProfileModalProps {
  profile: Profile
  onClose: () => void
  onSave: (updatedProfile: Profile) => void
}

export default function EditProfileModal({ profile, onClose, onSave }: EditProfileModalProps) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [email, setEmail] = useState(profile.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim()
        })
        .eq('id', profile.id)
        .select('id, full_name, email, role')
        .single()

      if (updateError) throw updateError

      // If RLS returned 0 rows but no error (e.g., if there was no UPDATE policy for this row)
      if (!data) {
        throw new Error('Failed to update profile. Please verify database permissions.')
      }

      onSave(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="bg-blue-600 text-white px-6 py-5">
          <h2 className="text-xl font-bold">Edit Profile</h2>
        </div>
        
        <div className="p-6 sm:p-8 flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
