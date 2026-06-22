'use client';

import { Building2, MapPin, Phone, Package, TrendingUp } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import type { BranchWithStats } from '@/app/api/buyer/clients/[clientId]/branches/route';

interface BranchCardProps {
  branch: BranchWithStats;
  clientName?: string;
}

export default function BranchCard({ branch, clientName }: BranchCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all duration-200 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-teal-600" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 leading-snug truncate">{branch.name}</p>
          {clientName && (
            <p className="text-xs text-teal-600 font-medium mt-0.5 truncate">{clientName}</p>
          )}
          {branch.branch_code && (
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-500">
              {branch.branch_code}
            </span>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            branch.is_active
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {branch.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Address */}
      {(branch.address || branch.area || branch.city) && (
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-snug">
            {[branch.address, branch.area, branch.city, branch.pincode].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      {/* Contact */}
      {(branch.contact_person || branch.contact_phone) && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <p className="truncate">
            {branch.contact_person}
            {branch.contact_phone && ` · ${branch.contact_phone}`}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-slate-400">Active Orders</p>
            <p className="text-sm font-semibold text-slate-900">{branch.active_orders}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-teal-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-slate-400">This Month</p>
            <p className="text-sm font-semibold text-slate-900">{formatINR(branch.monthly_spend)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
