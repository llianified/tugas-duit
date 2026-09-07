import { readFile } from 'node:fs/promises'
import path from 'node:path'

const MAINTENANCE_WORKFLOW = path.join(process.cwd(), '.github/workflows/maintenance.yml')

export async function maintenanceCronSchedule(): Promise<string> {
  const source = await readFile(MAINTENANCE_WORKFLOW, 'utf8')
  const schedules = [...source.matchAll(/^\s*- cron:\s*['"]([^'"]+)['"]\s*$/gm)].map(
    (match) => match[1],
  )
  if (schedules.length !== 1) {
    throw new Error(`Workflow maintenance harus punya tepat satu jadwal cron; ditemukan ${schedules.length}.`)
  }
  return schedules[0]
}
