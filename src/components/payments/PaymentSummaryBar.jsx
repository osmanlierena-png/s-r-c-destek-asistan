import React from "react";
import { DollarSign, Clock, CheckCircle2, Users, TrendingUp } from "lucide-react";

export default function PaymentSummaryBar({ totalPending, totalPaid, countPending, countApproved, countPaid, totalDrivers }) {
  const totalWeek = totalPending + totalPaid;
  const paidPct = totalWeek > 0 ? Math.round((totalPaid / totalWeek) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total this week */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 md:col-span-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bu Hafta Toplam</span>
          <TrendingUp className="w-4 h-4 text-slate-400" />
        </div>
        <p className="text-2xl font-bold text-slate-900">${totalWeek.toFixed(2)}</p>
        <div className="mt-2 bg-slate-100 rounded-full h-1.5">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-1">%{paidPct} ödendi</p>
      </div>

      {/* Pending */}
      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">Beklemede</span>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-2xl font-bold text-amber-900">${totalPending.toFixed(2)}</p>
        <p className="text-xs text-amber-600 mt-1">{countPending} hesaplandı · {countApproved} onaylı</p>
      </div>

      {/* Paid */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Ödendi</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <p className="text-2xl font-bold text-emerald-900">${totalPaid.toFixed(2)}</p>
        <p className="text-xs text-emerald-600 mt-1">{countPaid} sürücü ödendi</p>
      </div>

      {/* Drivers */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Sürücüler</span>
          <Users className="w-4 h-4 text-blue-500" />
        </div>
        <p className="text-2xl font-bold text-blue-900">{totalDrivers}</p>
        <p className="text-xs text-blue-600 mt-1">Bu haftaki aktif sürücü</p>
      </div>
    </div>
  );
}