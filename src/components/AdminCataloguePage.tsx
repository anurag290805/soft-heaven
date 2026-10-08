import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { StorefrontImage } from './StorefrontImage'
import type { ProductRecord, ProductVariant } from './storefront.types'
import { catalogueCollections, catalogueProducts, getProductPublicationIssues } from '../data/catalogue'
import { clearCatalogueOverrides, writeCatalogueOverrides } from '../state/catalogueAdmin'
import './AdminCataloguePage.css'

interface NewVariantDraft {
  name: string
  colour: string
  swatch: string
  file?: File
}

function readImageAsPhoto(file: File, alt: string): Promise<ProductVariant['photo']> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      const image = new Image()
      image.onerror = () => reject(new Error('The uploaded file is not a readable image.'))
      image.onload = () => resolve({ src, alt, width: image.naturalWidth, height: image.naturalHeight, fit: 'contain' })
      image.src = src
    }
    reader.readAsDataURL(file)
  })
}

function makeDraftProduct(index: number): ProductRecord {
  return {
    id: `product-draft-${Date.now()}`,
    slug: `new-crochet-product-${index}`,
    name: 'New crochet product',
    type: 'Keychain',
    shortDescription: 'Draft product awaiting owner-approved details.',
    collectionSlug: 'keychains-keepsakes',
    variant: 'keychain',
    publicationStatus: 'draft',
    availability: 'not-orderable',
  }
}

