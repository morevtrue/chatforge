import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  // Пути к файлам с классами Tailwind
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
