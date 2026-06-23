'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { BranchSpend } from '@/app/api/buyer/dashboard/route';
import { formatINR } from '@/lib/utils/formatting';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

interface BranchMapCardProps {
  branches: BranchSpend[];
  totalSpend: number;
}

const CITY_COORDS: Record<string, [number, number]> = {
  mumbai: [19.076, 72.877],
  delhi: [28.704, 77.102],
  bangalore: [12.972, 77.594],
  bengaluru: [12.972, 77.594],
  hyderabad: [17.385, 78.487],
  chennai: [13.083, 80.270],
  kolkata: [22.572, 88.364],
  pune: [18.520, 73.857],
  ahmedabad: [23.022, 72.572],
  surat: [21.170, 72.832],
  jaipur: [26.912, 75.787],
  lucknow: [26.846, 80.946],
  kanpur: [26.464, 80.350],
  nagpur: [21.145, 79.082],
  indore: [22.720, 75.857],
  bhopal: [23.259, 77.412],
  patna: [25.612, 85.148],
  vadodara: [22.307, 73.181],
  coimbatore: [11.017, 76.955],
  agra: [27.177, 78.008],
  visakhapatnam: [17.686, 83.218],
  vizag: [17.686, 83.218],
  gurgaon: [28.459, 77.027],
  gurugram: [28.459, 77.027],
  noida: [28.535, 77.391],
  chandigarh: [30.733, 76.779],
  kochi: [9.932, 76.267],
  cochin: [9.932, 76.267],
  thiruvananthapuram: [8.524, 76.936],
  bhubaneswar: [20.296, 85.824],
  guwahati: [26.144, 91.744],
  srinagar: [34.083, 74.797],
  jammu: [32.730, 74.870],
  amritsar: [31.634, 74.872],
  ludhiana: [30.901, 75.857],
  jodhpur: [26.294, 73.044],
  udaipur: [24.571, 73.693],
  kota: [25.182, 75.838],
  gwalior: [26.218, 78.183],
  raipur: [21.250, 81.630],
  ranchi: [23.343, 85.310],
  jabalpur: [23.182, 79.987],
  varanasi: [25.317, 82.974],
  allahabad: [25.435, 81.846],
  prayagraj: [25.435, 81.846],
  meerut: [28.985, 77.707],
  faridabad: [28.408, 77.317],
};

function getCoordsForBranch(name: string): [number, number] | null {
  const lower = name.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

export default function BranchMapCard({ branches, totalSpend }: BranchMapCardProps) {
  const maxSpend = Math.max(...branches.map((b) => b.spend), 1);
  const branchesWithCoords = branches
    .map((b) => ({ ...b, coords: getCoordsForBranch(b.branch_name) }))
    .filter((b) => b.coords !== null) as (BranchSpend & { coords: [number, number] })[];

  if (!branches.length) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Spend &amp; locations</p>
          </div>
          <Link
            href="/buyer/account/details?tab=branches"
            className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            Manage Branches →
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MapPin className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No branch data for this period</p>
          <Link
            href="/buyer/account/details?tab=branches"
            className="mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            Add Branches →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch Activity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {branches.length} location{branches.length !== 1 ? 's' : ''} · current period
          </p>
        </div>
        <Link
          href="/buyer/account/details?tab=branches"
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
        >
          Manage Branches →
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[300px]">
        {/* Left: Branch list */}
        <div className="lg:w-2/5 p-5 space-y-4 overflow-y-auto lg:max-h-80 scrollbar-hide border-b lg:border-b-0 lg:border-r border-white/8">
          {branches.slice(0, 8).map((branch, i) => {
            const width = maxSpend > 0 ? Math.round((branch.spend / maxSpend) * 100) : 0;
            return (
              <div key={branch.branch_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-600 w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-200 truncate">{branch.branch_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] text-slate-500">{branch.order_count} orders</span>
                    <span className="text-sm font-bold text-white tabular-nums tracking-tight">
                      {formatINR(branch.spend)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${width}%` }}
                  />
                </div>
                {totalSpend > 0 && (
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {Math.round((branch.spend / totalSpend) * 100)}% of total spend
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Interactive Map */}
        <div className="flex-1 relative min-h-[260px]">
          <MapContainer
            center={[20.5, 78.9]}
            zoom={4}
            className="h-full w-full absolute inset-0"
            style={{ background: '#060d19', minHeight: 260 }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {branchesWithCoords.map((branch) => (
              <CircleMarker
                key={branch.branch_id}
                center={branch.coords}
                radius={8 + Math.round((branch.spend / maxSpend) * 6)}
                pathOptions={{
                  color: '#2dd4bf',
                  fillColor: '#0d9488',
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 140 }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: '#fff', margin: '0 0 4px' }}>
                      {branch.branch_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>
                      {formatINR(branch.spend)} spend
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                      {branch.order_count} orders
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {branchesWithCoords.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-end p-4 pointer-events-none z-10">
              <p className="text-[10px] text-slate-600 bg-navy-900/80 px-2 py-1 rounded">
                Include city name in branch name to auto-pin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
