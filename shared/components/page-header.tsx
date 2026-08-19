'use client'

export function PageHeader({ title }: { title: string }) {
  return (
    <header>
      <h1 className="sr-only">{title}</h1>
    </header>
  )
}
