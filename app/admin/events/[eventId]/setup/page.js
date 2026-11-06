'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'

const steps = [
  { title: 'Event details', summary: 'When and where' },
  { title: 'Branding', summary: 'Poster and ticket' },
  { title: 'Review', summary: 'Ready to organise' },
]

const fieldClass =
  'w-full rounded-xl border border-[#D9CDBB] bg-[#FFFEFA] px-4 py-3 text-sm text-[#1D1A16] placeholder:text-[#80786D] outline-none transition focus-visible:border-[#A97932] focus-visible:ring-2 focus-visible:ring-[#A97932]/25'
const labelClass = 'mb-2 block text-sm font-medium text-[#4C453B]'
const primaryClass =
  'rounded-xl bg-[#1D1A16] px-5 py-3 text-sm font-semibold text-[#FFF9EE] transition-colors hover:bg-[#C99146] hover:text-[#1D1A16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932] disabled:cursor-wait disabled:opacity-50'
const secondaryClass =
  'rounded-xl border border-[#CFC0AA] bg-[#FFF9EE] px-5 py-3 text-sm font-semibold text-[#1D1A16] transition-colors hover:bg-[#EEE1CD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932] disabled:opacity-50'

// The first release supports South African event times (UTC+02:00).
// The timezone is stored explicitly so multi-timezone editing can be added later.
function toJohannesburgInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return get('year') + '-' + get('month') + '-' + get('day') + 'T' + get('hour') + ':' + get('minute')
}

function toIso(value) {
  return value ? new Date(value + ':00+02:00').toISOString() : null
}

