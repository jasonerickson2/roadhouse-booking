import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BookingModal from '../../components/base/BookingModal';
import { rooms } from '../../mocks/rooms';
import { AvailabilityService, fetchRoomCalendar, RoomCalendar } from '../../services/availability';

interface AvailabilityRoom {
  roomId: number;  // Changed from string to number
  name: string;
  hostexPropertyId: number;
  isAvailable: boolean;
  pricing: {
    currency: string;
    nights: number;
    nightlyPrices: number[];
    baseRate: number;
    cleaningFee: number;
    taxes: Array<{
      name: string;
      amount: number;
    }>;
    serviceFee: number;
    totalAmount: number;
  } | null;
}

export default function HomePage() {
  const navigate = useNavigate();
  // Initialize from sessionStorage if available
  const [checkIn, setCheckIn] = useState<string>(() => {
    return sessionStorage.getItem('searchCheckIn') || '';
  });
  const [checkOut, setCheckOut] = useState<string>(() => {
    return sessionStorage.getItem('searchCheckOut') || '';
  });
  const [guests, setGuests] = useState(() => {
    const saved = sessionStorage.getItem('searchGuests');
    return saved ? parseInt(saved) : 2;
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<AvailabilityRoom[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [availRoomId, setAvailRoomId] = useState<number | null>(null);
  const [availCal, setAvailCal] = useState<RoomCalendar>({ blockedDates: new Set(), noArrivalDates: new Set(), minNightsByDate: {} });
  const [availOpen, setAvailOpen] = useState(false);
  const roomsSectionRef = useRef<HTMLDivElement>(null);

  // Save to sessionStorage whenever values change
  useEffect(() => {
    if (checkIn) {
      sessionStorage.setItem('searchCheckIn', checkIn);
    }
  }, [checkIn]);

  useEffect(() => {
    if (checkOut) {
      sessionStorage.setItem('searchCheckOut', checkOut);
    }
  }, [checkOut]);

  useEffect(() => {
    sessionStorage.setItem('searchGuests', guests.toString());
  }, [guests]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Parse as UTC to avoid timezone shifts
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  const handleBookingSearch = (newCheckIn: string, newCheckOut: string, newGuests: number) => {
    setCheckIn(newCheckIn);
    setCheckOut(newCheckOut);
    setGuests(newGuests);
    
    // Trigger search after state updates
    setTimeout(() => {
      handleSearchWithParams(newCheckIn, newCheckOut, newGuests);
    }, 0);
  };

  // Open a per-room availability calendar (booked dates blocked, open dates selectable).
  const openRoomAvailability = async (roomId: number) => {
    setAvailRoomId(roomId);
    setAvailCal({ blockedDates: new Set(), noArrivalDates: new Set(), minNightsByDate: {} });
    setAvailOpen(true);
    try {
      const cal = await fetchRoomCalendar(roomId);
      setAvailCal(cal);
    } catch (e) {
      console.error('room availability fetch failed', e);
    }
  };

  // Guest picked open dates in that room's calendar -> jump straight into booking it.
  const handleAvailabilityPick = (ci: string, co: string, g: number) => {
    setAvailOpen(false);
    if (availRoomId != null) {
      navigate(`/room/${availRoomId}?checkIn=${ci}&checkOut=${co}&guests=${g}`);
    }
  };

  const handleSearchWithParams = async (searchCheckIn: string, searchCheckOut: string, searchGuests: number) => {
    if (searchCheckIn && searchCheckOut) {
      setIsLoading(true);
      setErrorMessage('');
      try {
        console.log('🔍 Checking availability with:', { checkIn: searchCheckIn, checkOut: searchCheckOut, guests: searchGuests });
        
        const result = await AvailabilityService.checkAvailability({
          checkIn: searchCheckIn,
          checkOut: searchCheckOut,
          guests: searchGuests
        });

        console.log('✅ Availability result:', result);

        if (!result.success) {
          throw new Error(result.error || 'Failed to check availability');
        }

        console.log(`✅ Successfully loaded ${result.rooms.length} rooms`);
        console.log('Room availability details:', result.rooms.map(r => ({
          roomId: r.roomId,
          name: r.name,
          available: r.isAvailable,
          pricing: r.pricing
        })));
        
        setAvailabilityData(result.rooms);
        setHasSearched(true);
        
        // Scroll to rooms section after search completes
        setTimeout(() => {
          roomsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (error) {
        console.error('❌ Error fetching availability:', error);
        
        let errorMsg = 'Failed to check availability. Please try again.';
        
        if (error instanceof Error) {
          errorMsg = error.message;
        }
        
        setErrorMessage(errorMsg);
        setHasSearched(true);
        setAvailabilityData([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSearch = async () => {
    await handleSearchWithParams(checkIn, checkOut, guests);
  };

  const isRoomAvailable = (roomId: number) => {
    if (!hasSearched || availabilityData.length === 0) {
      return false;
    }
    
    // roomId is now a number in the API response
    const availRoom = availabilityData.find(r => r.roomId === roomId);
    console.log(`🔍 Checking availability for room ${roomId}:`, availRoom);
    return availRoom?.isAvailable || false;
  };

  const getRoomPricePerNight = (roomId: number) => {
    if (!hasSearched || availabilityData.length === 0) {
      const room = rooms.find(r => r.id === roomId);
      return room?.price || 0;
    }
    
    // roomId is now a number in the API response
    const availRoom = availabilityData.find(r => r.roomId === roomId);
    
    // Calculate average price per night from baseRate
    if (availRoom?.pricing && availRoom.pricing.nights > 0) {
      const avgPerNight = availRoom.pricing.baseRate / availRoom.pricing.nights;
      console.log(`💰 Room ${roomId} price: $${avgPerNight}/night (baseRate: ${availRoom.pricing.baseRate}, nights: ${availRoom.pricing.nights})`);
      return Math.round(avgPerNight);
    }
    
    return 0;
  };

  const formatSearchParams = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    params.set('guests', guests.toString());
    return params.toString();
  };

  // Only show prices if user has searched AND has valid dates
  const shouldShowPrices = hasSearched && checkIn && checkOut;

  // Filter rooms based on guest capacity when search has been performed
  const filteredRooms = shouldShowPrices 
    ? rooms.filter(room => room.guests >= guests)
    : rooms;

  // Sort rooms: available first, then unavailable
  const sortedRooms = shouldShowPrices
    ? [...filteredRooms].sort((a, b) => {
        const aAvailable = isRoomAvailable(a.id);
        const bAvailable = isRoomAvailable(b.id);
        if (aAvailable && !bAvailable) return -1;
        if (!aAvailable && bAvailable) return 1;
        return 0;
      })
    : filteredRooms;

  return (
    <div className="min-h-screen">
      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        onSearch={handleBookingSearch}
      />

      {/* Per-room availability calendar (opened from an unavailable room card) */}
      <BookingModal
        isOpen={availOpen}
        onClose={() => setAvailOpen(false)}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        onSearch={handleAvailabilityPick}
        blockedDates={availCal.blockedDates}
        noArrivalDates={availCal.noArrivalDates}
        minNightsByDate={availCal.minNightsByDate}
      />

      {/* Hero Section */}
      <div className="relative min-h-[55vh] sm:h-[55vh] md:h-[60vh]">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://static.readdy.ai/image/2d0d20f832106674f714e5a5c924f53b/325666414111d5bf848a4c9ea0d70fd7.jpeg')`
          }}
        >
        </div>
        
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>
        
        <div className="relative z-10 flex flex-col h-full text-white px-4 justify-end pb-8 sm:pb-12">
          {/* Hero Text - Just Above Search Box */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 sm:mb-6 leading-tight uppercase tracking-wide" style={{ fontFamily: '"Alfa Slab One", cursive' }}>
              Colorado's Best Kept Secret
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto px-4">
              Stay where the mountains meet the lake. Book direct and unwind in the heart of Colorado.
            </p>
          </div>
          
          {/* Search Bar - Bottom of Hero */}
          <div>
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-4xl w-full mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Check-in Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(true)}
                    className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-black focus:border-transparent bg-white hover:border-gray-400 transition-colors text-base sm:text-sm text-gray-900"
                  >
                    {checkIn ? formatDisplayDate(checkIn) : 'Select check-in'}
                  </button>
                </div>

                {/* Check-out Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(true)}
                    className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-black focus:border-transparent bg-white hover:border-gray-400 transition-colors text-base sm:text-sm text-gray-900"
                  >
                    {checkOut ? formatDisplayDate(checkOut) : 'Select check-out'}
                  </button>
                </div>

                {/* Guests Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guests
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(true)}
                    className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-black focus:border-transparent bg-white hover:border-gray-400 transition-colors text-base sm:text-sm text-gray-900"
                  >
                    {guests} {guests === 1 ? 'guest' : 'guests'}
                  </button>
                </div>

                <div className="flex items-end sm:col-span-2 lg:col-span-1">
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="w-full text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer" style={{ backgroundColor: '#1a2e1a' }}
                  >
                    {isLoading ? 'Searching...' : 'Search Availability'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
            <div className="flex items-start">
              <i className="ri-error-warning-line text-2xl text-red-500 mr-4"></i>
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Check Availability</h3>
                <p className="text-red-700">{errorMessage}</p>
                <p className="text-red-600 text-sm mt-2">Please try again or contact us directly for assistance.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Alert */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
            <div className="flex items-center">
              <i className="ri-loader-4-line animate-spin text-2xl text-blue-500 mr-4"></i>
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Checking Availability</h3>
                <p className="text-blue-700">Please wait while we search for available rooms...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Section */}
      <div ref={roomsSectionRef} className="max-w-7xl mx-auto px-4 py-8 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 font-serif">
            {shouldShowPrices ? 'Available Rooms' : 'Rooms'}
          </h2>
          {!shouldShowPrices && (
            <p className="text-base sm:text-lg text-gray-600">
              Enter your dates to view pricing and availability
            </p>
          )}
          {shouldShowPrices && filteredRooms.length < rooms.length && (
            <p className="text-base sm:text-lg text-gray-600">
              Showing {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} that can accommodate {guests} guest{guests !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {shouldShowPrices && (
          <div className="mb-6 sm:mb-8 text-center">
            <button
              onClick={() => {
                setHasSearched(false);
                setCheckIn('');
                setCheckOut('');
                setAvailabilityData([]);
                setErrorMessage('');
              }}
              className="text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap" style={{ backgroundColor: '#1a2e1a' }}
            >
              Check Other Dates
            </button>
          </div>
        )}

        {filteredRooms.length === 0 && shouldShowPrices && (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <i className="ri-home-line text-6xl text-gray-400 mb-4"></i>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">No rooms available</h3>
              <p className="text-gray-600 mb-6">
                No rooms can accommodate {guests} guest{guests !== 1 ? 's' : ''} for your selected dates.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  disabled={guests <= 1}
                  className="w-full sm:w-auto bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  Try with {Math.max(1, guests - 1)} guest{Math.max(1, guests - 1) !== 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => {
                    setHasSearched(false);
                    setCheckIn('');
                    setCheckOut('');
                    setAvailabilityData([]);
                    setErrorMessage('');
                  }}
                  className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap ml-0 sm:ml-4"
                >
                  Try different dates
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 sm:space-y-8">
          {sortedRooms.map((room) => {
            const available = shouldShowPrices && isRoomAvailable(room.id);
            const roomPrice = getRoomPricePerNight(room.id);
            
            return (
              <div
                key={room.id}
                className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 border border-[#e8ddd3] ${
                  shouldShowPrices && !available ? 'opacity-70' : 'hover:shadow-xl'
                }`}
              >
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-1/2">
                    <Link
                      to={`/room/${room.id}?${formatSearchParams()}`}
                      className="block cursor-pointer"
                    >
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-full h-64 sm:h-80 lg:h-full object-cover hover:opacity-90 transition-opacity"
                      />
                    </Link>
                  </div>
                  
                  <div className="lg:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 font-serif">
                        {room.name}
                      </h3>
                      <p className="text-gray-600 mb-4 text-sm sm:text-base">{room.description}</p>
                      
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 mb-6 text-sm sm:text-base">
                        <span className="flex items-center text-gray-700">
                          <i className="ri-group-line mr-2"></i>
                          {room.guests} guests
                        </span>
                        <span className="flex items-center text-gray-700">
                          <i className="ri-hotel-bed-line mr-2"></i>
                          {room.bedrooms} bedroom{room.bedrooms > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center text-gray-700">
                          <i className="ri-home-line mr-2"></i>
                          {room.beds} bed{room.beds > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center text-gray-700">
                          <i className="ri-water-percent-line mr-2"></i>
                          {room.bathrooms} bath{room.bathrooms > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                        {room.amenities.slice(0, 4).map((amenity) => (
                          <span
                            key={amenity}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="order-2 sm:order-1">
                        {shouldShowPrices ? (
                          available ? (
                            <div>
                              <span className="text-xl sm:text-2xl font-bold text-gray-900">
                                ${roomPrice}
                              </span>
                              <span className="text-gray-600 text-sm sm:text-base"> / night</span>
                            </div>
                          ) : (
                            <p className="text-gray-600 text-sm sm:text-base">
                              Not available for selected dates
                            </p>
                          )
                        ) : (
                          <p className="text-gray-600 text-sm sm:text-base">
                            Enter your dates to view pricing and availability
                          </p>
                        )}
                      </div>
                      
                      {available ? (
                        <Link
                          to={`/room/${room.id}?${formatSearchParams()}`}
                          className="order-1 sm:order-2 w-full sm:w-auto text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center" style={{ backgroundColor: '#1a2e1a' }}
                        >
                          View Details
                        </Link>
                      ) : shouldShowPrices ? (
                        <div className="order-1 sm:order-2 w-full sm:w-auto flex flex-col items-stretch gap-1.5">
                          <div className="bg-gray-200 text-gray-600 px-6 py-3 rounded-lg font-semibold whitespace-nowrap text-center">
                            Unavailable
                          </div>
                          <button
                            onClick={() => openRoomAvailability(room.id)}
                            className="text-sm font-semibold underline whitespace-nowrap text-center hover:opacity-70"
                            style={{ color: '#1a2e1a' }}
                          >
                            See available dates
                          </button>
                        </div>
                      ) : (
                        <Link
                          to={`/room/${room.id}?${formatSearchParams()}`}
                          className="order-1 sm:order-2 w-full sm:w-auto text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center" style={{ backgroundColor: '#1a2e1a' }}
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
