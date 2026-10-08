import type { DeliveryAddress } from '../data/commerce'

export function DeliveryAddressFields({ address, onChange }: { address: DeliveryAddress; onChange: (address: DeliveryAddress) => void }) {
  const update = (field: keyof DeliveryAddress, value: string) => onChange({ ...address, [field]: value })
  return (
    <div className="checkout-form__grid">
      <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={address.fullName} onChange={(event) => update('fullName', event.target.value)} /></label>
      <label>Mobile number<input required type="tel" maxLength={20} autoComplete="tel" value={address.phone} onChange={(event) => update('phone', event.target.value)} /><small>Indian mobile number, optionally prefixed with +91.</small></label>
      <label className="checkout-form__wide">Address line 1<input required minLength={5} maxLength={200} autoComplete="address-line1" value={address.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} /></label>
      <label className="checkout-form__wide">Apartment, landmark, or area (optional)<input maxLength={200} autoComplete="address-line2" value={address.addressLine2} onChange={(event) => update('addressLine2', event.target.value)} /></label>
      <label>City<input required minLength={2} maxLength={100} autoComplete="address-level2" value={address.city} onChange={(event) => update('city', event.target.value)} /></label>
      <label>State<input required minLength={2} maxLength={100} autoComplete="address-level1" value={address.state} onChange={(event) => update('state', event.target.value)} /></label>
      <label>PIN code<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" value={address.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></label>
    </div>
  )
}
