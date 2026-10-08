import { useEffect, useState, type FormEvent } from 'react'
import { ButtonLink } from './ButtonLink'
import { DeliveryAddressFields } from './DeliveryAddressFields'
import { StorefrontPage } from './StorefrontPage'
import { commerceConfiguration, deleteAddress, emptyDeliveryAddress, getAddresses, saveAddress, signOut, updateProfile, type AuthUser, type SavedAddress } from '../data/commerce'
import { useCommerceSession } from '../state/useCommerceSession'

export function AccountPage() {
  const { user, message } = useCommerceSession()
  return <StorefrontPage title="Your account" eyebrow="YOUR SOFT HEAVEN DETAILS" introduction="Your profile, saved delivery details, and confirmed orders.">
    {user ? <AccountDetails key={user.id} user={user} /> : <div className="selection-empty commerce-empty"><h2>{commerceConfiguration.apiConfigured ? 'Sign in to your account.' : 'Account services are being connected.'}</h2><p>{message}</p><div className="selection-empty__actions"><ButtonLink href="/login">Sign in</ButtonLink><ButtonLink href="/register" variant="text" icon="up-right">Create an account</ButtonLink></div></div>}
  </StorefrontPage>
}

function AccountDetails({ user }: { user: AuthUser }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [address, setAddress] = useState(emptyDeliveryAddress)
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | undefined>()
  const [profileName, setProfileName] = useState(user.name ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Checking your account…')

  useEffect(() => {
    let active = true
    void getAddresses(user.id).then((saved) => {
      if (!active) return
      setAddressesLoading(false)
      if (saved.ok) { setAddresses(saved.data); setMessage('') }
      else { setAddressesError(true); setMessage(saved.message) }
    })
    return () => { active = false }
  }, [user.id])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await saveAddress(address, editingAddressId)
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    const saved = await getAddresses(user.id)
    if (saved.ok) setAddresses(saved.data)
    setEditing(false)
    setEditingAddressId(undefined)
    setAddress(emptyDeliveryAddress)
    setMessage('Your delivery address is saved.')
  }

  async function handleDelete(id: string) {
    setBusy(true)
    const result = await deleteAddress(id)
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setAddresses((current) => current.filter((item) => item.id !== id))
    setMessage('Address removed.')
  }

  async function handleSignOut() {
    setBusy(true)
    const result = await signOut()
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setAddresses([])
    setMessage('You have been signed out.')
  }

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await updateProfile(profileName)
    setBusy(false)
    if (result.ok) { setProfileName(result.data.name ?? ''); setMessage('Your profile is saved.') }
    else setMessage(result.message)
  }

  return (
        <div className="account-layout">
          <section className="commerce-panel"><h2>Hello, {user.name || 'welcome back'}.</h2><p>{user.email}</p><nav className="account-links" aria-label="Your account"><a href="/orders">Your orders <span>Payment and delivery updates</span></a><a href="/wishlist">Your wishlist <span>Pieces you have kept close</span></a></nav><h3 className="account-profile-title">Your profile</h3><form className="commerce-form" onSubmit={handleProfile}><label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><button className="button button--dark" disabled={busy} type="submit">Save profile</button></form><div className="commerce-actions"><a className="text-action" href="/forgot-password">Reset password</a><button className="button button--text" type="button" disabled={busy} onClick={handleSignOut}>Sign out</button></div></section>
          <section className="commerce-aside"><h2>Delivery addresses.</h2>{addressesLoading ? <p role="status">Loading your saved addresses…</p> : addressesError ? <p className="commerce-status" role="alert">{message}</p> : addresses.length === 0 && <p>You have no saved addresses yet.</p>}{!addressesError && addresses.map((item) => <div className="saved-address" key={item.id}><strong>{item.address.fullName}</strong><address>{item.address.addressLine1}<br />{item.address.addressLine2 && <>{item.address.addressLine2}<br /></>}{item.address.city}, {item.address.state} {item.address.postalCode}<br />{item.address.phone}</address><div className="commerce-actions"><button className="text-action" type="button" disabled={busy} onClick={() => { setAddress(item.address); setEditingAddressId(item.id); setEditing(true) }}>Edit address</button><button className="text-action" type="button" disabled={busy} onClick={() => handleDelete(item.id)}>Remove address</button></div></div>)}{!addressesLoading && !addressesError && !editing ? <button className="button button--text" type="button" onClick={() => { setEditingAddressId(undefined); setAddress(emptyDeliveryAddress); setEditing(true) }}>Add an address</button> : !addressesLoading && !addressesError && <form className="commerce-form account-address-form" onSubmit={handleSave}><DeliveryAddressFields address={address} onChange={setAddress} /><button type="submit" className="button button--dark" disabled={busy}>Save address</button><button type="button" className="button button--text" onClick={() => setEditing(false)}>Cancel</button></form>}{message && !addressesLoading && !addressesError && <p className="commerce-status" role="status">{message}</p>}</section>
        </div>
  )
}
