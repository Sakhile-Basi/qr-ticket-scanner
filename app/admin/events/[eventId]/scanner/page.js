'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ScannerPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()

    const eventId = params.eventId

    const scannerRef = useRef(null)
    const processingRef = useRef(false)

    const [event, setEvent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [scannerReady, setScannerReady] = useState(false)
    const [cameraError, setCameraError] = useState(null)
    const [scanResult, setScanResult] = useState(null)

    useEffect(() => {
        if (!eventId) return

        loadPage()
    }, [eventId])

        useEffect(() => {
    if (!event || loading) return

    let cancelled = false
    let localScanner = null

    async function startScanner() {
        try {
            setCameraError(null)
            setScannerReady(false)

            const {
                Html5Qrcode,
                Html5QrcodeSupportedFormats,
            } = await import('html5-qrcode')

            if (cancelled) return

            // Make sure the scanner element actually exists.
            const readerElement =
                document.getElementById('ticket-reader')

            if (!readerElement) {
                return
            }

            const scanner = new Html5Qrcode(
                'ticket-reader',
                {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                    ],
                    verbose: false,
                }
            )

            localScanner = scanner
            scannerRef.current = scanner

            const cameras =
                await Html5Qrcode.getCameras()

            // The component may have unmounted while
            // waiting for camera permission.
            if (cancelled) return

            if (!cameras || cameras.length === 0) {
                throw new Error('No camera found.')
            }

            // Check again because the DOM could have changed
            // while getCameras() was running.
            const readerStillExists =
                document.getElementById(
                    'ticket-reader'
                )

            if (!readerStillExists) {
                return
            }

            const preferredCamera =
                cameras.find((camera) =>
                    /back|rear|environment/i.test(
                        camera.label || ''
                    )
                ) ||
                cameras[cameras.length - 1]

            // Give React one frame to finish laying out
            // the scanner container.
            await new Promise((resolve) =>
                requestAnimationFrame(resolve)
            )

            if (
                cancelled ||
                !document.getElementById(
                    'ticket-reader'
                )
            ) {
                return
            }

            await scanner.start(
                preferredCamera.id,
                {
                    fps: 10,
                },
                async (decodedText) => {
                    await handleScan(decodedText)
                },
                () => {
                    // Detection failures are normal
                    // while searching for a QR.
                }
            )

            if (cancelled) {
                try {
                    await scanner.stop()
                } catch {}

                try {
                    scanner.clear()
                } catch {}

                return
            }

            setScannerReady(true)
        } catch (error) {
            if (cancelled) return

            console.error(
                'Camera start error:',
                error
            )

            setCameraError(
                'Unable to start the camera. Please allow camera access and try again.'
            )
        }
    }

    startScanner()

    return () => {
        cancelled = true

        const scanner =
            localScanner || scannerRef.current

        scannerRef.current = null

        if (!scanner) return

        async function cleanUpScanner() {
            try {
                if (scanner.isScanning) {
                    await scanner.stop()
                }
            } catch {}

            try {
                scanner.clear()
            } catch {}
        }

        cleanUpScanner()
    }
}, [event?.id, loading])

    async function loadPage() {
        if (!eventId) {
            setCameraError('Event ID is missing.')
            setLoading(false)
            return
        }

        setLoading(true)
        setCameraError(null)

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                router.push('/admin/login')
                return
            }

            const {
                data: membership,
                error: membershipError,
            } = await supabase
                .from('event_members')
                .select('id, role')
                .eq('event_id', eventId)
                .eq('user_id', user.id)
                .single()

            if (membershipError || !membership) {
                setCameraError(
                    'You do not have access to this event.'
                )
                return
            }

            const {
                data: eventData,
                error: eventError,
            } = await supabase
                .from('events')
                .select('id, name, status')
                .eq('id', eventId)
                .single()

            if (eventError || !eventData) {
                setCameraError(
                    'Unable to load this event.'
                )
                return
            }

            setEvent(eventData)
        } catch (error) {
            console.error(
                'Scanner page load error:',
                error
            )

            setCameraError(
                error?.message ||
                    'Something went wrong while loading the scanner.'
            )
        } finally {
            setLoading(false)
        }
    }

    async function handleScan(ticketCode) {
        if (processingRef.current) return

        processingRef.current = true

        try {
            // Pause the camera while the ticket is checked.
            if (scannerRef.current) {
                try {
                    scannerRef.current.pause(true)
                } catch {
                    // Scanner may already be paused.
                }
            }

            const response = await fetch(
                '/api/tickets/scan',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        event_id: eventId,
                        ticket_code: ticketCode,
                    }),
                }
            )

            const data = await response.json()

            if (!response.ok) {
                setScanResult({
                    result: 'error',
                    message:
                        data.error ||
                        'Unable to scan ticket.',
                })

                return
            }

            setScanResult(data)
        } catch (error) {
            console.error(
                'Scan request error:',
                error
            )

            setScanResult({
                result: 'error',
                message:
                    'Something went wrong while checking the ticket.',
            })
        }
    }

    function scanNextTicket() {
        setScanResult(null)
        processingRef.current = false

        if (scannerRef.current) {
            try {
                scannerRef.current.resume()
            } catch (error) {
                console.error(
                    'Unable to resume scanner:',
                    error
                )
            }
        }
    }

    function getResultDetails() {
        if (!scanResult) return null

        switch (scanResult.result) {
            case 'admitted':
                return {
                    title: 'ADMITTED',
                    message:
                        'Ticket accepted. Allow entry.',
                    classes:
                        'bg-green-950 border-green-700 text-green-300',
                }

            case 'already_used':
                return {
                    title: 'ALREADY SCANNED',
                    message:
                        'This ticket has already been used.',
                    classes:
                        'bg-yellow-950 border-yellow-700 text-yellow-300',
                }

            case 'wrong_event':
                return {
                    title: 'WRONG EVENT',
                    message:
                        'This ticket belongs to another event.',
                    classes:
                        'bg-orange-950 border-orange-700 text-orange-300',
                }

            case 'revoked':
                return {
                    title: 'REVOKED',
                    message:
                        'This ticket is no longer valid.',
                    classes:
                        'bg-red-950 border-red-700 text-red-300',
                }

            case 'invalid':
                return {
                    title: 'INVALID TICKET',
                    message:
                        'This QR code is not recognised.',
                    classes:
                        'bg-red-950 border-red-700 text-red-300',
                }

            default:
                return {
                    title: 'SCAN ERROR',
                    message:
                        scanResult.message ||
                        'Something went wrong while checking the ticket.',
                    classes:
                        'bg-red-950 border-red-700 text-red-300',
                }
        }
    }

    const resultDetails = getResultDetails()

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-gray-400">
                    Loading scanner...
                </p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Header */}
                <header className="mb-8">
                    <button
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}`
                            )
                        }
                        className="text-gray-400 hover:text-white text-sm mb-5"
                    >
                        ← Back to Event
                    </button>

                    <h1 className="text-3xl font-bold">
                        Ticket Scanner
                    </h1>

                    <p className="text-gray-400 mt-2">
                        {event?.name}
                    </p>
                </header>

                {/* Camera Error */}
                {cameraError && (
                    <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-5 mb-6">
                        <p className="font-semibold">
                            Camera unavailable
                        </p>

                        <p className="text-sm mt-2">
                            {cameraError}
                        </p>
                    </div>
                )}

                {/* Scanner */}
                <section
                    className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden ${
                        scanResult ? 'hidden' : ''
                    }`}
                >
                    <div className="p-5 border-b border-gray-800">
                        <h2 className="font-semibold">
                            Scan Ticket
                        </h2>

                        <p className="text-gray-400 text-sm mt-1">
                            Point the camera at the QR code
                            on the attendee&apos;s ticket.
                        </p>
                    </div>

                    <div className="p-4">
                        <div
                            id="ticket-reader"
                            className="overflow-hidden rounded-xl"
                        />
                    </div>

                    {!scannerReady &&
                        !cameraError && (
                            <div className="text-center text-gray-400 text-sm pb-5">
                                Starting camera...
                            </div>
                        )}

                    {scannerReady &&
                        !cameraError && (
                            <div className="text-center text-green-400 text-sm pb-5">
                                Ready to scan
                            </div>
                        )}
                </section>

                {/* Scan Result */}
                {scanResult &&
                    resultDetails && (
                        <section
                            className={`border rounded-2xl p-8 text-center ${resultDetails.classes}`}
                        >
                            <p className="text-3xl md:text-4xl font-bold">
                                {resultDetails.title}
                            </p>

                            {scanResult.attendee_name && (
                                <p className="text-white text-2xl font-semibold mt-6">
                                    {
                                        scanResult.attendee_name
                                    }
                                </p>
                            )}

                            <p className="mt-3">
                                {
                                    resultDetails.message
                                }
                            </p>

                            {scanResult.scanned_at &&
                                scanResult.result ===
                                    'already_used' && (
                                    <div className="mt-6">
                                        <p className="text-sm opacity-70">
                                            Originally
                                            checked in
                                        </p>

                                        <p className="font-semibold mt-1">
                                            {new Date(
                                                scanResult.scanned_at
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                )}

                            <button
                                onClick={
                                    scanNextTicket
                                }
                                className="mt-8 bg-white text-gray-950 hover:bg-gray-200 px-7 py-3 rounded-lg font-semibold"
                            >
                                Scan Next Ticket
                            </button>
                        </section>
                    )}

            </div>
        </main>
    )
}