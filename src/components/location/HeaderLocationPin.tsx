'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

const STORAGE_KEY = 'primeserve.delivery-location';

type StoredLocation = {
  pincode: string;
  area?: string;
  label?: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

type ReverseResponse = {
  pincode?: string;
  area?: string;
  label?: string;
  error?: string;
};

type HeaderLocationPinProps = {
  tone?: 'light' | 'dark';
  className?: string;
};

function readStoredLocation() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLocation) : null;
  } catch {
    return null;
  }
}

function saveStoredLocation(location: StoredLocation) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

export default function HeaderLocationPin({
  tone = 'light',
  className = '',
}: HeaderLocationPinProps) {
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Allow location');

  const dark = tone === 'dark';

  const resolveLocation = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;

    fetch(`/api/location/reverse?lat=${latitude}&lng=${longitude}`)
      .then((response) => response.json())
      .then((data: ReverseResponse) => {
        if (!data.pincode) {
          setMessage('Pincode not found');
          return;
        }

        const nextLocation: StoredLocation = {
          pincode: data.pincode,
          area: data.area,
          label: data.label,
          latitude,
          longitude,
          updatedAt: new Date().toISOString(),
        };

        saveStoredLocation(nextLocation);
        setLocation(nextLocation);
        setMessage('Allow location');
      })
      .catch(() => setMessage('Location unavailable'))
      .finally(() => setLoading(false));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage('Location unavailable');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      resolveLocation,
      (positionError) => {
        setLoading(false);
        if (positionError.code === positionError.PERMISSION_DENIED) {
          setMessage('Enable in Settings');
        } else if (positionError.code === positionError.TIMEOUT) {
          setMessage('Location timed out');
        } else {
          setMessage('Location unavailable');
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 12000,
      },
    );
  }, [resolveLocation]);

  useEffect(() => {
    const stored = readStoredLocation();
    if (stored?.pincode) {
      const timer = window.setTimeout(() => setLocation(stored), 0);
      return () => window.clearTimeout(timer);
    }

    if (!navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        if (permission.state === 'granted') requestLocation();
      })
      .catch(() => {});
  }, [requestLocation]);

  const label = location?.pincode ? `Deliver to ${location.pincode}` : message;
  const title = location?.label || location?.pincode || 'Use current location';

  return (
    <button
      type="button"
      onClick={requestLocation}
      title={title}
      className={`inline-flex h-10 max-w-[160px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-left text-xs font-semibold transition-colors ${
        dark
          ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'
      } ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <MapPin className={`h-4 w-4 shrink-0 ${dark ? 'text-[#5EEAD4]' : 'text-teal-600'}`} />
      )}
      <span className="truncate">{loading ? 'Fetching...' : label}</span>
    </button>
  );
}
