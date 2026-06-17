
import { useState, useEffect } from 'react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkIn: string;
  checkOut: string;
  guests: number;
  onSearch: (checkIn: string, checkOut: string, guests: number) => void;
  focusField?: 'checkIn' | 'checkOut' | 'guests';
}

export default function BookingModal({
  isOpen,
  onClose,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
  onSearch,
  focusField = 'checkIn'
}: BookingModalProps) {
  const [tempCheckIn, setTempCheckIn] = useState(initialCheckIn);
  const [tempCheckOut, setTempCheckOut] = useState(initialCheckOut);
  const [tempGuests, setTempGuests] = useState(initialGuests);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    setTempCheckIn(initialCheckIn);
    setTempCheckOut(initialCheckOut);
    setTempGuests(initialGuests);
  }, [initialCheckIn, initialCheckOut, initialGuests]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const isDateDisabled = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable past dates
    if (date < today) return true;
    
    // If check-in is selected and we're selecting check-out, disable dates before check-in
    if (tempCheckIn && !tempCheckOut) {
      return date <= new Date(tempCheckIn + 'T12:00:00');
    }
    
    return false;
  };

  const isDateInRange = (dateStr: string) => {
    if (!tempCheckIn || !tempCheckOut) {
      // Show preview range when hovering
      if (tempCheckIn && hoveredDate && !tempCheckOut) {
        const date = new Date(dateStr + 'T12:00:00');
        const checkInDate = new Date(tempCheckIn + 'T12:00:00');
        const hoverDate = new Date(hoveredDate + 'T12:00:00');
        return date > checkInDate && date < hoverDate;
      }
      return false;
    }
    const date = new Date(dateStr + 'T12:00:00');
    const checkInDate = new Date(tempCheckIn + 'T12:00:00');
    const checkOutDate = new Date(tempCheckOut + 'T12:00:00');
    return date > checkInDate && date < checkOutDate;
  };

  const handleDateClick = (day: number, month: number, year: number) => {
    // Create date string in YYYY-MM-DD format
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (isDateDisabled(dateStr)) return;

    // If no check-in or user wants to reset, set check-in
    if (!tempCheckIn || (tempCheckIn && tempCheckOut)) {
      setTempCheckIn(dateStr);
      setTempCheckOut('');
    } else {
      // Set check-out
      setTempCheckOut(dateStr);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const renderCalendar = (monthOffset: number = 0) => {
    const displayMonth = new Date(currentMonth);
    displayMonth.setMonth(displayMonth.getMonth() + monthOffset);
    
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(displayMonth);
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 sm:h-12"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isDisabled = isDateDisabled(dateStr);
      const isCheckIn = tempCheckIn === dateStr;
      const isCheckOut = tempCheckOut === dateStr;
      const isInRange = isDateInRange(dateStr);
      const today = new Date();
      const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day, month, year)}
          onMouseEnter={() => setHoveredDate(dateStr)}
          onMouseLeave={() => setHoveredDate(null)}
          disabled={isDisabled}
          className={`h-10 sm:h-12 rounded-lg font-medium transition-all text-sm sm:text-base relative
            ${isCheckIn || isCheckOut ? 'bg-[#1a2e1a] text-white z-10' : ''}
            ${isInRange ? 'bg-[#e8f0e8]' : ''}
            ${isToday && !isCheckIn && !isCheckOut ? 'border-2 border-[#1a2e1a]' : ''}
            ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}
            ${!isCheckIn && !isCheckOut && !isDisabled && !isInRange ? 'text-gray-900' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base sm:text-lg mb-4 text-center">
          {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-600 h-8 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };

  const handleSearch = () => {
    if (tempCheckIn && tempCheckOut) {
      onSearch(tempCheckIn, tempCheckOut, tempGuests);
      onClose();
    }
  };

  const canSearch = tempCheckIn && tempCheckOut;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-0 sm:p-4 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-[110]">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Select dates and guests</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Calendar Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <i className="ri-arrow-left-s-line text-2xl"></i>
              </button>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">
                  {tempCheckIn && !tempCheckOut ? 'Select check-out date' : 'Select check-in date'}
                </p>
                {tempCheckIn && tempCheckOut && (
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(tempCheckIn + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(tempCheckOut + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <i className="ri-arrow-right-s-line text-2xl"></i>
              </button>
            </div>

            {/* Single Month View */}
            <div className="max-w-md mx-auto">
              {renderCalendar(0)}
            </div>
          </div>

          {/* Guest Selector Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div>
                <p className="font-semibold text-gray-900 text-lg">Guests</p>
                <p className="text-sm text-gray-600">Maximum 10 guests</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setTempGuests(Math.max(1, tempGuests - 1))}
                  disabled={tempGuests <= 1}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-black disabled:border-gray-200 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ri-subtract-line text-xl"></i>
                </button>
                <span className="text-xl font-semibold w-12 text-center">{tempGuests}</span>
                <button
                  type="button"
                  onClick={() => setTempGuests(Math.min(10, tempGuests + 1))}
                  disabled={tempGuests >= 10}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-black disabled:border-gray-200 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ri-add-line text-xl"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              setTempCheckIn('');
              setTempCheckOut('');
              setTempGuests(2);
            }}
            className="text-gray-600 hover:text-gray-900 font-medium underline"
          >
            Clear all
          </button>
          <button
            onClick={handleSearch}
            disabled={!canSearch}
            className="disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            style={{ backgroundColor: canSearch ? '#1a2e1a' : undefined }}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
