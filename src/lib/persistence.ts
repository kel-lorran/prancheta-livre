import { openDB, type IDBPDatabase } from 'idb'
import type { ImageGroup, ProjectInfo, Sheet, SheetImage } from '../types'
import { blobToDataUrl, dataUrlToBlob } from './blobUtils'

const DB_NAME = 'prancheta-livre'
const STORE = 'project'
const KEY = 'current'

interface StoredImage extends Omit<SheetImage, 'href'> {
  blob: Blob
}
type StoredGroup = Omit<ImageGroup, 'images'> & { images: StoredImage[] }
type StoredSheet = Omit<Sheet, 'groups'> & { groups: StoredGroup[] }
interface StoredProject {
  sheets: StoredSheet[]
  project: ProjectInfo
  savedAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null
function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export async function saveProject(sheets: Sheet[], project: ProjectInfo): Promise<void> {
  const storedSheets: StoredSheet[] = await Promise.all(
    sheets.map(async (s) => ({
      ...s,
      groups: await Promise.all(
        s.groups.map(async (g) => ({
          ...g,
          images: await Promise.all(
            g.images.map(async (im) => {
              const { href, ...rest } = im
              const blob = await dataUrlToBlob(href)
              return { ...rest, blob }
            }),
          ),
        })),
      ),
    })),
  )
  const db = await getDB()
  const record: StoredProject = { sheets: storedSheets, project, savedAt: Date.now() }
  await db.put(STORE, record, KEY)
}

export async function loadPersistedProject(): Promise<{ sheets: Sheet[]; project: ProjectInfo } | null> {
  const db = await getDB()
  const data = (await db.get(STORE, KEY)) as StoredProject | undefined
  if (!data) return null
  const sheets: Sheet[] = await Promise.all(
    data.sheets.map(async (s) => ({
      ...s,
      groups: await Promise.all(
        s.groups.map(async (g) => ({
          ...g,
          images: await Promise.all(
            g.images.map(async (im) => {
              const { blob, ...rest } = im
              const href = await blobToDataUrl(blob)
              return { ...rest, href }
            }),
          ),
        })),
      ),
    })),
  )
  return { sheets, project: data.project }
}

export async function clearPersistedProject(): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, KEY)
}