export function AdminCataloguePage() {
  const [products, setProducts] = useState<ProductRecord[]>(() => catalogueProducts.map((product) => ({ ...product })))
  const [selectedSlug, setSelectedSlug] = useState(catalogueProducts[0]?.slug ?? '')
  const [newVariant, setNewVariant] = useState<NewVariantDraft>({ name: '', colour: '', swatch: '#d8cbc1' })
  const [feedback, setFeedback] = useState<string | null>(null)

  const selectedProduct = products.find((product) => product.slug === selectedSlug) ?? products[0]
  const issues = useMemo(() => selectedProduct ? getProductPublicationIssues(selectedProduct, products) : [], [products, selectedProduct])

  const updateSelected = (patch: Partial<ProductRecord>) => {
    if (!selectedProduct) return
    setProducts((current) => current.map((product) => product.slug === selectedProduct.slug ? { ...product, ...patch } as ProductRecord : product))
  }

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    if (!selectedProduct?.variants) return
    const variants = selectedProduct.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant)
    updateSelected({ variants, photo: variants[0]?.photo ?? selectedProduct.photo })
  }

  const removeVariant = (index: number) => {
    if (!selectedProduct?.variants) return
    const variants = selectedProduct.variants.filter((_, variantIndex) => variantIndex !== index)
    updateSelected({ variants: variants.length ? variants : undefined, photo: variants[0]?.photo ?? selectedProduct.photo })
  }

  const uploadVariantImage = async (index: number, file?: File) => {
    if (!file || !selectedProduct?.variants) return
    try {
      const variant = selectedProduct.variants[index]
      const uploadedPhoto = await readImageAsPhoto(file, `${selectedProduct.name}, ${variant.colour} colour variant`)
      updateVariant(index, { photo: uploadedPhoto })
      setFeedback('Genuine variant photograph added to this draft.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The image could not be added.')
    }
  }

  const uploadGalleryImages = async (files: FileList | null, index?: number) => {
    if (!files?.length || !selectedProduct) return
    try {
      const uploadedPhotos = await Promise.all([...files].map((file) => readImageAsPhoto(file, `${selectedProduct.name} genuine gallery photograph`)))
      if (index !== undefined && selectedProduct.variants) {
        const variant = selectedProduct.variants[index]
        updateVariant(index, { gallery: [...(variant.gallery ?? []), ...uploadedPhotos] })
      } else {
        updateSelected({ gallery: [...(selectedProduct.gallery ?? []), ...uploadedPhotos] })
      }
      setFeedback(`${uploadedPhotos.length} genuine gallery ${uploadedPhotos.length === 1 ? 'image' : 'images'} added.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The gallery images could not be added.')
    }
  }

  const addVariant = async () => {
    if (!selectedProduct || !newVariant.name.trim() || !newVariant.colour.trim() || !newVariant.file) {
      setFeedback('Add a colour name and its genuine photograph before saving the variant.')
      return
    }
    try {
      const uploadedPhoto = await readImageAsPhoto(newVariant.file, `${selectedProduct.name}, ${newVariant.colour.trim()} colour variant`)
      const addedVariant: ProductVariant = {
        id: newVariant.colour.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: newVariant.name.trim(),
        colour: newVariant.colour.trim(),
        photo: uploadedPhoto,
        swatch: newVariant.swatch,
        availability: 'not-orderable',
        orderability: false,
      }
      const variants = [...(selectedProduct.variants ?? []), addedVariant]
      updateSelected({ variants, photo: selectedProduct.photo ?? uploadedPhoto })
      setNewVariant({ name: '', colour: '', swatch: '#d8cbc1' })
      setFeedback('Colour variant added. Save the catalogue when ready.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The image could not be added.')
    }
  }

  const save = () => {
    writeCatalogueOverrides(products)
    setFeedback('Catalogue saved in this browser. Refreshing the storefront…')
    window.setTimeout(() => window.location.reload(), 500)
  }

  const createDraft = () => {
    const draft = makeDraftProduct(products.length + 1)
    setProducts((current) => [...current, draft])
    setSelectedSlug(draft.slug)
    setFeedback('Draft product created. Add its approved details and genuine photograph before publishing.')
  }

  const deleteSelected = () => {
    if (!selectedProduct) return
    const next = products.filter((product) => product.slug !== selectedProduct.slug)
    setProducts(next)
    setSelectedSlug(next[0]?.slug ?? '')
    setFeedback('Product removed from this local catalogue draft. Save to keep the change.')
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <BrandMark href="/" />
        <div className="admin-header__title"><span>Soft Heaven</span><strong>Catalogue studio</strong></div>
        <a className="admin-header__back" href="/"><ArrowLeft aria-hidden="true" size={15} /> Storefront</a>
      </header>
      <main className="admin-layout" id="main-content">
        <aside className="admin-sidebar" aria-label="Catalogue products">
          <div className="admin-sidebar__top">
            <div><span className="admin-kicker">Owner workspace</span><h1>Catalogue</h1></div>
            <button className="admin-icon-button" type="button" onClick={createDraft} aria-label="Create a draft product" title="Create draft product"><Plus aria-hidden="true" size={18} /></button>
          </div>
          <p>Browser-local draft studio. These edits do not publish to Supabase or change checkout prices. Publish approved records separately to the server catalogue.</p>
          <nav className="admin-product-list" aria-label="Select a product">
            {products.map((product) => (
              <button className={product.slug === selectedProduct?.slug ? 'admin-product-list__item admin-product-list__item--selected' : 'admin-product-list__item'} type="button" key={product.id} onClick={() => setSelectedSlug(product.slug)}>
                <span>{product.name}</span><small>{product.publicationStatus}</small>
              </button>
            ))}
          </nav>
        </aside>

        {selectedProduct ? (
          <section className="admin-editor" aria-labelledby="admin-editor-title">
            <div className="admin-editor__topline"><span className="admin-kicker">Product family</span><button className="admin-danger-link" type="button" onClick={deleteSelected}><Trash2 aria-hidden="true" size={14} /> Delete draft</button></div>
            <h2 id="admin-editor-title">{selectedProduct.name}</h2>
            <p className="admin-editor__intro">The storefront only publishes complete records. A variant cannot be added without a genuine uploaded image.</p>

            <div className="admin-form-grid">
              <label>Customer-facing name<input value={selectedProduct.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
              <label>Slug<input value={selectedProduct.slug} onChange={(event) => updateSelected({ slug: event.target.value })} /></label>
              <label>Product type<input value={selectedProduct.type} onChange={(event) => updateSelected({ type: event.target.value })} /></label>
              <label>Collection<select value={selectedProduct.collectionSlug} onChange={(event) => updateSelected({ collectionSlug: event.target.value })}>{catalogueCollections.map((collection) => <option value={collection.slug} key={collection.slug}>{collection.name}</option>)}</select></label>
              <label className="admin-form-grid__wide">Short description<textarea value={selectedProduct.shortDescription} onChange={(event) => updateSelected({ shortDescription: event.target.value })} /></label>
              <label>Publication<select value={selectedProduct.publicationStatus} onChange={(event) => updateSelected({ publicationStatus: event.target.value as ProductRecord['publicationStatus'] })}><option value="draft">Draft</option><option value="published">Published</option><option value="development-fixture">Development fixture</option></select></label>
              <label>Availability<select value={selectedProduct.availability} onChange={(event) => updateSelected({ availability: event.target.value as ProductRecord['availability'] })}><option value="not-orderable">Enquiry only</option><option value="available">Available</option><option value="ready-to-ship">Ready to ship</option><option value="made-to-order">Made to order</option><option value="custom-request">Custom request</option><option value="temporarily-unavailable">Temporarily unavailable</option></select></label>
              <label>Price (INR)<input type="number" min="0" value={selectedProduct.price?.amount ?? ''} onChange={(event) => updateSelected({ price: event.target.value ? { amount: Number(event.target.value), currency: 'INR' } : undefined, priceStatus: event.target.value ? (selectedProduct.priceStatus ?? 'illustrative') : undefined })} /></label>
              <label>Price status<select value={selectedProduct.priceStatus ?? 'illustrative'} onChange={(event) => updateSelected({ priceStatus: event.target.value as ProductRecord['priceStatus'] })}><option value="illustrative">Illustrative</option><option value="owner-confirmed">Owner confirmed</option></select></label>
              <label className="admin-check"><input type="checkbox" checked={selectedProduct.orderability === true} onChange={(event) => updateSelected({ orderability: event.target.checked })} /> Owner-confirmed orderability</label>
            </div>

            <div className="admin-section-heading"><div><span className="admin-kicker">Genuine photography</span><h3>Colour variants</h3></div><span>{selectedProduct.variants?.length ?? 0} configured</span></div>
            <label className="admin-upload admin-gallery-upload"><ImagePlus aria-hidden="true" size={15} /> Add product gallery images<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void uploadGalleryImages(event.target.files)} /></label>
            <div className="admin-variant-list">
              {(selectedProduct.variants ?? []).map((variant, index) => (
                <article className="admin-variant" key={variant.id}>
                  <div className="admin-variant__image"><StorefrontImage kind="product" photo={variant.photo} placeholder={{ variant: selectedProduct.variant, label: `${variant.colour} variant` }} /></div>
                  <div className="admin-variant__fields">
                    <label>Variant name<input value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} /></label>
                    <label>Colour<input value={variant.colour} onChange={(event) => updateVariant(index, { colour: event.target.value })} /></label>
                    <label>Swatch<input type="color" value={variant.swatch ?? '#d8cbc1'} onChange={(event) => updateVariant(index, { swatch: event.target.value })} /></label>
                    <label>Variant availability<select value={variant.availability ?? selectedProduct.availability} onChange={(event) => updateVariant(index, { availability: event.target.value as ProductVariant['availability'] })}><option value="not-orderable">Enquiry only</option><option value="available">Available</option><option value="ready-to-ship">Ready to ship</option><option value="made-to-order">Made to order</option><option value="custom-request">Custom request</option><option value="temporarily-unavailable">Temporarily unavailable</option></select></label>
                    <label className="admin-check"><input type="checkbox" checked={variant.orderability === true} onChange={(event) => updateVariant(index, { orderability: event.target.checked })} /> Variant orderability confirmed</label>
                    <label className="admin-upload"><ImagePlus aria-hidden="true" size={15} /> Replace genuine photograph<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadVariantImage(index, event.target.files?.[0])} /></label>
                    <label className="admin-upload"><ImagePlus aria-hidden="true" size={15} /> Add genuine gallery images<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void uploadGalleryImages(event.target.files, index)} /></label>
                    <div className="admin-variant__actions"><span>{variant.photo.width} × {variant.photo.height}px</span><button className="admin-danger-link" type="button" onClick={() => removeVariant(index)}><Trash2 aria-hidden="true" size={14} /> Remove colour</button></div>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-add-variant">
              <div><span className="admin-kicker">Add colour</span><h3>New genuine variant</h3></div>
              <div className="admin-add-variant__fields"><label>Variant name<input value={newVariant.name} placeholder="For example, Blush Pink" onChange={(event) => setNewVariant((current) => ({ ...current, name: event.target.value }))} /></label><label>Colour<input value={newVariant.colour} placeholder="For example, Blush Pink" onChange={(event) => setNewVariant((current) => ({ ...current, colour: event.target.value }))} /></label><label>Swatch<input type="color" value={newVariant.swatch} onChange={(event) => setNewVariant((current) => ({ ...current, swatch: event.target.value }))} /></label><label className="admin-upload"><ImagePlus aria-hidden="true" size={15} /> Choose genuine photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setNewVariant((current) => ({ ...current, file: event.target.files?.[0] }))} /></label><button className="admin-secondary-button" type="button" onClick={() => void addVariant()}><Plus aria-hidden="true" size={15} /> Add colour</button></div>
            </div>

            <div className="admin-save-bar"><div>{feedback && <p role="status"><Check aria-hidden="true" size={15} /> {feedback}</p>}</div><button className="button button--dark" type="button" onClick={save}><Save aria-hidden="true" size={16} /> Save catalogue</button><button className="admin-reset-link" type="button" onClick={() => { clearCatalogueOverrides(); window.location.reload() }}>Reset local edits</button></div>
            {issues.length > 0 && <div className="admin-issues" role="status"><strong>Publication checklist</strong><p>This record stays enquiry-only until each issue is resolved.</p><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
          </section>
        ) : <div className="admin-empty">Create a draft product to begin.</div>}
      </main>
    </div>
  )
}
