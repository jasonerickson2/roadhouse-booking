export interface BookedStay {
  checkInDate: string;
  checkOutDate: string;
  source: string;
  reservationCode: string;
}

export interface RoomAvailability {
  roomId: number;
  hostexPropertyId: number;
  name: string;
  isAvailable: boolean;
  bookedStays: BookedStay[];
}

export interface AvailabilityRequest {
  checkIn: string;
  checkOut: string;
  guests: number;
  roomId?: number;
}

export interface AvailabilityResponse {
  success: boolean;
  requested: {
    checkIn: string;
    checkOut: string;
    guests: number;
  };
  rooms: RoomAvailability[];
}