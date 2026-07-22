import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import { AvailabilityService } from '../../services/availability';

// Room to Hostex Property ID mapping
const ROOM_HOSTEX_MAP: Record<number, number> = {
  1: 12098453, // Grizzly Maze
  2: 12098452, // Penthouse
  3: 12098451, // Carriage House
  4: 12098449, // Room 3
  5: 12098448, // Room 2
  6: 12098447, // Room 1
};

export default function BookingFlowPage() {
  const [searchParams] = useSearchParams();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<'details' | 'payment' | 'confirmation'>('details');
  
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

  // Confirmation data
  const [confirmationData, setConfirmationData] = useState<any>(null);

  const roomId = searchParams.get('roomId');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = parseInt(searchParams.get('guests') || '2');

  const room = rooms.find(r => r.id === parseInt(roomId || ''));

  // Initialize Square payment form when moving to payment step
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
        'L0YVVDQM2REPZ'
      );

      const card = await payments.card();
      await card.attach('#card-container');
      setSquareCard(card);
      console.log('Square card initialized successfully');

      // Digital wallets (Apple Pay / Google Pay / Cash App Pay). Best-effort: if a
      // wallet isn't supported on this device/browser (or a domain isn't registered
      // for Apple Pay / not in production), it simply won't appear; card still works.
      try {
        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: (totalAmount || 0).toFixed(2), label: 'Total' },
        });
        const w: any = {};
        try { w.applePay = await payments.applePay(paymentRequest); } catch (e) { console.log('Apple Pay unavailable', e); }
        try {
          w.googlePay = await payments.googlePay(paymentRequest);
          await w.googlePay.attach('#google-pay-button', { buttonColor: 'black', buttonType: 'long', buttonSizeMode: 'fill' });
          const gp = document.getElementById('google-pay-button');
          if (gp) gp.onclick = async () => {
            try { const r = await w.googlePay.tokenize(); if (r.status === 'OK') await submitTokenRef.current(r.token); }
            catch (e) { console.error('Google Pay error', e); }
          };
        } catch (e) { console.log('Google Pay unavailable', e); }
        try {
          w.cashApp = await payments.cashAppPay(paymentRequest, { redirectURL: window.location.href, referenceId: `rh-${Date.now()}` });
          await w.cashApp.attach('#cash-app-pay');
          w.cashApp.addEventListener('ontokenization', (ev: any) => {
            const t = ev?.detail?.tokenResult;
            if (t?.status === 'OK') submitTokenRef.current(t.token);
          });
        } catch (e) { console.log('Cash App Pay unavailable', e); }
        setWallets(w);
      } catch (e) { console.log('wallets init skipped', e); }
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

  if (!room || !checkIn || !checkOut) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Booking information missing</h1>
          <Link to="/" className="text-black hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  // Determine which cancellation policy applies
  const getSeasonAndPolicy = () => {
    const checkInDate = new Date(checkIn);
    const year = checkInDate.getFullYear();
    
    const memorialDay = new Date(year, 4, 31);
    memorialDay.setDate(31 - memorialDay.getDay() + 1);
    
    const memorialDayWeekend = new Date(memorialDay);
    memorialDayWeekend.setDate(memorialDay.getDate() - 2);
    
    const oct31 = new Date(year, 9, 31);
    
    if (checkInDate >= memorialDayWeekend && checkInDate <= oct31) {
      return {
        season: 'summer',
        title: 'Summer / Peak Season Cancellation Policy',
        period: 'Memorial Day Weekend – October 31',
        description: 'Summer in Twin Lakes is our busiest season. Because of limited availability, we use a stricter policy for these dates.',
        rules: [
          'Guests can cancel up to 30 days before check-in for a full refund.',
          'Cancellations made 30–14 days before check-in receive a 50% refund of the total booking amount.',
          'Cancellations made within 14 days of check-in, and no-shows, are non-refundable.',
          'Date changes requested within 30 days of check-in are not guaranteed and, if approved, may be treated as a cancellation and new reservation at current rates.',
          'Any processing fees charged by banks or payment processors are non-refundable.'
        ]
      };
    } else {
      return {
        season: 'winter',
        title: 'Winter / Standard Cancellation Policy',
        period: 'November 1 – Thursday before Memorial Day Weekend',
        description: 'We understand that winter travel in the mountains can be unpredictable, so we offer a more flexible policy in the winter season.',
        rules: [
          'Guests can cancel up to 14 days before check-in for a full refund.',
          'Cancellations made 14–7 days before check-in receive a 50% refund of the total booking amount.',
          'Cancellations made within 7 days of check-in, and no-shows, are non-refundable.',
          'Date changes requested fewer than 14 days before check-in are not guaranteed and may be treated as a cancellation and new reservation.',
          'Any processing fees charged by banks or payment processors are non-refundable.'
        ]
      };
    }
  };

  const calculateNights = () => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    if (!policyAcknowledged) {
      alert('Please acknowledge that you have read and agree to the cancellation policy');
      return;
    }

    // Move to payment step
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditDetails = () => {
    // Clean up Square card before going back
    if (squareCard) {
      try {
        squareCard.destroy();
      } catch (e) {
        console.log('Card cleanup error:', e);
      }
      setSquareCard(null);
    }
    setCurrentStep('details');
    setPaymentError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitToken = async (paymentToken: string) => {
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
          setPaymentError('Sorry, this room was just booked by someone else for your dates. Please go back and choose different dates or another room.');
          setIsProcessingPayment(false);
          return;
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
        const totalAmountCents = Math.round(totalAmount * 100);

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

            notes: formData.specialRequests || '',

            nights: nights,
            baseAmount: baseAmountCents,
            cleaningFee: cleaningFeeCents,
            taxTotal: taxTotalCents,
            serviceFee: serviceFeeCents
          })
        });

        const data = await response.json();
        console.log('booking-api authorize response:', data);

        if (!response.ok || !data.ok) {
          console.error('bookingAuthorize error:', data);
          setPaymentError(data.details?.message || data.error || 'Something went wrong authorizing your card. Please try again or contact us.');
          setIsProcessingPayment(false);
          return;
        }

        // Success - show confirmation on same page
        setConfirmationData({
          bookingId: data.bookingRequestId,
          paymentId: data.squarePaymentId,
          status: data.paymentStatus,
          ...formData
        });
        setCurrentStep('confirmation');
        window.scrollTo({ top: 0, behavior: 'smooth' });

      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessingPayment(false);
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
      if (tokenResult.status === 'OK') {
        await submitToken(tokenResult.token);
      } else {
        console.error('Tokenization failed:', tokenResult.errors);
        setPaymentError(tokenResult.errors?.[0]?.message || 'Card validation failed. Please check your card details.');
      }
    } catch (error: any) {
      console.error('Tokenize error:', error);
      setPaymentError(error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const policyInfo = getSeasonAndPolicy();
  const nights = calculateNights();

  const pricePerNight = pricingData ? (pricingData.baseRate / pricingData.nights) : room.price;
  const baseRate = pricingData ? pricingData.baseRate : (room.price * nights);
  const cleaningFee = pricingData ? pricingData.cleaningFee : 0;
  const taxes = pricingData ? pricingData.taxes : [];
  const serviceFee = pricingData ? pricingData.serviceFee : 0;
  const totalAmount = pricingData ? pricingData.totalAmount : 0;

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

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // Parse as UTC to avoid timezone shifts
    const date = new Date(dateString + 'T00:00:00Z');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}-${day}-${year}`;
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep === 'details' ? 'bg-[#1a2e1a] text-white' : 'bg-[#1a2e1a] text-white'} rounded-full flex items-center justify-center font-semibold transition-colors`}>
                {currentStep === 'details' ? '1' : <i className="ri-check-line"></i>}
              </div>
              <span className={`ml-2 font-semibold ${currentStep === 'details' ? 'text-gray-900' : 'text-[#1a2e1a]'}`}>Details</span>
            </div>
            <div className={`w-16 h-1 ${currentStep !== 'details' ? 'bg-[#1a2e1a]' : 'bg-gray-300'} transition-colors`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep === 'payment' ? 'bg-[#1a2e1a] text-white' : currentStep === 'confirmation' ? 'bg-[#1a2e1a] text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center font-semibold transition-colors`}>
                {currentStep === 'confirmation' ? <i className="ri-check-line"></i> : '2'}
              </div>
              <span className={`ml-2 ${currentStep === 'payment' ? 'font-semibold text-gray-900' : currentStep === 'confirmation' ? 'font-semibold text-[#1a2e1a]' : 'text-gray-600'}`}>Payment</span>
            </div>
            <div className={`w-16 h-1 ${currentStep === 'confirmation' ? 'bg-[#1a2e1a]' : 'bg-gray-300'} transition-colors`}></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 ${currentStep === 'confirmation' ? 'bg-[#1a2e1a] text-white' : 'bg-gray-300 text-gray-600'} rounded-full flex items-center justify-center font-semibold transition-colors`}>
                3
              </div>
              <span className={`ml-2 ${currentStep === 'confirmation' ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>Submitted</span>
            </div>
          </div>
        </div>

        {/* Back Button - Only show on details step */}
        {currentStep === 'details' && (
          <Link
            to={`/room/${room.id}?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}
            className="inline-flex items-center text-black hover:text-gray-700 mb-4 sm:mb-6 transition-colors"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Back to room details
          </Link>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Booking Summary - Show FIRST on mobile, SECOND on desktop */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-24">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-6">Booking Summary</h3>
              
              {/* Condensed layout on mobile */}
              <div className="mb-3 sm:mb-6 lg:mb-4">
                <div className="flex items-center gap-3 lg:block">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-20 h-20 lg:w-full lg:h-32 sm:lg:h-40 object-contain object-center rounded-lg bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate lg:mt-3 lg:mb-0">{room.name}</h4>
                    <div className="text-xs text-gray-600 mt-1 lg:hidden">
                      <div>{formatDate(checkIn)} - {formatDate(checkOut)}</div>
                      <div>{guests} guests · {nights} nights</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full details on desktop, condensed on mobile */}
              <div className="hidden lg:block space-y-3 text-sm mb-4 sm:mb-6">
                <div className="flex justify-between">
                  <span>Check-in:</span>
                  <span className="font-medium">{formatDate(checkIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Check-out:</span>
                  <span className="font-medium">{formatDate(checkOut)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Guests:</span>
                  <span className="font-medium">{guests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nights:</span>
                  <span className="font-medium">{nights}</span>
                </div>
              </div>

              {isLoadingPricing ? (
                <div className="bg-gray-50 p-4 lg:p-6 rounded-lg flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : pricingData ? (
                <div className="bg-gray-50 p-3 lg:p-6 rounded-lg">
                  <h3 className="text-base lg:text-lg font-semibold mb-2 lg:mb-4">Price Breakdown</h3>
                  <div className="space-y-1.5 lg:space-y-2 text-xs lg:text-sm">
                    {getGroupedNightlyPrices().map((group, index) => (
                      <div key={index} className="flex justify-between">
                        <span>${group.rate} × {group.count} {group.count === 1 ? 'night' : 'nights'}</span>
                        <span>${(group.rate * group.count).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span>Cleaning fee</span>
                      <span>${cleaningFee}</span>
                    </div>
                    {taxes.map((tax: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span>{tax.name}</span>
                        <span>${tax.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span>Service fee</span>
                      <span>${serviceFee.toFixed(2)}</span>
                    </div>
                    <hr className="my-1.5 lg:my-2" />
                    <div className="flex justify-between font-semibold text-base lg:text-lg">
                      <span>Total</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep !== 'confirmation' && (
                <div className="mt-3 lg:mt-6 p-3 lg:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center text-amber-800">
                    <i className="ri-shield-check-line mr-2 text-sm lg:text-base"></i>
                    <span className="text-xs lg:text-sm font-medium">Secure Payment Hold</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1 hidden lg:block">
                    Your payment will be securely held until we approve your booking.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area - Show SECOND on mobile, FIRST on desktop */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              
              {/* STEP 1: Guest Details */}
              {currentStep === 'details' && (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 font-serif">
                    Guest Information
                  </h1>

                  <form onSubmit={handleContinueToPayment} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm sm:text-base"
                          placeholder="Enter your first name"
                        />
                      </div>

                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm sm:text-base"
                          placeholder="Enter your last name"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm sm:text-base"
                        placeholder="Enter your email address"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm sm:text-base"
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div>
                      <label htmlFor="specialRequests" className="block text-sm font-medium text-gray-700 mb-2">
                        Tell Us About Your Trip (Optional)
                      </label>
                      <textarea
                        id="specialRequests"
                        name="specialRequests"
                        value={formData.specialRequests}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none text-sm sm:text-base"
                        placeholder="What brings you to Twin Lakes? Anything we should know about your stay..."
                      />
                    </div>

                    {/* Cancellation Policy Section */}
                    <div className="border-t pt-6">
                      <div className={`p-6 rounded-lg border-2 ${policyInfo.season === 'summer' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-start mb-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 mt-0.5 ${policyInfo.season === 'summer' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                            <i className={`ri-calendar-line ${policyInfo.season === 'summer' ? 'text-amber-600' : 'text-blue-600'}`}></i>
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold mb-1 ${policyInfo.season === 'summer' ? 'text-amber-900' : 'text-blue-900'}`}>
                              {policyInfo.title}
                            </h3>
                            <p className={`text-sm font-medium mb-2 ${policyInfo.season === 'summer' ? 'text-amber-800' : 'text-blue-800'}`}>
                              ({policyInfo.period})
                            </p>
                            <p className={`text-sm mb-4 ${policyInfo.season === 'summer' ? 'text-amber-700' : 'text-blue-700'}`}>
                              {policyInfo.description}
                            </p>
                            
                            <div className="space-y-2">
                              {policyInfo.rules.map((rule, index) => (
                                <div key={index} className="flex items-start">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0 ${policyInfo.season === 'summer' ? 'bg-amber-600' : 'bg-blue-600'}`}></div>
                                  <p className={`text-sm ${policyInfo.season === 'summer' ? 'text-amber-700' : 'text-blue-700'}`}>
                                    {rule}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-start mt-4 pt-4 border-t border-current border-opacity-20">
                          <input
                            type="checkbox"
                            id="policyAcknowledgment"
                            checked={policyAcknowledged}
                            onChange={(e) => setPolicyAcknowledged(e.target.checked)}
                            className="mt-1 mr-3 w-4 h-4 text-black focus:ring-black border-gray-300 rounded cursor-pointer"
                            required
                          />
                          <label htmlFor="policyAcknowledgment" className={`text-sm font-medium cursor-pointer ${policyInfo.season === 'summer' ? 'text-amber-900' : 'text-blue-900'}`}>
                            I have read and agree to the cancellation policy that applies to my booking dates *
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 sm:pt-6">
                      <button
                        type="submit"
                        disabled={!policyAcknowledged}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors whitespace-nowrap"
                      >
                        Continue to Secure Payment
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* STEP 2: Payment */}
              {currentStep === 'payment' && (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 font-serif">
                    Secure Payment
                  </h1>

                  {/* Reservation Summary */}
                  <div className="bg-stone-50 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Reservation Details</h3>
                      <button
                        onClick={handleEditDetails}
                        className="text-amber-600 hover:text-amber-700 font-medium text-sm inline-flex items-center"
                      >
                        <i className="ri-edit-line mr-1"></i>
                        Edit Details
                      </button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Room:</span>
                        <span className="font-medium">{room.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Check-in:</span>
                        <span className="font-medium">{formatDate(checkIn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Check-out:</span>
                        <span className="font-medium">{formatDate(checkOut)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Guests:</span>
                        <span className="font-medium">{guests}</span>
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600">Name:</span>
                          <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium">{formData.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{formData.phone}</span>
                        </div>
                      </div>
                      {formData.specialRequests && (
                        <div className="pt-3 border-t">
                          <span className="text-gray-600 block mb-1">Special Requests:</span>
                          <span className="text-gray-900">{formData.specialRequests}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Square Payment Form */}
                  <div className="mb-6">
                    {/* Digital wallets (appear only when supported on this device) */}
                    <div className="mb-3 space-y-2">
                      {wallets.applePay && (
                        <button
                          type="button"
                          onClick={async () => {
                            try { const r = await wallets.applePay.tokenize(); if (r.status === 'OK') await submitToken(r.token); }
                            catch (e) { console.error('Apple Pay error', e); }
                          }}
                          disabled={isProcessingPayment}
                          className="w-full bg-black text-white py-3 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50"
                          style={{ minHeight: '48px' }}
                        >
                          Apple Pay
                        </button>
                      )}
                      <div id="google-pay-button" style={{ minHeight: '48px' }} />
                      <div id="cash-app-pay" />
                    </div>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">or pay with card</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Card Information
                    </label>
                    <div id="card-container" className="border border-gray-300 rounded-lg p-4 bg-white min-h-[80px]"></div>
                    {isInitializingSquare && (
                      <div className="mt-2 text-sm text-gray-500 flex items-center">
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Loading payment form...
                      </div>
                    )}
                  </div>

                  {paymentError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start text-red-800">
                        <i className="ri-error-warning-line mr-2 mt-0.5 text-lg"></i>
                        <div>
                          <p className="font-medium">Payment Error</p>
                          <p className="text-sm mt-1">{paymentError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center text-amber-800">
                      <i className="ri-shield-check-line mr-2"></i>
                      <span className="text-sm font-medium">Your card will only be charged after we approve your booking</span>
                    </div>
                  </div>

                  {/* Card-on-file consent */}
                  <label className="flex items-start gap-2 mb-4 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeCard}
                      onChange={(e) => setStoreCard(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Securely save my card for this stay. I authorize Roadhouse Twin Lakes to charge this
                      card for incidental fees &mdash; damage, extra cleaning, late checkout, or unapproved
                      pets/guests &mdash; per the booking terms.
                    </span>
                  </label>

                  <button
                    onClick={handlePayment}
                    disabled={isProcessingPayment}
                    className="w-full bg-[#1a2e1a] hover:bg-[#2a4e2a] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors whitespace-nowrap"
                  >
                    {isProcessingPayment ? (
                      <span className="inline-flex items-center">
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Processing...
                      </span>
                    ) : (
                      'Authorize Payment'
                    )}
                  </button>
                </>
              )}

              {/* STEP 3: Confirmation */}
              {currentStep === 'confirmation' && confirmationData && (
                <>
                  {/* Success Icon */}
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-check-line text-2xl text-[#1a2e1a]"></i>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                      Booking Request Submitted!
                    </h1>

                    <p className="text-sm text-gray-600">
                      Payment authorized — your request is pending review. We'll confirm shortly.
                    </p>
                  </div>

                  {/* Reservation Details */}
                  <div className="bg-stone-50 rounded-lg p-4 mb-4">
                    <h2 className="text-base font-semibold text-gray-900 mb-3 text-center">Reservation Details</h2>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                          Pending Approval
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{confirmationData.firstName} {confirmationData.lastName}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{confirmationData.email}</span>
                      </div>
                      
                      <div className="border-t pt-3 mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Room:</span>
                          <span className="font-medium">{room.name}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Check-in:</span>
                          <span className="font-medium">{formatDate(checkIn)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Check-out:</span>
                          <span className="font-medium">{formatDate(checkOut)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Guests:</span>
                          <span className="font-medium">{guests}</span>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t">
                          <span className="text-gray-600">Total Amount:</span>
                          <span className="font-bold text-lg text-amber-600">${totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Next Steps (desktop only) */}
                  <div className="hidden sm:block bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">What happens next?</h3>
                    <div className="space-y-2 text-blue-800">
                      <div className="flex items-start">
                        <i className="ri-time-line mr-2 mt-1 text-blue-600"></i>
                        <span className="text-sm">We'll review your booking request within 24 hours</span>
                      </div>
                      <div className="flex items-start">
                        <i className="ri-mail-line mr-2 mt-1 text-blue-600"></i>
                        <span className="text-sm">You'll receive a confirmation email once approved</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information (desktop only) */}
                  <div className="hidden sm:block text-center mb-4">
                    <p className="text-gray-600 mb-4">
                      Questions about your booking? We're here to help!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <a 
                        href={`mailto:info@yourlodge.com?subject=${encodeURIComponent(`Booking Question - ${confirmationData.bookingId}`)}&body=${encodeURIComponent(`Hi,\\n\\nI have a question about my booking:\\n\\nBooking Reference: ${confirmationData.bookingId}\\nName: ${confirmationData.firstName} ${confirmationData.lastName}\\nEmail: ${confirmationData.email}\\n\\n`)}`}
                        className="inline-flex items-center justify-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                      >
                        <i className="ri-mail-line mr-2"></i>
                        Email Us
                      </a>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center px-8 py-3 bg-stone-600 text-white rounded-lg hover:bg-stone-700 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-home-line mr-2"></i>
                      Back to Home
                    </Link>
                    
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
