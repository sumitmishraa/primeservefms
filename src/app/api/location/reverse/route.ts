import { NextResponse } from 'next/server';

type NominatimAddress = {
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
};

type NominatimResponse = {
  address?: NominatimAddress;
  display_name?: string;
};

function readCoordinate(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = readCoordinate(searchParams.get('lat'));
  const lng = readCoordinate(searchParams.get('lng') ?? searchParams.get('lon'));

  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'Valid lat and lng are required' }, { status: 400 });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Coordinates are out of range' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en-IN,en;q=0.9',
          'User-Agent': 'PrimeServe/1.0 contact@primeserve.in',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch location details' }, { status: 502 });
    }

    const payload = (await response.json()) as NominatimResponse;
    const address = payload.address ?? {};
    const area = address.city ?? address.town ?? address.village ?? address.state ?? '';

    return NextResponse.json({
      pincode: address.postcode ?? '',
      area,
      label: [area, address.postcode].filter(Boolean).join(' '),
      display_name: payload.display_name ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Location lookup timed out' }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
