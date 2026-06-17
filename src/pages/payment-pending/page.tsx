import { useSearchParams, Link } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';

export default function PaymentPendingPage() {
  const [searchParams] = useSearchParams();
  
  const pendingBookingId = searchParams.get('pendingBookingId');
  const squarePaymentId = searchParams.get('squarePaymentId');
  const roomId = searchParams.get('roomId');
  const roomName = searchParams.get('roomName');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = searchParams.get('guests');
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');
  const email = searchParams.get('email');
  const phone = searchParams.get('phone');
  const total = parseFloat(searchParams.get('total') || '0');

  if (!pendingBookingId || !squarePaymentId) {
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

  const room = rooms.find(r => r.id === parseInt(roomId || ''));

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center">
                <i className="ri-check-line"></i>
              </div>
              <span className="ml-2 font-semibold text-gray-900">Details</span>
            </div>
            <div className="w-16 h-1 bg-black"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center">
                <i className="ri-check-line"></i>
              </div>
              <span className="ml-2 font-semibold text-gray-900">Payment</span>
            </div>
            <div className="w-16 h-1 bg-black"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center">
                <i className="ri-check-line"></i>
              </div>
              <span className="ml-2 font-semibold text-gray-900">Confirmation</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-check-line text-3xl text-green-600"></i>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 font-serif">
            Payment Authorized Successfully
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Thank you! Your card has been authorized for <strong>${total.toFixed(2)}</strong>. 
            Your reservation request is now pending confirmation from our team.
          </p>

          {/* Booking Reference */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 max-w-md mx-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Booking Reference</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Booking ID:</span>
                <span className="font-mono font-medium">{pendingBookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment ID:</span>
                <span className="font-mono font-medium text-xs">{squarePaymentId}</span>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left max-w-2xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-4 flex items-center">
              <i className="ri-information-line mr-2"></i>
              What happens next?
            </h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-semibold">1</span>
                </div>
                <p>Our team will review your booking request within 24 hours</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-semibold">2</span>
                </div>
                <p>You'll receive an email confirmation once your booking is approved</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <span className="text-xs font-semibold">3</span>
                </div>
                <p>Your card will only be charged after approval - if declined, the hold will be released automatically</p>
              </div>
            </div>
          </div>

          {/* Booking Summary */}
          {room && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left max-w-2xl mx-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Booking Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Room:</span>
                  <p className="font-medium">{roomName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Guest:</span>
                  <p className="font-medium">{firstName} {lastName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Check-in:</span>
                  <p className="font-medium">{checkIn ? new Date(checkIn).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Check-out:</span>
                  <p className="font-medium">{checkOut ? new Date(checkOut).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Guests:</span>
                  <p className="font-medium">{guests}</p>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <p className="font-medium">{email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 text-left max-w-2xl mx-auto">
            <h3 className="font-semibold text-amber-900 mb-3 flex items-center">
              <i className="ri-customer-service-2-line mr-2"></i>
              Need to make changes or have questions?
            </h3>
            <div className="space-y-2 text-sm text-amber-800">
              <p>Contact us immediately if you need to modify your booking:</p>
              <div className="flex items-center">
                <i className="ri-mail-line mr-2"></i>
                <span>info@yourlodge.com</span>
              </div>
              <div className="flex items-center">
                <i className="ri-phone-line mr-2"></i>
                <span>(555) 123-4567</span>
              </div>
              <p className="text-xs mt-3">
                Please include your booking ID ({pendingBookingId}) in all correspondence.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="bg-black hover:bg-gray-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              Return to Home
            </Link>
            <button
              onClick={() => window.print()}
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              <i className="ri-printer-line mr-2"></i>
              Print Confirmation
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-8 text-xs text-gray-500 text-center">
            <p>🔒 Your payment is secured by Square's PCI DSS Level 1 encryption</p>
            <p className="mt-1">Sandbox Environment - Test Transaction</p>
          </div>
        </div>
      </div>
    </div>
  );
}