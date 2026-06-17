import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_BOOKING_API_BASE;

interface CancelInfo {
  reservation: {
    id: string;
    propertyName: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    checkInFormatted: string;
    checkOutFormatted: string;
    nights: number;
    guests: number;
    totalPaid: number;
    nightlyRate: number;
    cleaningFee: number;
    taxes: number;
    serviceFee: number;
  };
  policy: {
    season: 'summer' | 'winter';
    seasonLabel: string;
    rules: string[];
    reason: string;
    refundPercent: number;
    refundAmount: number;
  };
  tokenId: string;
}

export default function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<CancelInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid cancellation link');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/cancel-info/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to load cancellation details');
        } else {
          setInfo(data);
        }
      })
      .catch(() => setError('Failed to connect to server'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !info || !confirmChecked) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/cancel-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit cancellation');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Process</h2>
          <p className="text-gray-600 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-4">
            If you need assistance, please contact us at{' '}
            <a href="mailto:info@yourlodge.com" className="text-indigo-600">info@yourlodge.com</a>
            {' '}or text <a href="sms:5555555555" className="text-indigo-600">(555) 555-5555</a>.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Cancellation Request Submitted</h2>
          <p className="text-gray-600 text-sm mb-4">
            We've received your cancellation request and will process it within 24 hours.
          </p>
          {info && info.policy.refundPercent > 0 && (
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <p className="text-green-800 text-sm font-medium">
                Expected refund: ${info.policy.refundAmount.toFixed(2)} ({info.policy.refundPercent}%)
              </p>
              <p className="text-green-700 text-xs mt-1">
                Refunds typically appear on your statement within 5–10 business days.
              </p>
            </div>
          )}
          <p className="text-gray-500 text-xs">
            You'll receive a confirmation email once your cancellation has been processed.
          </p>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const { reservation: res, policy } = info;
  const isSummer = policy.season === 'summer';
  const policyBg = isSummer ? 'bg-amber-50' : 'bg-blue-50';
  const policyBorder = isSummer ? 'border-amber-200' : 'border-blue-200';
  const policyText = isSummer ? 'text-amber-900' : 'text-blue-900';
  const policyTextLight = isSummer ? 'text-amber-800' : 'text-blue-800';
  const policyAccent = isSummer ? 'text-amber-600' : 'text-blue-600';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Request Cancellation</h1>
          <p className="text-gray-500 text-sm mt-1">Roadhouse Twin Lakes</p>
        </div>

        {/* Reservation Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Reservation Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 text-sm">Property</span>
              <span className="text-gray-900 text-sm font-semibold">{res.propertyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-sm">Guest</span>
              <span className="text-gray-900 text-sm">{res.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-sm">Check-in</span>
              <span className="text-gray-900 text-sm">{res.checkInFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-sm">Check-out</span>
              <span className="text-gray-900 text-sm">{res.checkOutFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-sm">Nights</span>
              <span className="text-gray-900 text-sm">{res.nights}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-gray-900 text-sm font-semibold">Total Paid</span>
              <span className="text-gray-900 text-sm font-semibold">${res.totalPaid.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Cancellation Policy */}
        <div className={`${policyBg} border ${policyBorder} rounded-xl p-6 mb-4`}>
          <h2 className={`text-sm font-semibold ${policyAccent} uppercase tracking-wide mb-2`}>
            Cancellation Policy
          </h2>
          <p className={`${policyText} text-sm font-medium mb-3`}>{policy.seasonLabel}</p>
          <ul className={`${policyTextLight} text-sm space-y-1.5`}>
            {policy.rules.map((rule, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-2 mt-0.5">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Refund Calculation */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Your Refund</h2>
          <div className={`rounded-lg p-4 ${
            policy.refundPercent === 100
              ? 'bg-green-50 border border-green-200'
              : policy.refundPercent === 50
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-lg font-bold ${
              policy.refundPercent > 0 ? 'text-gray-900' : 'text-red-700'
            }`}>
              {policy.refundPercent > 0
                ? `$${policy.refundAmount.toFixed(2)} refund (${policy.refundPercent}%)`
                : 'Non-refundable'
              }
            </p>
            <p className={`text-sm mt-1 ${
              policy.refundPercent === 100
                ? 'text-green-700'
                : policy.refundPercent === 50
                ? 'text-yellow-700'
                : 'text-red-600'
            }`}>
              {policy.reason}
            </p>
          </div>
        </div>

        {/* Confirmation + Submit */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <label className="flex items-start space-x-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">
              I understand the cancellation policy and {policy.refundPercent > 0
                ? `agree to receive a ${policy.refundPercent}% refund of $${policy.refundAmount.toFixed(2)}`
                : 'acknowledge that this cancellation is non-refundable'
              }.
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={!confirmChecked || submitting}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white text-sm transition-colors ${
              confirmChecked && !submitting
                ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : 'Request Cancellation'}
          </button>

          <p className="text-gray-500 text-xs text-center mt-3">
            Your cancellation will be reviewed and processed within 24 hours.
          </p>
        </div>

        {/* Contact */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-xs">
            Questions? Email{' '}
            <a href="mailto:info@yourlodge.com" className="text-indigo-600">
              info@yourlodge.com
            </a>
            {' '}or text{' '}
            <a href="sms:5555555555" className="text-indigo-600">(555) 555-5555</a>
          </p>
        </div>
      </div>
    </div>
  );
}
