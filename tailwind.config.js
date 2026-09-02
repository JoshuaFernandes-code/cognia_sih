/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // High-contrast primary backgrounds and surfaces
        surface: {
          light: '#F8FAFC',   // Crisp, glare-free background
          card: '#FFFFFF',    // High-clarity elevated card surface
          dark: '#0F172A',    // Deep slate high-contrast dark background
          darkCard: '#1E293B' // Contrast card in dark mode
        },
        // Ultra-legible text colors (WCAG AAA compliant)
        content: {
          primary: '#0F172A',   // Near-black slate (Contrast > 12:1 on light)
          secondary: '#334155', // High legibility secondary text
          inverse: '#FFFFFF',   // Pure white for dark containers
          muted: '#475569',
        },
        // Accessible action colors (Non-jarring, distinct hues)
        accessible: {
          blue: '#1D4ED8',      // Action buttons / primary links
          blueHover: '#1E40AF',
          green: '#15803D',     // Affirmative / Success states
          greenHover: '#166534',
          amber: '#B45309',     // Gentle guidance / alerts (no alarmist reds)
          red: '#B91C1C',       // Clear stop / error actions
          focusRing: '#2563EB', // High-visibility 4px focus outline
        },
      },
      fontSize: {
        // Senior-friendly enlarged typography scale
        'accessible-sm': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '500' }],  // 18px base
        'accessible-base': ['1.25rem', { lineHeight: '1.875rem', fontWeight: '500' }], // 20px
        'accessible-lg': ['1.5rem', { lineHeight: '2.125rem', fontWeight: '600' }],   // 24px
        'accessible-xl': ['1.875rem', { lineHeight: '2.5rem', fontWeight: '700' }],    // 30px
        'accessible-2xl': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],   // 36px
        'accessible-3xl': ['3rem', { lineHeight: '1.2', fontWeight: '800' }],          // 48px
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
      minHeight: {
        'touch': '56px', // Standard elderly accessible touch target height
        'touch-lg': '64px',
      },
      minWidth: {
        'touch': '56px',
        'touch-lg': '64px',
      },
    },
  },
  plugins: [],
};
