import { Route, Routes } from 'react-router'
import { ThemeToggle } from '@/components/ThemeToggle'

function Placeholder() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <p className="eyebrow">Train · Perform · Achieve · Repeat</p>
        <ThemeToggle />
      </header>
      <h1 className="display text-4xl">
        TRAIN<span className="text-volt">WAY</span>
      </h1>
      <p className="num text-6xl">4 × 8</p>
    </main>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
    </Routes>
  )
}
