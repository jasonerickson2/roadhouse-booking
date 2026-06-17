
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Footer from '../../components/feature/Footer';
import { ROOM_HOSTEX_MAP } from '../../services/availability';
import { rooms } from '../../mocks/rooms';

declare global {
  interface Window {
    Square?: any;
  }
}

export default function SquarePaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Get booking details from URL params
  const roomId = searchParams.get('roomId') || '';
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guests = searchParams.get('guests') || '';
  const firstName = searchParams.get('firstName') || '';
  const lastName = searchParams.get('lastName') || '';
  const email = searchParams.get('email') || '';
  const phone = searchParams.get('phone') || '';
  const specialRequests = searchParams.get('specialRequests') || '';

  // Get room details
  const room = rooms.find(r => r.id === parseInt(roomId));
  const roomName = room?.name || '';

  // Calculate pricing
  const totalAmount = parseFloat(searchParams.get('totalAmount') || '0');
  const baseRate = parseFloat(searchParams.get('baseRate') || '0');
  const cleaningFee = parseFloat(searchParams.get('cleaningFee') || '0');
  const serviceFee = parseFloat(searchParams.get('serviceFee') || '0');
  
  // Parse taxes from URL
  const taxesParam = searchParams.get('taxes') || '[]';
  let taxes: Array<{ name: string; amount: number }> = [];
  try {
    taxes = JSON.parse(taxesParam);
  } catch (e) {
    console.error('Failed to parse taxes:', e);
  }

  // Get Hostex property ID for this room
  const roomIdNum = parseInt(roomId);
  const roomMapping = ROOM_HOSTEX_MAP[roomIdNum as keyof typeof ROOM_HOSTEX_MAP];
  const propertyId = roomMapping?.hostexPropertyId;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    // Parse as UTC to avoid timezone shifts
    const date = new Date(dateString + 'T00:00:00Z');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}-${day}-${year}`;
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    // Parse as UTC to avoid timezone shifts
    const checkInDate = new Date(checkIn + 'T00:00:00Z');
    const checkOutDate = new Date(checkOut + 'T00:00:00Z');
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();

  useEffect(() => {
    const initSquare = async () => {
      setIsLoading(true);
      try {
        console.log('Square: starting init, cardContainerRef.current =', cardContainerRef.current);

        if (!cardContainerRef.current) {
          console.error('Square: card container ref is null unexpectedly');
          setError('Card container not available');
          return;
        }

        // Load Square Web Payments SDK
        if (!window.Square) {
          const script = document.createElement('script');
          script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        if (!window.Square) {
          throw new Error('Square SDK failed to load');
        }

        // Initialize Square Payments with your sandbox credentials
        const paymentsInstance = await window.Square.payments(
          import.meta.env.VITE_SQUARE_APP_ID,  // Application ID
          'L0YVVDQM2REPZ'                            // Location ID
        );
        
        const cardInstance = await paymentsInstance.card({
          style: {
            '.input-container': {
              borderColor: '#d1d5db',
              borderWidth: '1px',
              borderRadius: '8px',
            },
            '.input-container.is-focus': {
              borderColor: '#d97706',
              borderWidth: '2px',
            },
            '.input-container.is-error': {
              borderColor: '#dc2626',
            },
            input: {
              fontSize: '16px',
              color: '#111827',
              fontWeight: 'normal'
            },
            '.message-text': {
              color: '#6b7280'
            },
            '.message-text.is-error': {
              color: '#dc2626'
            }
          }
        });

        await cardInstance.attach(cardContainerRef.current);
        setCard(cardInstance);
        console.log('Square: card attached successfully');

      } catch (error) {
        console.error('Square initialization error:', error);
        setError('Failed to initialize payment form. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initSquare();
  }, []);

  const handlePayment = async () => {
    if (!card) {
      setError('Payment form not ready');
      return;
    }

    if (!propertyId) {
      setError('Invalid room configuration');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Tokenize the card
      const tokenResult = await card.tokenize();
      
      if (tokenResult.status !== 'OK') {
        setError(tokenResult.errors?.[0]?.message || 'Card validation failed');
        setIsProcessing(false);
        return;
      }

      console.log('Square tokenization successful, calling booking-api authorize...');

      // Send payment authorization to Supabase booking-api
      const response = await fetch(`${import.meta.env.VITE_BOOKING_API_BASE}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: tokenResult.token,
          amount: Math.round(totalAmount * 100), // integer cents
          currency: 'USD',
          propertyId,
          roomId: roomIdNum,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guests: parseInt(guests),
          guest: {
            firstName,
            lastName,
            email,
            phone
          }
        })
      });

      const data = await response.json();
      console.log('booking-api authorize response:', data);

      if (!response.ok || !data.ok) {
        console.error('bookingAuthorize error:', data);
        setError(data.details?.message || data.error || 'Something went wrong authorizing your card. Please try again or contact us.');
        setIsProcessing(false);
        return;
      }

      // Payment authorized successfully
      console.log('Payment authorized successfully:', {
        bookingRequestId: data.bookingRequestId,
        squarePaymentId: data.squarePaymentId,
        paymentStatus: data.paymentStatus
      });

      navigate(`/confirmation?bookingId=${data.bookingRequestId}&paymentId=${data.squarePaymentId}&status=${data.paymentStatus}&roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&totalAmount=${totalAmount.toFixed(2)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`);
    } catch (error) {
      console.error('Payment error:', error);
      setError('Payment processing failed. Please try again or contact us.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen">
      
      <main className="pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
              <p className="text-gray-600">Complete your booking with Square</p>
            </div>

            {/* Booking Summary */}
            <div className="bg-stone-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Summary</h2>
              <div className="space-y-2 text-sm">
                {roomName && (
                  <div className="flex justify-between pb-2 border-b">
                    <span className="text-gray-600">Room:</span>
                    <span className="font-medium">{roomName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Guest:</span>
                  <span className="font-medium">{firstName} {lastName}</span>
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
                
                {/* Cost Breakdown */}
                {baseRate > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <div className="flex justify-between text-gray-700">
                      <span>${(baseRate / nights).toFixed(2)} × {nights} {nights === 1 ? 'night' : 'nights'}</span>
                      <span>${baseRate.toFixed(2)}</span>
                    </div>
                    {cleaningFee > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Cleaning fee</span>
                        <span>${cleaningFee.toFixed(2)}</span>
                      </div>
                    )}
                    {taxes.map((tax, index) => (
                      <div key={index} className="flex justify-between text-gray-700">
                        <span>{tax.name}</span>
                        <span>${tax.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {serviceFee > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Service fee</span>
                        <span>${serviceFee.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount:</span>
                    <span className="text-amber-600">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="mb-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Information
                </label>

                {/* Card container is ALWAYS rendered */}
                <div
                  ref={cardContainerRef}
                  id="card-container"
                  style={{
                    minHeight: '60px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '8px',
                  }}
                />

                <div id="payment-status-container" style={{ marginTop: '8px' }} />

                {/* Show loading text under the field while initializing */}
                {isLoading && (
                  <div className="mt-2 text-sm text-gray-500">
                    Initializing Square payments...
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={isProcessing || isLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-4 rounded-lg font-semibold text-lg transition-colors whitespace-nowrap flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Processing...
                  </>
                ) : (
                  `Authorize Payment - $${totalAmount.toFixed(2)}`
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Your card will only be charged after we approve your booking.
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500 mb-4">
                Your payment is secured by Square. We'll authorize the amount now and charge when you check in.
              </p>
              
              <button
                onClick={() => navigate(-1)}
                className="text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                ← Back to Payment Options
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
