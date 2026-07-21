import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import DatePicker from '../../components/base/DatePicker';
import GuestSelector from '../../components/base/GuestSelector';
import { checkAvailability, AvailabilityService, fetchRoomCalendar, RoomCalendar } from '../../services/availability';
import BookingModal from '../../components/base/BookingModal';

export default function RoomDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get from URL params first, then fall back to sessionStorage
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    return searchParams.get('checkIn') || sessionStorage.getItem('searchCheckIn') || '';
  });
  const [checkOutDate, setCheckOutDate] = useState<string>(() => {
    return searchParams.get('checkOut') || sessionStorage.getItem('searchCheckOut') || '';
  });
  const [guests, setGuests] = useState(() => {
    const urlGuests = searchParams.get('guests');
    if (urlGuests) return parseInt(urlGuests);
    const savedGuests = sessionStorage.getItem('searchGuests');
    return savedGuests ? parseInt(savedGuests) : 2;
  });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [roomAvailabilityData, setRoomAvailabilityData] = useState<any>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [modalFocusField, setModalFocusField] = useState<'checkIn' | 'checkOut' | 'guests'>('checkIn');
  const [showFloatingBooking, setShowFloatingBooking] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showAllSkiResorts, setShowAllSkiResorts] = useState(false);
  const [showAllTowns, setShowAllTowns] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [calendar, setCalendar] = useState<RoomCalendar>({ blockedDates: new Set(), noArrivalDates: new Set(), minNightsByDate: {} });

  const room = rooms.find(r => r.id === parseInt(id || ''));

  // Load this room's live blocked-dates + min-stay calendar from Hostex (via booking-api).
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    fetchRoomCalendar(room.id).then((cal) => { if (!cancelled) setCalendar(cal); });
    return () => { cancelled = true; };
  }, [room?.id]);

  // Save to sessionStorage when dates/guests change
  useEffect(() => {
    if (checkInDate) {
      sessionStorage.setItem('searchCheckIn', checkInDate);
    }
  }, [checkInDate]);

  useEffect(() => {
    if (checkOutDate) {
      sessionStorage.setItem('searchCheckOut', checkOutDate);
    }
  }, [checkOutDate]);

  useEffect(() => {
    sessionStorage.setItem('searchGuests', guests.toString());
  }, [guests]);

  // Auto-check availability when dates are selected
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!checkInDate || !checkOutDate || !room) return;

      setIsCheckingAvailability(true);
      setAvailabilityError(null);

      try {
        const result = await AvailabilityService.checkAvailability({
          checkIn: checkInDate,
          checkOut: checkOutDate,
          guests: guests
        });

        if (result.success && result.rooms) {
          // Find this specific room in the response
          const thisRoom = result.rooms.find(r => r.roomId === room.id);
          console.log('Room availability data:', thisRoom);
          setRoomAvailabilityData(thisRoom || null);
        } else {
          setAvailabilityError(result.error || 'Unable to check availability');
          setRoomAvailabilityData(null);
        }
      } catch (error) {
        console.error('Availability check error:', error);
        setAvailabilityError('Failed to check availability');
        setRoomAvailabilityData(null);
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    fetchAvailability();
  }, [checkInDate, checkOutDate, guests, room]);

  // Handle scroll for floating booking button on mobile
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth < 1024) {
        setShowFloatingBooking(window.scrollY > 400);
      } else {
        setShowFloatingBooking(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Room not found</h1>
          <Link to="/" className="text-black hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const checkIn = new Date(checkInDate + 'T00:00:00');
    const checkOut = new Date(checkOutDate + 'T00:00:00');
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleBookNow = () => {
    if (!checkInDate || !checkOutDate) {
      alert('Please select check-in and check-out dates');
      return;
    }

    if (roomAvailabilityData && !roomAvailabilityData.isAvailable) {
      alert('This room is not available for the selected dates');
      return;
    }

    // Enforce the room's minimum-stay for the chosen check-in date (from Hostex).
    const minNights = calendar.minNightsByDate[checkInDate] || 1;
    if (nights < minNights) {
      alert(`This room requires a minimum ${minNights}-night stay for the selected dates. Please extend your stay.`);
      return;
    }

    const params = new URLSearchParams();
    params.set('roomId', room.id.toString());
    params.set('checkIn', checkInDate);
    params.set('checkOut', checkOutDate);
    params.set('guests', guests.toString());

    navigate(`/booking-flow?${params.toString()}`);
  };

  const handleSearch = (newCheckIn: string, newCheckOut: string, newGuests: number) => {
    setCheckInDate(newCheckIn);
    setCheckOutDate(newCheckOut);
    setGuests(newGuests);
  };

  const openBookingModal = (field: 'checkIn' | 'checkOut' | 'guests') => {
    setModalFocusField(field);
    setShowBookingModal(true);
  };

  const nights = calculateNights();
  
  // Get pricing from API or fallback
  const pricing = roomAvailabilityData?.pricing;
  const pricePerNight = pricing ? (pricing.baseRate / pricing.nights) : 0;
  const baseRate = pricing ? pricing.baseRate : 0;
  const cleaningFee = pricing ? pricing.cleaningFee : 0;
  const taxes = pricing ? pricing.taxes : [];
  const totalTaxAmount = taxes.reduce((sum: number, tax: any) => sum + tax.amount, 0);
  const serviceFee = pricing ? pricing.serviceFee : 0;
  const totalAmount = pricing ? pricing.totalAmount : 0;

  // Determine if we should show pricing
  const hasDatesSelected = checkInDate && checkOutDate;

  // Group nightly prices
  const getGroupedNightlyPrices = () => {
    if (!pricing || !pricing.nightlyPrices || pricing.nightlyPrices.length === 0) {
      return [];
    }

    const nightlyPrices = pricing.nightlyPrices;
    
    // If over 7 nights, show average
    if (nightlyPrices.length > 7) {
      const average = pricing.baseRate / nightlyPrices.length;
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

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Important amenities to show first (6 items)
  const importantAmenities = [
    'Kitchen',
    'WiFi',
    'Hot tub',
    'Free parking on premises',
    'Washing machine',
    'BBQ grill'
  ];

  const getDisplayedAmenities = () => {
    if (showAllAmenities) return room.amenities;
    
    const important = room.amenities.filter(a => 
      importantAmenities.some(imp => a.toLowerCase().includes(imp.toLowerCase()))
    );
    const remaining = room.amenities.filter(a => 
      !importantAmenities.some(imp => a.toLowerCase().includes(imp.toLowerCase()))
    );
    
    return [...important, ...remaining].slice(0, 6);
  };

  // Get description paragraphs
  const getDescriptionParagraphs = () => {
    const desc = room.longDescription || room.description;
    return desc.split('\n\n').filter(p => p.trim());
  };

  const getDisplayedDescription = () => {
    const paragraphs = getDescriptionParagraphs();
    if (showFullDescription || paragraphs.length <= 1) {
      return paragraphs.join('\n\n');
    }
    return paragraphs[0];
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 pb-32 lg:pb-8">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center text-black hover:text-gray-700 mb-4 sm:mb-6 transition-colors"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to all rooms
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Room Details */}
          <div className="md:col-span-2">
            {/* Image Gallery */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
              {/* Main Image */}
              <div className="relative">
                <img
                  src={room.gallery?.[selectedImageIndex] || room.image}
                  alt={room.name}
                  className="w-full h-64 sm:h-96 object-contain object-center bg-gray-100"
                />
                
                {/* Navigation Arrows */}
                {room.gallery && room.gallery.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImageIndex(prev => prev === 0 ? room.gallery!.length - 1 : prev - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                    >
                      <i className="ri-arrow-left-s-line text-xl text-gray-900"></i>
                    </button>
                    <button
                      onClick={() => setSelectedImageIndex(prev => prev === room.gallery!.length - 1 ? 0 : prev + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                    >
                      <i className="ri-arrow-right-s-line text-xl text-gray-900"></i>
                    </button>
                    
                    {/* Image Counter */}
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      {selectedImageIndex + 1} / {room.gallery.length}
                    </div>
                  </>
                )}
              </div>
              
              {/* Thumbnail Gallery */}
              {room.gallery && room.gallery.length > 1 && (
                <div className="p-4 bg-gray-50">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {room.gallery.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === index ? 'border-[#1a2e1a] ring-2 ring-[#c8d8c8]' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${room.name} - ${index + 1}`}
                          className="w-full h-full object-contain object-center bg-gray-100"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Room Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-0 font-serif">
                  {room.name}
                </h1>
                {hasDatesSelected && pricePerNight > 0 ? (
                  <div className="text-2xl sm:text-3xl font-bold text-[#1a2e1a]">
                    ${Math.round(pricePerNight)}
                    <span className="text-base sm:text-lg text-gray-600 font-normal">/night</span>
                  </div>
                ) : (
                  <div className="text-base sm:text-lg text-gray-600">
                    Select dates to view pricing
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-6 mb-6 sm:mb-8 text-sm sm:text-base text-gray-700">
                <div className="flex items-center">
                  <i className="ri-user-line mr-2 text-[#1a2e1a]"></i>
                  <span>Up to {room.guests} guests</span>
                </div>
                <div className="flex items-center">
                  <i className="ri-hotel-bed-line mr-2 text-[#1a2e1a]"></i>
                  <span>{room.beds} {room.beds === 1 ? 'bed' : 'beds'}</span>
                </div>
                <div className="flex items-center">
                  <i className="ri-door-open-line mr-2 text-[#1a2e1a]"></i>
                  <span>{room.bathrooms} {room.bathrooms === 1 ? 'bathroom' : 'bathrooms'}</span>
                </div>
              </div>

              {/* About Section */}
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">About this room</h2>
                <div className="prose max-w-none">
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                    {getDisplayedDescription()}
                  </p>
                  {getDescriptionParagraphs().length > 1 && !showFullDescription && (
                    <button
                      onClick={() => setShowFullDescription(true)}
                      className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-2 inline-flex items-center"
                    >
                      Show more...
                      <i className="ri-arrow-down-s-line ml-1"></i>
                    </button>
                  )}
                  {showFullDescription && getDescriptionParagraphs().length > 1 && (
                    <button
                      onClick={() => setShowFullDescription(false)}
                      className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-2 inline-flex items-center"
                    >
                      Show less
                      <i className="ri-arrow-up-s-line ml-1"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Highlights Section */}
              {room.highlights && room.highlights.length > 0 && (
                <div className="border-t pt-6 sm:pt-8 mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Highlights</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {room.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-10 h-10 flex items-center justify-center bg-[#e8f0e8] rounded-lg mr-4 flex-shrink-0">
                          <i className={`${highlight.icon} text-[#1a2e1a] text-xl`}></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{highlight.title}</h3>
                          <p className="text-sm text-gray-600">{highlight.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amenities Section */}
              <div className="border-t pt-6 sm:pt-8">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Amenities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {getDisplayedAmenities().map((amenity, index) => (
                    <div key={index} className="flex items-center text-sm sm:text-base text-gray-700">
                      <i className="ri-check-line text-[#1a2e1a] mr-2 sm:mr-3 text-lg"></i>
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
                {room.amenities.length > 6 && !showAllAmenities && (
                  <button
                    onClick={() => setShowAllAmenities(true)}
                    className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-4 inline-flex items-center"
                  >
                    Show more...
                    <i className="ri-arrow-down-s-line ml-1"></i>
                  </button>
                )}
                {showAllAmenities && (
                  <button
                    onClick={() => setShowAllAmenities(false)}
                    className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-4 inline-flex items-center"
                  >
                    Show less
                    <i className="ri-arrow-up-s-line ml-1"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Nearby Attractions */}
            {room.nearbyAttractions && (
              <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mt-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">Nearby Attractions</h2>
                
                {/* Ski Resorts Section */}
                {room.nearbyAttractions.skiResorts && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ski Resorts</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Destination</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-900">Drive Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllSkiResorts ? room.nearbyAttractions.skiResorts : room.nearbyAttractions.skiResorts.slice(0, 3)).map((resort, index) => (
                            <tr key={`ski-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-gray-700">{resort.name}</td>
                              <td className="py-3 px-4 text-right font-medium text-[#1a2e1a]">{resort.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {room.nearbyAttractions.skiResorts.length > 3 && !showAllSkiResorts && (
                      <button
                        onClick={() => setShowAllSkiResorts(true)}
                        className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-3 inline-flex items-center"
                      >
                        Show more...
                        <i className="ri-arrow-down-s-line ml-1"></i>
                      </button>
                    )}
                    {showAllSkiResorts && (
                      <button
                        onClick={() => setShowAllSkiResorts(false)}
                        className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-3 inline-flex items-center"
                      >
                        Show less
                        <i className="ri-arrow-up-s-line ml-1"></i>
                      </button>
                    )}
                  </div>
                )}

                {/* Towns/Cities Section */}
                {room.nearbyAttractions.towns && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Towns/Cities</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Destination</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-900">Drive Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllTowns ? room.nearbyAttractions.towns : room.nearbyAttractions.towns.slice(0, 4)).map((town, index) => (
                            <tr key={`town-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-gray-700">{town.name}</td>
                              <td className="py-3 px-4 text-right font-medium text-[#1a2e1a]">{town.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {room.nearbyAttractions.towns.length > 4 && !showAllTowns && (
                      <button
                        onClick={() => setShowAllTowns(true)}
                        className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-3 inline-flex items-center"
                      >
                        Show more...
                        <i className="ri-arrow-down-s-line ml-1"></i>
                      </button>
                    )}
                    {showAllTowns && (
                      <button
                        onClick={() => setShowAllTowns(false)}
                        className="text-[#1a2e1a] hover:text-[#2a4e2a] font-medium mt-3 inline-flex items-center"
                      >
                        Show less
                        <i className="ri-arrow-up-s-line ml-1"></i>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Booking Card - Sticky on Desktop */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:sticky md:top-24">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Book Your Stay</h3>

              <div className="space-y-4 mb-6">
                <div onClick={() => openBookingModal('checkIn')} className="cursor-pointer">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in
                  </label>
                  <div className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors text-base sm:text-sm">
                    {checkInDate ? new Date(checkInDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                  </div>
                </div>

                <div onClick={() => openBookingModal('checkOut')} className="cursor-pointer">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out
                  </label>
                  <div className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors text-base sm:text-sm">
                    {checkOutDate ? new Date(checkOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                  </div>
                </div>

                <div onClick={() => openBookingModal('guests')} className="cursor-pointer">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guests
                  </label>
                  <div className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors text-base sm:text-sm">
                    {guests} {guests === 1 ? 'guest' : 'guests'}
                  </div>
                </div>
              </div>

              {/* Availability Status */}
              {checkInDate && checkOutDate && (
                <div className="mb-6">
                  {isCheckingAvailability ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center text-blue-800">
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        <span className="text-sm font-medium">Checking availability...</span>
                      </div>
                    </div>
                  ) : availabilityError ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start text-yellow-800">
                        <i className="ri-error-warning-line mr-2 mt-0.5"></i>
                        <div>
                          <span className="text-sm font-medium block">Unable to verify availability</span>
                          <span className="text-xs text-yellow-700">{availabilityError}</span>
                        </div>
                      </div>
                    </div>
                  ) : roomAvailabilityData ? (
                    roomAvailabilityData.isAvailable ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-800">
                          <i className="ri-checkbox-circle-line mr-2"></i>
                          <span className="text-sm font-medium">Available for your dates!</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-800">
                          <i className="ri-close-circle-line mr-2"></i>
                          <span className="text-sm font-medium">Not available for selected dates</span>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              )}

              {nights > 0 && pricing && (
                <div className="bg-gray-50 p-4 sm:p-6 rounded-lg mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Price Breakdown</h3>
                  <div className="space-y-2 text-sm">
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
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold text-base sm:text-lg">
                      <span>Total</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleBookNow}
                disabled={!checkInDate || !checkOutDate || isCheckingAvailability || (roomAvailabilityData && !roomAvailabilityData.isAvailable)}
                className="w-full bg-[#1a2e1a] hover:bg-[#2a4e2a] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors whitespace-nowrap hidden lg:block"
              >
                {isCheckingAvailability ? 'Checking...' : 'Book Now'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4 hidden lg:block">
                You won't be charged yet
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Booking Button - Mobile Only */}
      {showFloatingBooking && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl z-40 lg:hidden">
          <div className="max-w-7xl mx-auto">
            {/* Dates and Pricing Info */}
            <div className="mb-3">
              {checkInDate && checkOutDate ? (
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center text-gray-700">
                    <i className="ri-calendar-line mr-2 text-[#1a2e1a]"></i>
                    <span>
                      {new Date(checkInDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(checkOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {nights} {nights === 1 ? 'night' : 'nights'}
                  </div>
                </div>
              ) : null}
              
              <div className="flex items-center justify-between">
                <div>
                  {hasDatesSelected && pricePerNight > 0 ? (
                    <div>
                      <div className="text-xl font-bold text-[#1a2e1a]">
                        ${Math.round(pricePerNight)}
                        <span className="text-sm text-gray-600 font-normal">/night</span>
                      </div>
                      {nights > 0 && totalAmount > 0 && (
                        <div className="text-xs text-gray-600">
                          ${totalAmount.toFixed(2)} total
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">Select dates</div>
                  )}
                </div>
                <button
                  onClick={handleBookNow}
                  disabled={!checkInDate || !checkOutDate || isCheckingAvailability || (roomAvailabilityData && !roomAvailabilityData.isAvailable)}
                  className="bg-[#1a2e1a] hover:bg-[#2a4e2a] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  {isCheckingAvailability ? 'Checking...' : 'Book Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        checkIn={checkInDate}
        checkOut={checkOutDate}
        guests={guests}
        onSearch={handleSearch}
        focusField={modalFocusField}
        blockedDates={calendar.blockedDates}
        noArrivalDates={calendar.noArrivalDates}
        minNightsByDate={calendar.minNightsByDate}
      />
    </div>
  );
}
