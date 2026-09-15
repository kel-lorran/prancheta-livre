import JSZip from 'jszip'
import type { ProjectInfo, Sheet, SheetImage } from '../types'
import { blobToDataUrl, dataUrlToBlob } from './blobUtils'

const MANIFEST_VERSION = 1

interface ManifestImage extends Omit<SheetImage, 'href'> {
  file: string
}
type ManifestSheet = Omit<Sheet, 'image'> & { image: ManifestImage | null }
interface Manifest {
  version: number
  project: ProjectInfo
  sheets: ManifestSheet[]
}

function slug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'prancheta-livre'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportProjectZip(sheets: Sheet[], project: ProjectInfo): Promise<void> {
  const zip = new JSZip()
  const manifestSheets: ManifestSheet[] = await Promise.all(
    sheets.map(async (s) => {
      if (!s.image) return { ...s, image: null }
      const blob = await dataUrlToBlob(s.image.href)
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
      const file = `images/${s.id}.${ext}`
      zip.file(file, blob)
      const { href: _href, ...rest } = s.image
      return { ...s, image: { ...rest, file } }
    }),
  )
  const manifest: Manifest = { version: MANIFEST_VERSION, project, sheets: manifestSheets }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${slug(project.name)}.zip`)
}

export async function importProjectZip(file: File): Promise<{ sheets: Sheet[]; project: ProjectInfo }> {
  const zip = await JSZip.loadAsync(file)
  const manifestEntry = zip.file('manifest.json')
  if (!manifestEntry) throw new Error('Arquivo inválido: manifest.json não encontrado.')
  const manifest = JSON.parse(await manifestEntry.async('string')) as Manifest
  const sheets: Sheet[] = await Promise.all(
    manifest.sheets.map(async (s) => {
      if (!s.image) return { ...s, image: null } as Sheet
      const entry = zip.file(s.image.file)
      if (!entry) return { ...s, image: null } as Sheet
      const blob = await entry.async('blob')
      const href = await blobToDataUrl(blob)
      const { file: _file, ...rest } = s.image
      return { ...s, image: { ...rest, href } } as Sheet
    }),
  )
  return { sheets, project: manifest.project }
}
