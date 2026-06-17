
import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
}

export default function DatePicker({ label, value, onChange, minDate }: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) return new Date(value + 'T12:00:00');
    return new Date();
  });
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
    if (!minDate) {
      // For check-in, disable past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(dateStr + 'T12:00:00') < today;
    }
    return new Date(dateStr + 'T12:00:00') <= new Date(minDate + 'T12:00:00');
  };

  const handleDateClick = (day: number) => {
    const { year, month } = getDaysInMonth(currentMonth);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!isDateDisabled(dateStr)) {
      onChange(dateStr);
      setShowCalendar(false);
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

  const canGoBack = () => {
    const now = new Date();
    return currentMonth.getFullYear() > now.getFullYear() ||
           (currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() > now.getMonth());
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-9 sm:h-10"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isDisabled = isDateDisabled(dateStr);
      const isSelected = value === dateStr;
      const today = new Date();
      const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day)}
          disabled={isDisabled}
          className={`h-9 sm:h-10 rounded-full font-medium transition-all text-sm
            ${isSelected ? 'text-white shadow-sm' : ''}
            ${isToday && !isSelected ? 'font-bold' : ''}
            ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}
            ${!isSelected && !isDisabled ? 'text-gray-800' : ''}
          `}
          style={isSelected ? { backgroundColor: '#1a2e1a' } : undefined}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 w-[320px]">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            disabled={!canGoBack()}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${canGoBack() ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <i className="ri-arrow-left-s-line text-lg"></i>
          </button>
          <h3 className="font-semibold text-sm tracking-wide" style={{ fontFamily: '"Playfair Display", serif' }}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            type="button"
            onClick={() => navigateMonth('next')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700"
          >
            <i className="ri-arrow-right-s-line text-lg"></i>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-400 uppercase h-8 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={calendarRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setShowCalendar(!showCalendar)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-gray-800 focus:border-transparent bg-white hover:border-gray-400 transition-colors text-sm flex items-center gap-2"
      >
        <i className="ri-calendar-line text-gray-400"></i>
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? formatDisplayDate(value) : `Select ${label.toLowerCase()}`}
        </span>
      </button>

      {showCalendar && (
        <div className="absolute z-50 mt-2 left-0">
          {renderCalendar()}
        </div>
      )}
    </div>
  );
}
