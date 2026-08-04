import { useContext } from 'react'
import { ThemeContext } from './ThemeProvider'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme requiere un ThemeProvider por encima')
  return context
}
