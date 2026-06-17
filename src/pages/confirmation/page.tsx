import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Footer from '../../components/feature/Footer';
import { rooms } from '../../mocks/rooms';

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const [deviceType, setDeviceType] = useState<'mobile' | 'mac' | 'windows'>('windows');
  
  const bookingId = searchParams.get('bookingId') || searchParams.get('reservationId') || '';
  const status = searchParams.get('status') || 'pending_approval';
  const roomId = searchParams.get('roomId') || '';
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guests = searchParams.get('guests') || '2';
  const totalAmount = searchParams.get('totalAmount') || '0';
  const firstName = decodeURIComponent(searchParams.get('firstName') || '');
  const lastName = decodeURIComponent(searchParams.get('lastName') || '');
  const email = decodeURIComponent(searchParams.get('email') || '');
  const phone = decodeURIComponent(searchParams.get('phone') || '');

  // Get room name from roomId
  const room = rooms.find(r => r.id === parseInt(roomId));
  const roomName = room?.name || searchParams.get('roomName') || '';

  // Detect device type
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent);
    const isMac = /macintosh|mac os x/i.test(userAgent);
    
    if (isMobile) {
      setDeviceType('mobile');
    } else if (isMac) {
      setDeviceType('mac');
    } else {
      setDeviceType('windows');
    }
  }, []);

  // Redirect to home if missing required data
  useEffect(() => {
    if (!bookingId) {
      // Don't redirect immediately - give time for params to load
      const timer = setTimeout(() => {
        if (!bookingId) {
          window.location.href = '/';
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bookingId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const emailSubject = `Booking Question - ${bookingId}`;
  const emailBody = `Hi,\n\nI have a question about my booking:\n\nBooking Reference: ${bookingId}\nName: ${firstName} ${lastName}\nEmail: ${email}\n\n`;
  const mailtoLink = `mailto:info@yourlodge.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const smsLink = `sms:5555555555`;

  return (
    <div className="min-h-screen">
      <main className="pt-8 pb-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-check-line text-3xl text-green-600"></i>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Booking Request Submitted!
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Your payment has been authorized and your request is pending review. We'll confirm your booking shortly.
            </p>

            {/* Reservation Details */}
            <div className="bg-stone-50 rounded-lg p-6 mb-8 text-left">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">Reservation Details</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    Pending Approval
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{firstName} {lastName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{email}</span>
                </div>
                
                <div className="border-t pt-3 mt-4">
                  {roomName && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Room:</span>
                      <span className="font-medium">{roomName}</span>
                    </div>
                  )}
                  
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

            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">What happens next?</h3>
              <div className="text-left space-y-2 text-blue-800">
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

            {/* Contact Information */}
            <div className="text-center mb-8">
              <p className="text-gray-600 mb-4">
                Questions about your booking? We're here to help!
              </p>
              <div className={`flex flex-col sm:flex-row gap-4 ${deviceType === 'windows' ? 'justify-center' : 'justify-center'}`}>
                <a 
                  href={mailtoLink}
                  className="inline-flex items-center justify-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  <i className="ri-mail-line mr-2"></i>
                  Email Us
                </a>
                {(deviceType === 'mobile' || deviceType === 'mac') && (
                  <a 
                    href={smsLink}
                    className="inline-flex items-center justify-center px-6 py-3 border border-amber-600 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-message-3-line mr-2"></i>
                    Text Us
                  </a>
                )}
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
              
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center px-8 py-3 border border-stone-600 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap"
              >
                <i className="ri-printer-line mr-2"></i>
                Print Confirmation
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
