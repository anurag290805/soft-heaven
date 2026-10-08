import { Sparkles } from 'lucide-react'
import { ButtonLink } from './ButtonLink'

export function NotFoundPageContent() {
  return (
    <main className="collection-page__not-found" id="main-content" aria-labelledby="collection-not-found-title">
      <p className="eyebrow">THIS PAGE ISN'T HERE YET</p>
      <h1 id="collection-not-found-title">This page could not be found.</h1>
      <p>That address does not match a current Soft Heaven collection or product.</p>
      <Sparkles aria-hidden="true" size={20} strokeWidth={1.5} />
      <ButtonLink href="/" variant="text" icon="up-right">Return to Soft Heaven</ButtonLink>
    </main>
  )
}
