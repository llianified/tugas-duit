'use client'

export function PageHeader({ title }: { title: string }) {
  return (
    <header>
      <h1 className="sr-only font-display">{title}</h1>
    </header>
  )
}
