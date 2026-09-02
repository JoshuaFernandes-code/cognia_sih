import Link from 'next/link'
import AutoLogin from '@/components/AutoLogin'
import { Brain, LineChart } from 'lucide-react'

export default function Home() {
  return (
    <>
      <AutoLogin />
      <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem',
      backgroundColor: 'var(--color-surface-light)',
      textAlign: 'center'
    }}>
      <img 
        src="/dementia-webapp-logo.png" 
        alt="Care Companion Logo" 
        style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem' }} 
      />
      <h1 style={{
        fontSize: 'var(--font-size-accessible-2xl)',
        fontWeight: 900,
        color: 'var(--color-accessible-blue)',
        marginBottom: '0.5rem'
      }}>
        Care Companion
      </h1>
      <p style={{
        fontSize: 'var(--font-size-accessible-lg)',
        color: 'var(--color-content-secondary)',
        marginBottom: '2rem',
        maxWidth: '35rem',
        lineHeight: 1.4
      }}>
        Welcome to your cognitive dual-task exercise platform. Please select your portal to continue.
      </p>

      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <Link href="/patient" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface-card)',
            borderRadius: '1rem',
            border: '2px solid #DBEAFE',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            transition: 'transform 200ms ease, box-shadow 200ms ease',
            cursor: 'pointer',
            minWidth: '220px'
          }}>
            <Brain size={64} className="mb-4 text-blue-600" />
            <h2 style={{ fontSize: 'var(--font-size-accessible-2xl)', fontWeight: 800, color: 'var(--color-accessible-blue)', margin: 0 }}>Patient</h2>
            <p style={{ fontSize: 'var(--font-size-accessible-base)', color: '#475569', marginTop: '0.5rem' }}>Start your exercises</p>
          </div>
        </Link>

        <Link href="/caregiver" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface-card)',
            borderRadius: '1rem',
            border: '2px solid #EDE9FE',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            transition: 'transform 200ms ease, box-shadow 200ms ease',
            cursor: 'pointer',
            minWidth: '220px'
          }}>
            <LineChart size={64} className="mb-4 text-purple-600" />
            <h2 style={{ fontSize: 'var(--font-size-accessible-2xl)', fontWeight: 800, color: '#5B21B6', margin: 0 }}>Caregiver</h2>
            <p style={{ fontSize: 'var(--font-size-accessible-base)', color: '#475569', marginTop: '0.5rem' }}>View clinical insights</p>
          </div>
        </Link>
      </div>
    </div>
    </>
  )
}
