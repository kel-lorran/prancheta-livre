import JSZip from 'jszip'
import type { ImageGroup, ProjectInfo, Sheet, SheetImage } from '../types'
import { blobToDataUrl, dataUrlToBlob } from './blobUtils'

const MANIFEST_VERSION = 2

interface ManifestImage extends Omit<SheetImage, 'href'> {
  file: string
}
type ManifestGroup = Omit<ImageGroup, 'images'> & { images: ManifestImage[] }
type ManifestSheet = Omit<Sheet, 'groups'> & { groups: ManifestGroup[] }
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
    sheets.map(async (s) => ({
      ...s,
      groups: await Promise.all(
        s.groups.map(async (g) => ({
          ...g,
          images: await Promise.all(
            g.images.map(async (im) => {
              const blob = await dataUrlToBlob(im.href)
              const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
              const file = `images/${im.id}.${ext}`
              zip.file(file, blob)
              const { href: _href, ...rest } = im
              return { ...rest, file }
            }),
          ),
        })),
      ),
    })),
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
    manifest.sheets.map(async (s) => ({
      ...s,
      groups: await Promise.all(
        s.groups.map(async (g) => ({
          ...g,
          images: (
            await Promise.all(
              g.images.map(async (im) => {
                const entry = zip.file(im.file)
                if (!entry) return null
                const rawBlob = await entry.async('blob')
                // JSZip não preserva o Content-Type original do arquivo — o blob sai como
                // "application/octet-stream" genérico. O navegador tolera isso ao renderizar
                // <image> (fareja os bytes), mas o svg2pdf.js valida o prefixo MIME da data URL
                // antes de tentar embutir a imagem no PDF e rejeita com "Unsupported image URL".
                // Força o tipo certo pela extensão gravada na exportação (ver exportProjectZip).
                const mime = im.file.toLowerCase().endsWith('.jpg') || im.file.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
                const blob = new Blob([rawBlob], { type: mime })
                const href = await blobToDataUrl(blob)
                const { file: _file, ...rest } = im
                return { ...rest, href } as SheetImage
              }),
            )
          ).filter((im): im is SheetImage => im != null),
        })),
      ),
    })),
  ) as unknown as Sheet[]
  return { sheets, project: manifest.project }
}
