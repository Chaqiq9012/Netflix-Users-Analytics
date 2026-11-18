/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#123D29',
        deep: '#0B2F20',
        sage: '#68A77C',
        mint: '#E4EBD2',
        cream: '#FBF5E9',
        card: '#FFFDF7',
        accent: '#EF7000',
        ink: '#17251D',
        muted: '#72766D',
        line: '#E8E0D1',
        danger: '#D94B36'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23,37,29,0.04), 0 6px 20px -8px rgba(23,37,29,0.10)',
        lift: '0 10px 40px -12px rgba(11,47,32,0.35)'
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop': { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'toast': { '0%': { transform: 'translateY(-12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }
      },
      animation: {
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .2s ease-out',
        pop: 'pop .22s ease-out',
        toast: 'toast .25s ease-out'
      }
    }
  },
  plugins: []
};
