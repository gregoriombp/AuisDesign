import type { Note, PageCapture } from "./domain"
let opening: Promise<IDBDatabase> | undefined
function database(): Promise<IDBDatabase> {
  return opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("auis-rewiew", 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("notes")) req.result.createObjectStore("notes", { keyPath: "id" })
      if (!req.result.objectStoreNames.contains("captures")) req.result.createObjectStore("captures", { keyPath: "pageKey" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { opening = undefined; reject(req.error) }
  })
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>, name = "notes"): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const req = run(tx.objectStore(name))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error || req.error)
    tx.onabort = () => reject(tx.error || new Error("Não foi possível salvar. Verifique o espaço disponível."))
  })
}
export const listNotes = () => transaction<Note[]>("readonly", s => s.getAll())
export const getNote = (id: string) => transaction<Note | undefined>("readonly", s => s.get(id))
export const saveNote = (note: Note) => transaction("readwrite", s => s.put(note))
export const deleteNote = (id: string) => transaction("readwrite", s => s.delete(id))
export const getCapture = (key: string) => transaction<PageCapture | undefined>("readonly", s => s.get(key), "captures")
export const saveCapture = (capture: PageCapture) => transaction("readwrite", s => s.put(capture), "captures")
