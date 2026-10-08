import type { ProductRecord } from '../components/storefront.types'

export const CATALOGUE_ADMIN_STORAGE_KEY = 'soft-heaven:catalogue-overrides:v1'

function isProductRecord(value: unknown): value is ProductRecord {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string' && typeof (value as { slug?: unknown }).slug === 'string'
}

export function readCatalogueOverrides(): ProductRecord[] | null {
  if (!import.meta.env.DEV) return null
  try {
    const raw = window.localStorage.getItem(CATALOGUE_ADMIN_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every(isProductRecord) ? parsed : null
  } catch {
    return null
  }
}

export function writeCatalogueOverrides(products: readonly ProductRecord[]): void {
  if (!import.meta.env.DEV) return
  try { window.localStorage.setItem(CATALOGUE_ADMIN_STORAGE_KEY, JSON.stringify(products)) } catch { /* blocked storage should not break the storefront */ }
}

export function clearCatalogueOverrides(): void {
  try { window.localStorage.removeItem(CATALOGUE_ADMIN_STORAGE_KEY) } catch { /* blocked storage should not break the storefront */ }
}
