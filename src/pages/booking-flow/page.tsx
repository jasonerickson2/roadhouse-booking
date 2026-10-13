import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import { AvailabilityService } from '../../services/availability';
import Footer from '../../components/feature/Footer';
import { extrasNote, extrasTotal, metaById, nice, nightsBetween, policy, readSearch, writeSearch, type Extras } from '../../lib/booking';

// Room to Hostex Property ID mapping
const ROOM_HOSTEX_MAP: Record<number, number> = {
  1: 12098453, // Grizzly Maze
  2: 12098452, // Penthouse
  3: 12098451, // Carriage House
  4: 12098449, // Room 3
  5: 12098448, // Room 2
  6: 12098447, // Room 1
};

// Checkout shows exact cents because this is the amount placed on hold.
const usd = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BookingFlowPage() {
  const [searchParams] = useSearchParams();

  // Step management. The v6 design is a single checkout page, so the form mounts on 'payment'
  // straight away (the Square card container is in the DOM from the first render) and moves to
  // 'confirmation' once the hold is placed.
  const [currentStep, setCurrentStep] = useState<'payment' | 'confirmation'>('payment');

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: ''
  });

  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [pricingData, setPricingData] = useState<any>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);

  // Payment state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [squareCard, setSquareCard] = useState<any>(null);
  const [isInitializingSquare, setIsInitializingSquare] = useState(false);
  const [storeCard, setStoreCard] = useState(true);
  const [wallets, setWallets] = useState<{ applePay?: any; googlePay?: any; cashApp?: any }>({});
  const submitTokenRef = useRef<(t: string) => Promise<void>>(async () => {});
  const guestGateRef = useRef<() => string | null>(() => null);
  const paymentsRef = useRef<any>(null);
  const walletsInitedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Confirmation data
  const [confirmationData, setConfirmationData] = useState<any>(null);

  const roomId = searchParams.get('roomId');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = parseInt(searchParams.get('guests') || '2');

  const room = rooms.find(r => r.id === parseInt(roomId || ''));

  // Shared search state and add ons from the URL (pets, early, late)
  const search = readSearch(searchParams);
  const meta = room ? metaById(room.id) : undefined;
  const earlyHours = (Math.min(2, Math.max(0, parseInt(searchParams.get('early') || '0') || 0))) as 0 | 1 | 2;
  const late = searchParams.get('late') === '1';
  const extras: Extras = { pets: search.pets, earlyHours, late };
  const ex = meta ? extrasTotal(meta, extras) : { pet: 0, early: 0, late: 0, sub: 0, tax: 0, fee: 0, total: 0 };
  const addOnNote = meta ? extrasNote(meta, extras) : '';

  // The amount placed on hold: API quote plus add ons the API does not price yet.
  const apiTotal = (pricingData as any)?.totalAmount || 0;
  const grandTotal = pricingData ? apiTotal + ex.total : 0;

  // Initialize Square payment form when the payment step is shown
  useEffect(() => {
    if (currentStep === 'payment') {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeSquarePayment();
      }, 100);

      return () => {
        clearTimeout(timer);
        // Cleanup on unmount
        if (squareCard) {
          try {
            squareCard.destroy();
          } catch (e) {
            console.log('Card cleanup on unmount');
          }
        }
      };
    }
  }, [currentStep]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Digital wallets need the correct, non-zero PaymentRequest total (Apple Pay rejects a
  // $0 total). Called once the price is known. Errors are surfaced to the UI, not swallowed.
  const initializeWallets = async (payments: any, total: number) => {
    if (walletsInitedRef.current || !payments || !(total > 0)) return;
    walletsInitedRef.current = true;
    try {
      const paymentRequest = payments.paymentRequest({
        countryCode: 'US',
        currencyCode: 'USD',
        total: { amount: total.toFixed(2), label: 'Total' },
      });
      const w: any = {};
      try { w.applePay = await payments.applePay(paymentRequest); } catch (e) { console.log('Apple Pay unavailable', e); }
      try {
        w.googlePay = await payments.googlePay(paymentRequest);
        await w.googlePay.attach('#google-pay-button', { buttonColor: 'black', buttonType: 'long', buttonSizeMode: 'fill' });
        const gp = document.getElementById('google-pay-button');
        if (gp) gp.onclick = async () => {
          setPaymentError(null);
          const gate = guestGateRef.current(); if (gate) { setPaymentError(gate); return; }
          try { const r = await w.googlePay.tokenize(); if (r.status === 'OK') await submitTokenRef.current(r.token); else setPaymentError(`Google Pay didn't complete (${r.status}). Please try the card instead.`); }
          catch (e: any) { setPaymentError('Google Pay error: ' + (e?.message || String(e))); }
        };
      } catch (e) { console.log('Google Pay unavailable', e); }
      try {
        w.cashApp = await payments.cashAppPay(paymentRequest, { redirectURL: window.location.href, referenceId: `rh-${Date.now()}` });
        await w.cashApp.attach('#cash-app-pay');
        w.cashApp.addEventListener('ontokenization', (ev: any) => {
          const t = ev?.detail?.tokenResult;
          if (t?.status === 'OK') submitTokenRef.current(t.token);
          else if (t && t.status && t.status !== 'OK') setPaymentError(`Cash App Pay didn't complete (${t.status}). Please try the card instead.`);
        });
      } catch (e) { console.log('Cash App Pay unavailable', e); }
      setWallets(w);
    } catch (e) { walletsInitedRef.current = false; console.log('wallets init skipped', e); }
  };

  // Rebuild wallet instances so a retry always gets a FRESH single-use nonce (avoids CARD_TOKEN_USED).
  const refreshWallets = () => {
    walletsInitedRef.current = false;
    const total = grandTotal;
    const gp = document.getElementById('google-pay-button'); if (gp) gp.innerHTML = '';
    const ca = document.getElementById('cash-app-pay'); if (ca) ca.innerHTML = '';
    if (paymentsRef.current && total > 0) initializeWallets(paymentsRef.current, total);
  };

  const initializeSquarePayment = async () => {
    if (isInitializingSquare) return;

    // Clean up existing card first
    if (squareCard) {
      try {
        squareCard.destroy();
      } catch (e) {
        console.log('Cleaning up previous card instance');
      }
      setSquareCard(null);
    }

    setIsInitializingSquare(true);
    setPaymentError(null);

    try {
      // Wait for Square SDK to be available
      let attempts = 0;
      while (!(window as any).Square && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!(window as any).Square) {
        console.error('Square.js failed to load after waiting');
        setPaymentError('Payment system failed to load. Please refresh the page.');
        setIsInitializingSquare(false);
        return;
      }

      console.log('Initializing Square payments...');
      const payments = (window as any).Square.payments(
        import.meta.env.VITE_SQUARE_APP_ID,
        'LPGHKRDBDY4C7'
      );
      paymentsRef.current = payments;

      const card = await payments.card();
      await card.attach('#card-container');
      setSquareCard(card);
      console.log('Square card initialized successfully');

      // Digital wallets are initialized once the price is known (Apple Pay needs a real
      // non-zero total). Try now (price is usually loaded); the effect covers late pricing.
      const walletTotal = grandTotal;
      if (walletTotal > 0) await initializeWallets(payments, walletTotal);
    } catch (error) {
      console.error('Failed to initialize Square payment:', error);
      setPaymentError('Failed to initialize payment form. Please refresh the page.');
    } finally {
      setIsInitializingSquare(false);
    }
  };

  // Fetch pricing data on mount
  useEffect(() => {
    const fetchPricing = async () => {
      if (!checkIn || !checkOut || !room) return;

      setIsLoadingPricing(true);
      try {
        const result = await AvailabilityService.checkAvailability({
          checkIn,
          checkOut,
          guests
        });

        if (result.success && result.rooms) {
          const thisRoom = result.rooms.find(r => r.roomId === room.id);
          console.log('Booking pricing data:', thisRoom);
          setPricingData(thisRoom?.pricing || null);
        }
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      } finally {
        setIsLoadingPricing(false);
      }
    };

    fetchPricing();
  }, [checkIn, checkOut, guests, room]);

  // Initialize digital wallets once the price (total) is known. Apple Pay requires it.
  useEffect(() => {
    const total = grandTotal;
    if (currentStep === 'payment' && paymentsRef.current && total > 0 && !walletsInitedRef.current) {
      initializeWallets(paymentsRef.current, total);
    }
  }, [currentStep, pricingData]);

  if (!room || !checkIn || !checkOut) {
    return (
      <div className="wrap" style={{ padding: 40 }}>
        <h2 style={{ textAlign: 'left' }}>Booking information missing</h2>
        <p><Link to="/">Back to the lodge</Link></p>
      </div>
    );
  }

  const nights = nightsBetween(search.checkIn, search.checkOut);
  const pol = policy(search.checkIn);
  const roomName = meta?.name || room.name;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Guest details and the policy box are required before any payment method (card or wallet).
  const guestGate = (): string | null => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) return 'Please fill in your name, email and phone first.';
    if (!policyAcknowledged) return 'Please agree to the cancellation policy and house rules first.';
    return null;
  };
  guestGateRef.current = guestGate;

  const submitToken = async (paymentToken: string, opts: { suppressError?: boolean } = {}): Promise<{ ok: boolean; retriable: boolean; message: string }> => {
    const suppress = opts.suppressError === true;
    if (submitInFlightRef.current) return { ok: false, retriable: false, message: '' };
    const gate = guestGate();
    if (gate) { setPaymentError(gate); return { ok: false, retriable: false, message: gate }; }
    submitInFlightRef.current = true;
    let submitSucceeded = false;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      // Re-check availability before processing payment to prevent double-booking
      console.log('Re-checking availability before payment...');
      const availCheck = await AvailabilityService.checkAvailability({
        checkIn: checkIn || '',
        checkOut: checkOut || '',
        guests: parseInt(guests?.toString() || '1')
      });

      if (availCheck.success && availCheck.rooms) {
        const roomIdNum = parseInt(roomId || '0');
        const thisRoom = availCheck.rooms.find((r: any) => r.roomId === roomIdNum);
        if (!thisRoom?.isAvailable) {
          const msg = 'Sorry, this room was just booked by someone else for your dates. Please go back and choose different dates or another room.';
          if (!suppress) setPaymentError(msg);
          setIsProcessingPayment(false);
          return { ok: false, retriable: false, message: msg };
        }
      }

      {
        console.log('Submitting payment token to booking-api authorize...');

        const roomIdNum = parseInt(roomId || '0');
        const propertyId = ROOM_HOSTEX_MAP[roomIdNum];

        if (!propertyId) {
          throw new Error(`No Hostex property ID found for room ${roomIdNum}`);
        }

        // Calculate pricing breakdown in cents
        const baseAmountCents = pricingData ? Math.round(pricingData.baseRate * 100) : 0;
        const cleaningFeeCents = pricingData ? Math.round(pricingData.cleaningFee * 100) : 0;
        const taxTotalCents = pricingData && pricingData.taxes
          ? Math.round(pricingData.taxes.reduce((sum: number, tax: any) => sum + tax.amount, 0) * 100)
          : 0;
        const serviceFeeCents = pricingData ? Math.round(pricingData.serviceFee * 100) : 0;
        const totalAmountCents = Math.round(grandTotal * 100);

        const notes = [formData.specialRequests || '', addOnNote ? `Add ons: ${addOnNote}` : ''].filter(Boolean).join('\n');

        const response = await fetch(`${import.meta.env.VITE_BOOKING_API_BASE}/authorize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: paymentToken,
            amount: totalAmountCents,
            currency: 'USD',
            cardOnFileConsent: storeCard,

            propertyId,
            roomId: roomIdNum,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guests: parseInt(guests.toString()),

            guest: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              phone: formData.phone
            },

            notes,

            nights: nights,
            baseAmount: baseAmountCents,
            cleaningFee: cleaningFeeCents,
            taxTotal: taxTotalCents,
            serviceFee: serviceFeeCents,

            extras: {
              pets: extras.pets,
              petFeeCents: Math.round(ex.pet * 100),
              earlyHours: extras.earlyHours,
              earlyFeeCents: Math.round(ex.early * 100),
              lateCheckout: extras.late,
              lateFeeCents: Math.round(ex.late * 100)
            },

            policyAcknowledged: true,
            policyLabel: pol.label
          })
        });

        const data = await response.json();
        console.log('booking-api authorize response:', data);

        if (!response.ok || !data.ok) {
          console.error('bookingAuthorize error:', data);
          const cat = data?.details?.category;
          const retriable = !response.ok || cat === 'AUTHENTICATION_ERROR' || cat === 'API_ERROR';
          const msg = data.details?.message || data.error || 'Something went wrong authorizing your card. Please try again or contact us.';
          if (!suppress) setPaymentError(msg);
          setIsProcessingPayment(false);
          return { ok: false, retriable, message: msg };
        }

        // Success - show confirmation on same page
        submitSucceeded = true;
        setConfirmationData({
          bookingId: data.bookingRequestId,
          paymentId: data.squarePaymentId,
          status: data.paymentStatus,
          ...formData
        });
        setCurrentStep('confirmation');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return { ok: true, retriable: false, message: '' };

      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const msg = error.message || 'An unexpected error occurred. Please try again.';
      if (!suppress) setPaymentError(msg);
      return { ok: false, retriable: true, message: msg };
    } finally {
      setIsProcessingPayment(false);
      submitInFlightRef.current = false;
      if (!submitSucceeded) { try { refreshWallets(); } catch (e) { /* noop */ } }
    }
  };

  submitTokenRef.current = submitToken;

  const handlePayment = async () => {
    if (!squareCard) {
      setPaymentError('Payment form not initialized. Please refresh the page.');
      return;
    }
    setPaymentError(null);
    try {
      console.log('Tokenizing card...');
      const tokenResult = await squareCard.tokenize();
      if (tokenResult.status !== 'OK') {
        console.error('Tokenization failed:', tokenResult.errors);
        setPaymentError(tokenResult.errors?.[0]?.message || 'Card validation failed. Please check your card details.');
        return;
      }
      // Submit; on a TRANSIENT failure (brief auth/network blip, not a decline) retry once
      // silently with a fresh card token so the guest never sees a one-off error.
      let res = await submitToken(tokenResult.token, { suppressError: true });
      if (!res.ok && res.retriable) {
        console.log('Transient payment failure - retrying once with a fresh token...');
        await new Promise((r) => setTimeout(r, 800));
        const t2 = await squareCard.tokenize();
        if (t2.status === 'OK') res = await submitToken(t2.token, { suppressError: true });
      }
      if (!res.ok) setPaymentError(res.message || 'Something went wrong authorizing your card. Please try again or contact us.');
    } catch (error: any) {
      console.error('Tokenize error:', error);
      setPaymentError(error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const gate = guestGate();
    if (gate) { setPaymentError(gate); return; }
    handlePayment();
  };

  const handleApplePay = async () => {
    setPaymentError(null);
    const gate = guestGate(); if (gate) { setPaymentError(gate); return; }
    try { const r = await wallets.applePay.tokenize(); if (r.status === 'OK') await submitToken(r.token); else setPaymentError(`Apple Pay didn't complete (${r.status}). Please try the card instead.`); }
    catch (e: any) { setPaymentError('Apple Pay error: ' + (e?.message || String(e))); }
  };

  const cleaningFee = pricingData ? pricingData.cleaningFee : 0;
  const taxes = pricingData ? pricingData.taxes : [];
  const serviceFee = pricingData ? pricingData.serviceFee : 0;
  const taxesAndProcessing = (taxes || []).reduce((sum: number, t: any) => sum + t.amount, 0) + serviceFee + ex.tax + ex.fee;

  const getGroupedNightlyPrices = () => {
    if (!pricingData || !pricingData.nightlyPrices || pricingData.nightlyPrices.length === 0) {
      return [];
    }

    const nightlyPrices = pricingData.nightlyPrices;

    if (nightlyPrices.length > 7) {
      const average = pricingData.baseRate / nightlyPrices.length;
      return [{
        rate: Math.round(average),
        count: nightlyPrices.length
      }];
    }

    const grouped: Array<{ rate: number; count: number }> = [];
    let currentRate = Math.round(nightlyPrices[0]);
    let count = 1;

    for (let i = 1; i < nightlyPrices.length; i++) {
      const rate = Math.round(nightlyPrices[i]);
      if (rate === currentRate) {
        count++;
      } else {
        grouped.push({ rate: currentRate, count });
        currentRate = rate;
        count = 1;
      }
    }
    grouped.push({ rate: currentRate, count });

    return grouped;
  };

  const backTo = `/room/${room.id}?${writeSearch(search, { early: String(earlyHours), late: late ? '1' : '0' })}`;
  const canSubmit = policyAcknowledged && storeCard && !isProcessingPayment && !!pricingData;
  const earlyLabel = earlyHours === 2 ? '2pm' : '3pm';
  const stayLine = `${nice(search.checkIn)} to ${nice(search.checkOut)} · ${nights} night${nights > 1 ? 's' : ''} · ${search.guests} guest${search.guests > 1 ? 's' : ''}${search.pets ? ` · ${search.pets} pet${search.pets > 1 ? 's' : ''}` : ''}`;

  // Confirmation
  if (currentStep === 'confirmation' && confirmationData) {
    return (
      <>
        <div className="wrap">
          <div className="done">
            <div className="big" style={{ background: 'var(--ok, #2f6b3a)' }}>✓</div>
            <h2>Request sent</h2>
            <p style={{ margin: 0, maxWidth: 520 }}>We have a hold of <b>{usd(grandTotal)}</b> for {roomName}, {nice(search.checkIn)} to {nice(search.checkOut)}. A copy is on its way to {confirmationData.email}.</p>
            <div className="steps">
              <div><i>1</i><span><b>Within the hour:</b> we confirm by text and email and the hold becomes your payment. If we cannot host you the hold is released the same day.</span></div>
              <div><i>2</i><span><b>4pm the day before check in:</b> your door code, parking and directions arrive by text and email.</span></div>
              <div><i>3</i><span><b>Check in from {earlyHours > 0 ? earlyLabel : '4pm'}.</b> Let yourself in. Checkout by {late ? '11am' : '10am'}.</span></div>
            </div>
            <span className="fine">Request {confirmationData.bookingId}. Questions? <a href={`mailto:erja8030@gmail.com?subject=${encodeURIComponent('Booking question ' + confirmationData.bookingId)}`}>Email us</a> or <a href="sms:+17192252364">text us</a>.</span>
            <Link className="btn btn-line" to="/">Back to the lodge</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="wrap">
        <Link className="back" to={backTo}>‹ Back to {roomName}</Link>
        <div className="co">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="sum">
              <img src={room.image} alt="" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14 }}>
                <b style={{ fontFamily: "'Playfair Display',serif", fontSize: 18 }}>{roomName}</b>
                <span>{stayLine}</span>
                {ex.early > 0 && <span>Early check in {earlyLabel}</span>}
                {ex.late > 0 && <span>Late checkout 11am</span>}
              </div>
            </div>

            <div className="pbox" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
              {isLoadingPricing ? (
                <div className="line"><span>Getting your price…</span><span></span></div>
              ) : pricingData ? (
                <>
                  {getGroupedNightlyPrices().map((group, index) => (
                    <div key={index} className="line"><span>{usd(group.rate)} × {group.count} night{group.count > 1 ? 's' : ''}</span><span>{usd(group.rate * group.count)}</span></div>
                  ))}
                  <div className="line"><span>Cleaning</span><span>{usd(cleaningFee)}</span></div>
                  {ex.pet > 0 && <div className="line"><span>Pet fee, per stay</span><span>{usd(ex.pet)}</span></div>}
                  {ex.early > 0 && <div className="line"><span>Early check in, {earlyLabel}</span><span>{usd(ex.early)}</span></div>}
                  {ex.late > 0 && <div className="line"><span>Late checkout, 11am</span><span>{usd(ex.late)}</span></div>}
                  <div className="line"><span>Taxes and processing</span><span>{usd(taxesAndProcessing)}</span></div>
                  <div className="tot"><span>Total</span><span>{usd(grandTotal)}</span></div>
                </>
              ) : (
                <div className="line"><span>We could not load a price for these dates. Please go back and try again.</span></div>
              )}
            </div>

            <div className="policy"><b>{pol.label}</b>{pol.rules.join('. ')}.</div>
          </div>

          <form className="form" ref={formRef} onSubmit={handleFormSubmit}>
            {wallets.applePay && (
              <button type="button" className="btn btn-apple" onClick={handleApplePay} disabled={isProcessingPayment} aria-label="Pay with Apple Pay">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M16.7 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.8.8-3.6.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.4-1-2.4-3.6zM14.4 5.6c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg> Pay
              </button>
            )}
            <div id="google-pay-button" />
            <div id="cash-app-pay" />
            {(wallets.applePay || wallets.googlePay || wallets.cashApp) && <span className="fine center">Fill in your details below, then pay with one tap.</span>}
            <div className="or">or pay with card</div>

            <div className="two">
              <label>First name<input required name="firstName" autoComplete="given-name" placeholder="First" value={formData.firstName} onChange={handleInputChange} /></label>
              <label>Last name<input required name="lastName" autoComplete="family-name" placeholder="Last" value={formData.lastName} onChange={handleInputChange} /></label>
            </div>
            <label>Email<input required type="email" name="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} /></label>
            <label>Phone, for your door code<input required type="tel" name="phone" inputMode="tel" autoComplete="tel" placeholder="(303) 555 0100" value={formData.phone} onChange={handleInputChange} /></label>
            <label>Anything we should know<textarea name="specialRequests" placeholder="Arrival time, pets, questions" value={formData.specialRequests} onChange={handleInputChange} /></label>

            <label>Card
              <div id="card-container" style={{ minHeight: 46 }}></div>
            </label>
            {isInitializingSquare && <span className="fine">Loading the card form…</span>}

            <label className="chk">
              <input type="checkbox" required checked={policyAcknowledged} onChange={(e) => setPolicyAcknowledged(e.target.checked)} />
              <span>I agree to the cancellation policy and the house rules for {roomName}.</span>
            </label>
            <label className="chk">
              <input type="checkbox" required checked={storeCard} onChange={(e) => setStoreCard(e.target.checked)} />
              <span>Securely save my card for this stay. I authorize Roadhouse Twin Lakes to charge this card for incidental fees (damage, extra cleaning, late checkout, unapproved pets or guests) per the booking terms.</span>
            </label>

            {paymentError && (
              <div className="note" role="alert" style={{ background: '#F6E3DF', color: '#7A2E22' }}>{paymentError}</div>
            )}

            <button className="btn btn-wood" type="submit" style={{ width: '100%' }} disabled={!canSubmit}>
              {isProcessingPayment ? 'Placing hold…' : `Place hold for ${usd(grandTotal)}`}
            </button>
            <span className="fine center">A hold is placed now. Nothing is charged until we confirm. Door code arrives at 4pm the day before check in.</span>
          </form>
        </div>
      </div>
      <Footer />
      <div className="sticky">
        <div className="l"><b>{usd(grandTotal)}</b><span>{roomName}, {nights} night{nights > 1 ? 's' : ''}</span></div>
        <button className="btn btn-wood" type="button" disabled={!canSubmit} onClick={() => formRef.current?.requestSubmit()}>Place hold</button>
      </div>
    </>
  );
}