function friendlyTime(value) {
  if (!value) return 'Not set'
  return new Date(toIso(value)).toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function EventSetupPage() {
  const { eventId } = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [details, setDetails] = useState({
    name: '',
    description: '',
    starts_at: '',
    ends_at: '',
    venue_name: '',
    venue_address: '',
    city: '',
  })
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState('')
  const [previewQr, setPreviewQr] = useState('')

  const eventUrl = '/admin/events/' + eventId
  const canFinish = Boolean(
    details.name.trim() &&
      details.starts_at &&
      details.ends_at &&
      new Date(toIso(details.ends_at)) > new Date(toIso(details.starts_at))
  )

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    async function loadEvent() {
      const supabase = createClient()
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth?.user) {
          router.replace('/admin/login')
          return
        }

        const { data: member, error: memberError } = await supabase
          .from('event_members')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', auth.user.id)
          .single()

        if (memberError || !member) {
          throw new Error('You do not have permission to set up this event.')
        }

        const { data, error: eventError } = await supabase
          .from('events')
          .select('id, name, description, starts_at, ends_at, timezone, venue_name, venue_address, city, poster_url, setup_completed_at')
          .eq('id', eventId)
          .single()

        if (eventError || !data) throw new Error(eventError?.message || 'Event not found.')
        if (cancelled) return
        setEvent(data)
        setDetails({
          name: data.name || '',
          description: data.description || '',
          starts_at: toJohannesburgInput(data.starts_at),
          ends_at: toJohannesburgInput(data.ends_at),
          venue_name: data.venue_name || '',
          venue_address: data.venue_address || '',
          city: data.city || '',
        })
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load the event.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadEvent()
    return () => {
      cancelled = true
    }
  }, [eventId, router])

  useEffect(() => {
    if (!posterFile) {
      setPosterPreview('')
      return
    }
    const url = URL.createObjectURL(posterFile)
    setPosterPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [posterFile])

  useEffect(() => {
    if (!eventId) return
    QRCode.toDataURL('PREVIEW-ONLY-' + eventId, { margin: 1, width: 144 })
      .then(setPreviewQr)
      .catch(() => setPreviewQr(''))
  }, [eventId])

  function edit(field, value) {
    setDetails((previous) => ({ ...previous, [field]: value }))
    setError('')
  }

  async function saveDetails(nextStep = 1, exitAfter = false) {
    if (!details.name.trim()) {
      setError('Please enter an event name.')
      return false
    }

    let start = null
    let end = null
    try {
      start = toIso(details.starts_at)
      end = toIso(details.ends_at)
    } catch {
      setError('Please enter valid event dates.')
      return false
    }
    if (start && end && new Date(end) <= new Date(start)) {
      setError('The end date and time must be after the start.')
      return false
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      name: details.name.trim(),
      description: details.description.trim() || null,
      starts_at: start,
      ends_at: end,
      timezone: 'Africa/Johannesburg',
      venue_name: details.venue_name.trim() || null,
      venue_address: details.venue_address.trim() || null,
      city: details.city.trim() || null,
    }
    // A previously completed event becomes incomplete if its dates are removed.
    if (event?.setup_completed_at && (!start || !end)) {
      payload.setup_completed_at = null
    }

    const { data, error: saveError } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select('id, name, starts_at, ends_at, setup_completed_at')
      .single()

    setSaving(false)
    if (saveError || !data) {
      setError(saveError?.message || 'Unable to save event details.')
      return false
    }
    setEvent((previous) => ({ ...previous, ...data }))
    if (exitAfter) router.push(eventUrl)
    else setStep(nextStep)
    return true
  }

  async function saveBranding() {
    if (!posterFile) {
      setStep(2)
      return
    }
    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    if (!allowedTypes[posterFile.type]) {
      setError('Please choose a PNG, JPG or WebP image.')
      return
    }
    if (posterFile.size > 5 * 1024 * 1024) {
      setError('Your poster must be smaller than 5 MB.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const filePath =
      eventId + '/poster-' + crypto.randomUUID() + '.' + allowedTypes[posterFile.type]
    const { error: uploadError } = await supabase.storage
      .from('event-posters')
      .upload(filePath, posterFile, { contentType: posterFile.type })

    if (uploadError) {
      setError(uploadError.message)
      setSaving(false)
      return
    }
    const { data: urlData } = supabase.storage.from('event-posters').getPublicUrl(filePath)
    const posterUrl = urlData.publicUrl
    const { data, error: updateError } = await supabase
      .from('events')
      .update({ poster_url: posterUrl })
      .eq('id', eventId)
      .select('poster_url')
      .single()
    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message || 'The poster uploaded, but could not be linked to the event.')
      return
    }
    setEvent((previous) => ({ ...previous, poster_url: posterUrl }))
    setPosterFile(null)
    setStep(2)
  }

  async function finishSetup() {
    if (!canFinish) {
      setStep(0)
      setError('Add a valid start and end date to complete event setup.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: finishError } = await supabase
      .from('events')
      .update({ setup_completed_at: new Date().toISOString() })
      .eq('id', eventId)
      .select('id')
      .single()
    setSaving(false)
    if (finishError) {
      setError(finishError.message)
      return
    }
    router.push(eventUrl)
    router.refresh()
  }

  function skipForNow() {
    if (saving) return
    router.push(eventUrl)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EDE3D1] text-[#1D1A16]">
        <p role="status" className="text-sm">Loading your event setup…</p>
      </main>
    )
  }

  if (!event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#EDE3D1] p-6 text-[#1D1A16]">
        <p role="alert" className="max-w-md text-center">{error || 'Event not found.'}</p>
        <button className={secondaryClass} onClick={() => router.push('/admin/dashboard')}>
          Back to events
        </button>
      </main>
    )
  }

  const currentPoster = posterPreview || event.poster_url

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#EDE3D1] text-[#1D1A16]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-repeat opacity-[0.18] blur-[3px]"
        style={{ backgroundImage: "url('/digital-inkabi-pattern.svg')", backgroundSize: '640px 540px' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[#F8F0E2]/25" />
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-xl border border-[#D7C7AE] bg-[#FFF9EE]">
              <Image src="/digital-inkabi.jpeg" alt="digital.inkabi logo" width={48} height={48} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">digital.inkabi</p>
              <p className="text-xs text-[#6F6658]">Event management</p>
            </div>
          </div>
          <button type="button" onClick={skipForNow} disabled={saving} className="text-sm font-semibold text-[#4D4234] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#A97932] disabled:opacity-50">
            Skip for now &rarr;
          </button>
        </header>

        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#956A33]">Event setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-2 text-sm text-[#655B4E]">
            Set up the essentials now, or come back later. Each completed step is saved.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#D8C8B0] bg-[#FFF9EE]/90 p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[#766A5A]">
              Your progress
            </p>
            <ol className="space-y-5">
              {steps.map((item, index) => (
                <li key={item.title} className="flex items-start gap-3" aria-current={step === index ? 'step' : undefined}>
                  <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ' + (step === index ? 'bg-[#1D1A16] text-[#FFF9EE]' : index < step ? 'bg-[#A97932] text-white' : 'bg-[#EFE4D3] text-[#6F6658]')}>
                    {index < step ? '✓' : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-1 block text-xs text-[#74695B]">{item.summary}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-7 rounded-xl bg-[#F0E5D3] p-4 text-xs leading-relaxed text-[#665744]">
              <strong>Good to know:</strong> Event dates are needed to finish setup, but not to create an event or save a draft.
            </div>
          </aside>

          <section className="rounded-2xl border border-[#D8C8B0] bg-[#FFF9EE] p-5 shadow-[0_20px_60px_rgba(64,42,16,0.10)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9C713C]">
                  Step {step + 1} of 3
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {step === 0 ? 'Tell us about your event' : step === 1 ? 'Make it yours' : 'Review your event'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6F6658]">
                  {step === 0
                    ? 'A few details help everyone know when and where to arrive.'
                    : step === 1
                      ? 'Upload one poster that can also appear on your QR tickets.'
                      : 'Make sure everything looks right before managing attendees.'}
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-6 rounded-xl border border-[#DDA09E] bg-[#FFF1EF] px-4 py-3 text-sm text-[#842E2A]">
                {error}
              </div>
            )}

            {step === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); saveDetails(1, false) }} className="space-y-6">
                <div>
                  <label className={labelClass} htmlFor="setup-name">Event name *</label>
                  <input id="setup-name" className={fieldClass} required maxLength={120} value={details.name} onChange={(e) => edit('name', e.target.value)} placeholder="e.g. STADIO Freshers" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="setup-description">Description <span className="font-normal text-[#80786D]">(optional)</span></label>
                  <textarea id="setup-description" className={fieldClass} rows={4} maxLength={3000} value={details.description} onChange={(e) => edit('description', e.target.value)} placeholder="Tell attendees what to expect..." />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="setup-start">Start date and time</label>
                    <input id="setup-start" type="datetime-local" className={fieldClass} value={details.starts_at} onChange={(e) => edit('starts_at', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="setup-end">End date and time</label>
                    <input id="setup-end" type="datetime-local" className={fieldClass} value={details.ends_at} onChange={(e) => edit('ends_at', e.target.value)} />
                  </div>
                </div>
                <p className="-mt-3 text-xs text-[#756A5C]">Times use South African Standard Time (Africa/Johannesburg, UTC+02:00).</p>
                <div className="border-t border-[#E5D9C8] pt-5">
                  <h3 className="mb-4 text-base font-semibold">Venue <span className="text-sm font-normal text-[#80786D]">(optional)</span></h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="setup-venue">Venue name</label>
                      <input id="setup-venue" className={fieldClass} value={details.venue_name} onChange={(e) => edit('venue_name', e.target.value)} placeholder="e.g. Main Campus Hall" />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="setup-city">City</label>
                      <input id="setup-city" className={fieldClass} value={details.city} onChange={(e) => edit('city', e.target.value)} placeholder="e.g. Centurion" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="setup-address">Street address</label>
                      <input id="setup-address" className={fieldClass} value={details.venue_address} onChange={(e) => edit('venue_address', e.target.value)} placeholder="Optional address details" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between gap-3 border-t border-[#E5D9C8] pt-6">
                  <button type="button" disabled={saving} className={secondaryClass} onClick={() => saveDetails(0, true)}>Save & exit</button>
                  <button type="submit" disabled={saving} className={primaryClass}>{saving ? 'Saving…' : 'Save & continue →'}</button>
                </div>
              </form>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
                  <div>
                    <label className={labelClass} htmlFor="setup-poster">Event poster</label>
                    <label htmlFor="setup-poster" className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CEBA9D] bg-[#FFFEFA] p-6 text-center transition-colors hover:bg-[#F7EDDF]">
                      <span className="text-3xl" aria-hidden="true">↥</span>
                      <span className="mt-3 text-sm font-semibold">Choose a poster</span>
                      <span className="mt-2 text-xs text-[#756A5C]">PNG, JPG or WebP, up to 5 MB</span>
                    </label>
                    <input id="setup-poster" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { setPosterFile(e.target.files?.[0] || null); setError('') }} />
                    <p className="mt-3 text-xs text-[#756A5C]">{posterFile ? 'Selected: ' + posterFile.name : currentPoster ? 'A poster is already uploaded. Choose another to replace it.' : 'You can also add this later.'}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Ticket preview</p>
                    <div className="overflow-hidden rounded-xl border border-[#D9CDBB] bg-white shadow-sm">
                      {currentPoster ? (
                        <img src={currentPoster} alt="Event poster preview" className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-[#EEE0CA] px-4 text-center text-sm text-[#776854]">Your event poster will appear here</div>
                      )}
                      <div className="p-4 text-center">
                        <p className="truncate text-sm font-semibold">{details.name}</p>
                        <p className="mt-1 text-xs text-[#756A5C]">Sample Attendee</p>
                        {previewQr ? <img className="mx-auto mt-3 h-24 w-24" src={previewQr} alt="Non-valid demonstration QR code" /> : <div className="mx-auto mt-3 h-24 w-24 bg-[#EDE3D1]" />}
                        <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#877968]">Preview only · Not valid for entry</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-[#F0E5D3] p-4 text-xs leading-6 text-[#6B5A45]">
                  Each attendee will still receive their own unique QR ticket. This preview is only an illustration of the branding.
                </div>
                <div className="flex flex-wrap justify-between gap-3 border-t border-[#E5D9C8] pt-6">
                  <button className={secondaryClass} type="button" disabled={saving} onClick={() => setStep(0)}>← Back</button>
                  <button className={primaryClass} type="button" disabled={saving} onClick={saveBranding}>{saving ? 'Uploading…' : posterFile ? 'Upload & continue →' : 'Continue without poster →'}</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <dl className="divide-y divide-[#E5D9C8] rounded-xl border border-[#E5D9C8] bg-[#FFFEFA] px-5">
                  <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-[#6F6658]">Event</dt><dd className="text-sm font-semibold">{details.name}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-[#6F6658]">Starts</dt><dd className="text-sm font-semibold">{friendlyTime(details.starts_at)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-[#6F6658]">Ends</dt><dd className="text-sm font-semibold">{friendlyTime(details.ends_at)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-[#6F6658]">Venue</dt><dd className="text-sm font-semibold">{[details.venue_name, details.city].filter(Boolean).join(', ') || 'Not set'}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-[#6F6658]">Poster</dt><dd className="text-sm font-semibold">{event.poster_url ? 'Uploaded' : 'Not added (optional)'}</dd></div>
                </dl>
                {!canFinish ? (
                  <div role="status" className="rounded-xl border border-[#DEB987] bg-[#FFF4DF] p-4 text-sm text-[#7C5323]">
                    Start and end dates are required before you can finish setup.
                    <button type="button" onClick={() => setStep(0)} className="ml-2 font-semibold underline underline-offset-2">Add dates</button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#B6CEAF] bg-[#F0F7ED] p-4 text-sm text-[#325E32]">
                    Everything is ready. You can add attendees and invite your team from the event dashboard.
                  </div>
                )}
                <div className="flex flex-wrap justify-between gap-3 border-t border-[#E5D9C8] pt-6">
                  <button className={secondaryClass} type="button" disabled={saving} onClick={() => setStep(1)}>← Back</button>
                  <button className={primaryClass} type="button" disabled={!canFinish || saving} onClick={finishSetup}>{saving ? 'Finishing…' : 'Finish setup →'}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
