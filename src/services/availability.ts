
export const ROOM_HOSTEX_MAP = {
  6: {
    name: "Room 1",
    hostexPropertyId: 12098447,
    bookingSiteListingId: "107019-12175",
    airbnbListingId: "866107816563335529",
    cleaningFee: 30,
  },
  5: {
    name: "Room 2",
    hostexPropertyId: 12098448,
    bookingSiteListingId: "107020-12175",
    airbnbListingId: "866136643987050990",
    cleaningFee: 30,
  },
  4: {
    name: "Room 3",
    hostexPropertyId: 12098449,
    bookingSiteListingId: "107021-12175",
    airbnbListingId: "992966412327307254",
    cleaningFee: 30,
  },
  3: {
    name: "Carriage House",
    hostexPropertyId: 12098451,
    bookingSiteListingId: "107023-12175",
    airbnbListingId: "866156911055760694",
    cleaningFee: 30,
  },
  2: {
    name: "Penthouse",
    hostexPropertyId: 12098452,
    bookingSiteListingId: "107024-12175",
    airbnbListingId: "866145221595061984",
    cleaningFee: 50,
  },
  1: {
    name: "Grizzly Maze",
    hostexPropertyId: 12098453,
    bookingSiteListingId: "107025-12175",
    airbnbListingId: "52654535",
    cleaningFee: 350,
  },
};

export interface AvailabilityRequest {
  checkIn: string;
  checkOut: string;
  guests: number;
  roomIds?: number[];
}

export interface RoomAvailability {
  roomId: number;
  name: string;
  hostexPropertyId: number;
  isAvailable: boolean;
  pricing?: {
    currency: string;
    nights: number;
    nightlyPrices: number[];
    baseRate: number;
    cleaningFee: number;
    taxes: Array<{ name: string; amount: number }>;
    serviceFee: number;
    totalAmount: number;
  };
}

export interface AvailabilityResponse {
  success: boolean;
  rooms: RoomAvailability[];
  error?: string;
}

// Supabase booking API base URL
const BOOKING_API_BASE = import.meta.env.VITE_BOOKING_API_BASE;

// Check if running on production origins (allow Netlify + custom domains)
function isProdOrigin(): boolean {
  const origin = window.location.origin;
  return (
    origin === 'https://onlinebooking.roadhousetwinlakes.com' ||
    origin === 'https://roadhousetwinlakes.com' ||
    origin === 'https://www.roadhousetwinlakes.com' ||
    origin.includes('netlify.app') ||
    origin.includes('localhost')
  );
}

// Generate mock availability data for preview
function generateMockAvailability(request: AvailabilityRequest): AvailabilityResponse {
  const { checkIn, checkOut } = request;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  const mockRooms: RoomAvailability[] = Object.entries(ROOM_HOSTEX_MAP).map(([roomId, info]) => {
    const baseRate = nights * 150; // Mock $150/night
    const cleaningFee = info.cleaningFee;
    
    // Calculate taxable base (baseRate + cleaningFee)
    const taxableBase = baseRate + cleaningFee;
    
    // Calculate taxes based on taxableBase
    const coTax = taxableBase * 0.029; // Colorado State Sales Tax 2.9%
    const lakeTax = taxableBase * 0.04; // Lake County Sales Tax 4.0%
    const lodgeTax = taxableBase * 0.019; // Lodging Tax 1.9%
    
    const taxes = [
      { name: 'Colorado State Sales Tax (2.9%)', amount: coTax },
      { name: 'Lake County Sales Tax (4.0%)', amount: lakeTax },
      { name: 'Lodging Tax (1.9%)', amount: lodgeTax }
    ];
    
    const taxTotal = coTax + lakeTax + lodgeTax;
    
    // Service fee 2.0% on taxableBase
    const serviceFee = taxableBase * 0.02;
    
    const totalAmount = baseRate + cleaningFee + taxTotal + serviceFee;

    return {
      roomId: Number(roomId),
      name: info.name,
      hostexPropertyId: info.hostexPropertyId,
      isAvailable: true, // Mock all as available
      pricing: {
        currency: 'USD',
        nights,
        nightlyPrices: Array(nights).fill(150),
        baseRate,
        cleaningFee,
        taxes,
        serviceFee,
        totalAmount
      }
    };
  });

  return {
    success: true,
    rooms: mockRooms
  };
}

export class AvailabilityService {
  static async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    // Check if running on production origin
    if (!isProdOrigin()) {
      console.warn('⚠️ Preview mode detected - using mock availability data');
      console.warn('💡 Live availability only works on published site: roadhousetwinlakes.com');
      
      // Return mock data for preview - simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return generateMockAvailability(request);
    }

    try {
      const { checkIn, checkOut, guests } = request;
      
      // Call Supabase booking-api edge function
      const response = await fetch(`${BOOKING_API_BASE}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkIn,   // 'YYYY-MM-DD'
          checkOut,  // 'YYYY-MM-DD'
          guests     // integer
        })
      });

      if (!response.ok) {
        throw new Error(`Availability API failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: data.success ?? true,
        rooms: data.rooms || []
      };
      
    } catch (error) {
      console.error('Availability check failed:', error);
      
      return {
        success: false,
        rooms: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Helper function for single room availability check
export async function checkAvailability(
  checkIn: string,
  checkOut: string,
  roomId: number
): Promise<{
  success: boolean;
  data?: {
    available: boolean;
    totalPrice?: number;
    nights?: number;
  };
  error?: string;
}> {
  try {
    const result = await AvailabilityService.checkAvailability({
      checkIn,
      checkOut,
      guests: 2, // Default guests for availability check
      roomIds: [roomId]
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to check availability'
      };
    }

    // Find the room in the response
    const roomData = result.rooms.find(r => r.roomId === roomId);
    
    if (!roomData) {
      return {
        success: false,
        error: 'Room not found in availability response'
      };
    }

    return {
      success: true,
      data: {
        available: roomData.isAvailable,
        totalPrice: roomData.pricing?.totalAmount,
        nights: roomData.pricing?.nights
      }
    };
  } catch (error) {
    console.error('Availability check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}


// ---------------------------------------------------------------------------
// Per-room calendar (blocked dates + day-of-week-aware min-stay) from Hostex,
// served by booking-api GET /calendar?roomId=N. Data-driven, no hardcoding.
// ---------------------------------------------------------------------------
export interface RoomCalendar {
  blockedDates: Set<string>;             // sold out (inventory 0) -> cannot be a night of the stay
  noArrivalDates: Set<string>;           // closed on arrival -> cannot be a check-in date
  minNightsByDate: Record<string, number>; // min nights required when checking in on that date
}

export async function fetchRoomCalendar(roomId: number): Promise<RoomCalendar> {
  const empty: RoomCalendar = { blockedDates: new Set(), noArrivalDates: new Set(), minNightsByDate: {} };
  // Preview/mock origins don't hit the live API; return empty (no restrictions).
  if (!isProdOrigin()) return empty;
  try {
    const res = await fetch(`${BOOKING_API_BASE}/calendar?roomId=${roomId}`);
    if (!res.ok) return empty;
    const data = await res.json();
    const minNightsByDate: Record<string, number> = {};
    for (const d of (data.days || [])) minNightsByDate[d.date] = d.minNights || 1;
    return {
      blockedDates: new Set<string>(data.blockedDates || []),
      noArrivalDates: new Set<string>(data.noArrivalDates || []),
      minNightsByDate,
    };
  } catch (e) {
    console.error('fetchRoomCalendar failed:', e);
    return empty;
  }
}
