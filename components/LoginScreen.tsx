'use client'

import { useState } from 'react'
import { Brain, LineChart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LoginScreenProps {
  role: 'patient' | 'caregiver'
  onLogin: (profile: { id: string; full_name: string; email: string }) => void
}

export default function LoginScreen({ role, onLogin }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (isSignUp && !fullName.trim()) {
      setError('Please enter your full name.')
      return
    }

    setLoading(true)
    const cleanEmail = email.trim().toLowerCase()

    if (isSignUp) {
      // 1. Sign Up Logic
      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert({
          email: cleanEmail,
          full_name: fullName.trim(),
          role: role
        })
        .select('id, full_name, email')
        .single()

      if (insertError) {
        if (insertError.code === '23505') { // unique violation
          setError(`An account with this email already exists for ${role}. Please log in instead.`)
        } else {
          setError('Failed to create account. Please try again.')
          console.error(insertError)
        }
      } else if (data) {
        onLogin(data as any)
      }
    } else {
      // 2. Login Logic
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', role)
        .eq('email', cleanEmail)
        .single()

      if (dbError || !data) {
        setError(`No ${role} account found with this email. Please sign up first.`)
      } else {
        onLogin(data as any)
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: 'var(--color-surface-light)'
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface-card)',
        padding: '2.5rem',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 6px rgb(0 0 0 / 0.05)',
        width: '100%',
        maxWidth: '28rem',
        textAlign: 'center'
      }}>
        <div
          aria-hidden="true"
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            backgroundColor: role === 'patient' ? '#DBEAFE' : '#EDE9FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1.5rem'
          }}
        >
          {role === 'patient' ? <Brain size={32} className="text-blue-600" /> : <LineChart size={32} className="text-purple-600" />}
        </div>
        
        <h1 style={{
          fontSize: 'var(--font-size-accessible-xl)',
          fontWeight: 800,
          color: 'var(--color-content-primary)',
          marginBottom: '0.5rem'
        }}>
          {role === 'patient' ? 'Patient Portal' : 'Caregiver Portal'}
        </h1>
        <p style={{ color: 'var(--color-content-muted)', marginBottom: '2rem' }}>
          {isSignUp ? 'Create a new account.' : 'Enter your email to access your account.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isSignUp && (
            <div>
              <label htmlFor="fullName" className="sr-only">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: '2px solid #E2E8F0',
                  fontSize: 'var(--font-size-accessible-base)',
                  color: 'var(--color-content-primary)',
                  outline: 'none',
                }}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="sr-only">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '2px solid #E2E8F0',
                fontSize: 'var(--font-size-accessible-base)',
                color: 'var(--color-content-primary)',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--color-accessible-red)',
              fontSize: 'var(--font-size-accessible-sm)',
              margin: 0,
              fontWeight: 600
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--color-accessible-blue)',
              color: '#ffffff',
              fontSize: 'var(--font-size-accessible-lg)',
              fontWeight: 700,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        {role === 'caregiver' && (
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            style={{
              marginTop: '1.5rem',
              background: 'none',
              border: 'none',
              color: 'var(--color-accessible-blue)',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        )}
      </div>
    </div>
  )
}
