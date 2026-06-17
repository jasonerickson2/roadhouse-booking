import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import { AvailabilityService } from '../../services/availability';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [pricingData, setPricingData] = useState<any>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);

  const roomId = searchParams.get('roomId');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = parseInt(searchParams.get('guests') || '2');
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');
  const email = searchParams.get('email');
  const phone = searchParams.get('phone');
  const specialRequests = searchParams.get('specialRequests');

  const room = rooms.find(r => r.id === parseInt(roomId || ''));

  // Fetch pricing data from API
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
          if (thisRoom && thisRoom.pricing) {
            setPricingData(thisRoom.pricing);
          }
        }
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      } finally {
        setIsLoadingPricing(false);
      }
    };

    fetchPricing();
  }, [checkIn, checkOut, guests, room]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!room || !checkIn || !checkOut || !firstName || !lastName || !email || !phone) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Payment information missing</h1>
          <Link to="/" className="text-black hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const calculateNights = () => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();

  // Get pricing from API data
  const pricePerNight = pricingData ? (pricingData.baseRate / pricingData.nights) : room.price;
  const baseRate = pricingData ? pricingData.baseRate : (room.price * nights);
  const cleaningFee = pricingData ? pricingData.cleaningFee : 0;
  const taxes = pricingData ? pricingData.taxes : [];
  const serviceFee = pricingData ? pricingData.serviceFee : 0;
  const totalAmount = pricingData ? pricingData.totalAmount : 0;

  // Group nightly prices
  const getGroupedNightlyPrices = () => {
    if (!pricingData || !pricingData.nightlyPrices || pricingData.nightlyPrices.length === 0) {
      return [];
    }

    const nightlyPrices = pricingData.nightlyPrices;
    
    // If over 7 nights, show average
    if (nightlyPrices.length > 7) {
      const average = pricingData.baseRate / nightlyPrices.length;
      return [{
        rate: Math.round(average),
        count: nightlyPrices.length
      }];
    }

    // Group consecutive nights with same rate
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

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Navigate to Square payment page with all booking data
    const params = new URLSearchParams();
    params.set('roomId', roomId || '');
    params.set('checkIn', checkIn || '');
    params.set('checkOut', checkOut || '');
    params.set('guests', guests.toString());
    params.set('firstName', firstName || '');
    params.set('lastName', lastName || '');
    params.set('email', email || '');
    params.set('phone', phone || '');
    params.set('totalAmount', totalAmount.toFixed(2));
    if (specialRequests) params.set('specialRequests', specialRequests);

    navigate(`/square-payment?${params.toString()}`);
  };

  const handleSquarePayment = () => {
    const params = new URLSearchParams();
    params.set('roomId', roomId);
    params.set('checkIn', checkIn);
    params.set('checkOut', checkOut);
    params.set('guests', guests.toString());
    params.set('firstName', firstName);
    params.set('lastName', lastName);
    params.set('email', email);
    params.set('phone', phone);
    if (specialRequests) params.set('specialRequests', specialRequests);
    params.set('totalAmount', totalAmount.toFixed(2));
    
    // Add cost breakdown
    if (pricingData) {
      params.set('baseRate', pricingData.baseRate.toFixed(2));
      params.set('cleaningFee', pricingData.cleaningFee.toFixed(2));
      params.set('serviceFee', pricingData.serviceFee.toFixed(2));
      params.set('taxes', JSON.stringify(pricingData.taxes));
    }

    navigate(`/square-payment?${params.toString()}`);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center text-black hover:text-gray-700 mb-4 sm:mb-6 transition-colors"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to guest details
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Mobile: Booking Summary First */}
          <div className="lg:hidden">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Reservation Summary</h2>
                <button
                  onClick={handleBack}
                  className="text-green-600 hover:text-green-700 font-medium text-sm"
                >
                  Edit
                </button>
              </div>

              {/* Room Image */}
              <div className="mb-6">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-48 object-contain object-center bg-gray-100 rounded-lg"
                />
              </div>

              {/* Room Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{room.name}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <i className="ri-calendar-line mr-2 text-green-600"></i>
                    <span>
                      {new Date(checkInDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(checkOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-moon-line mr-2 text-green-600"></i>
                    <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-user-line mr-2 text-green-600"></i>
                    <span>{guests} {guests === 1 ? 'guest' : 'guests'}</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-4">Price Breakdown</h3>
                <div className="space-y-2 text-sm">
                  {getGroupedNightlyPrices().map((group, index) => (
                    <div key={index} className="flex justify-between">
                      <span>${group.rate} × {group.count} {group.count === 1 ? 'night' : 'nights'}</span>
                      <span>${(group.rate * group.count).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Cleaning fee</span>
                    <span>${cleaningFee.toFixed(2)}</span>
                  </div>
                  {taxes.map((tax, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{tax.name}</span>
                      <span>${tax.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Service fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Secure Payment</h1>

              {/* Guest Info Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-2">Guest Information</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Name:</strong> {guestInfo.firstName} {guestInfo.lastName}</p>
                  <p><strong>Email:</strong> {guestInfo.email}</p>
                  <p><strong>Phone:</strong> {guestInfo.phone}</p>
                  {guestInfo.specialRequests && (
                    <p><strong>Special Requests:</strong> {guestInfo.specialRequests}</p>
                  )}
                </div>
              </div>

              {/* Square Payment Form */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Information
                </label>
                <div id="card-container" className="border border-gray-300 rounded-lg p-4 bg-white min-h-[100px]"></div>
                {cardError && (
                  <p className="text-red-600 text-sm mt-2">{cardError}</p>
                )}
              </div>

              {/* Terms */}
              <div className="mb-6">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 mr-3 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the cancellation policy and terms of service
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing || !agreedToTerms}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition-colors whitespace-nowrap"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Processing...
                  </span>
                ) : (
                  `Pay $${totalAmount.toFixed(2)}`
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Your payment is secure and encrypted
              </p>
            </div>
          </div>

          {/* Desktop: Booking Summary Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Reservation Summary</h2>
                <button
                  onClick={handleBack}
                  className="text-green-600 hover:text-green-700 font-medium text-sm"
                >
                  Edit
                </button>
              </div>

              {/* Room Image */}
              <div className="mb-6">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-48 object-contain object-center bg-gray-100 rounded-lg"
                />
              </div>

              {/* Room Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{room.name}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <i className="ri-calendar-line mr-2 text-green-600"></i>
                    <span>
                      {new Date(checkInDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(checkOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-moon-line mr-2 text-green-600"></i>
                    <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-user-line mr-2 text-green-600"></i>
                    <span>{guests} {guests === 1 ? 'guest' : 'guests'}</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-4">Price Breakdown</h3>
                <div className="space-y-2 text-sm">
                  {getGroupedNightlyPrices().map((group, index) => (
                    <div key={index} className="flex justify-between">
                      <span>${group.rate} × {group.count} {group.count === 1 ? 'night' : 'nights'}</span>
                      <span>${(group.rate * group.count).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Cleaning fee</span>
                    <span>${cleaningFee.toFixed(2)}</span>
                  </div>
                  {taxes.map((tax, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{tax.name}</span>
                      <span>${tax.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Service fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}