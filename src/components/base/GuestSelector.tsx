
import { useState, useRef, useEffect } from 'react';

interface GuestSelectorProps {
  value: number;
  onChange: (value: number) => void;
  onFocus?: () => void;
}

export default function GuestSelector({ value, onChange, onFocus }: GuestSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleIncrement = () => {
    if (value < 10) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > 1) {
      onChange(value - 1);
    }
  };

  const handleClick = () => {
    if (onFocus) {
      onFocus();
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Guests
      </label>
      <button
        type="button"
        onClick={handleClick}
        className="w-full px-4 py-4 sm:py-3 border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-black focus:border-transparent bg-white hover:border-gray-400 transition-colors text-base sm:text-sm"
      >
        {value} {value === 1 ? 'guest' : 'guests'}
      </button>

      {showDropdown && !onFocus && (
        <div className="absolute z-50 mt-2 left-0 sm:left-auto bg-white rounded-xl shadow-2xl p-6 w-full sm:w-64">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Guests</span>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={value <= 1}
                className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-black disabled:border-gray-200 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-subtract-line"></i>
              </button>
              <span className="text-lg font-semibold w-8 text-center">{value}</span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={value >= 10}
                className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-black disabled:border-gray-200 disabled:cursor-not-allowed transition-colors"
              >
                <i className="ri-add-line"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
