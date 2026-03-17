import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp, Package, Clock, Banknote, User } from "lucide-react";

const STATUS_CONFIG = {
  "Hesaplandı": {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-400",
    label: "Beklemede"
  },
  "Onaylandı": {
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    label: "Onaylandı"
  },
  "Ödendi": {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Ödendi"
  }
};

export default function PaymentCard({ summary, isExpanded, orders, loadingOrders, onToggleOrders, onStatusChange }) {
  const config = STATUS_CONFIG[summary.status] || STATUS_CONFIG["Hesaplandı"];
  const isPaid = summary.status === 'Ödendi';

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 ${isPaid ? 'border-emerald-200 opacity-80' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
      {/* Top accent bar */}
      <div className={`h-1 rounded-t-xl ${config.dot === 'bg-emerald-500' ? 'bg-emerald-400' : config.dot === 'bg-blue-500' ? 'bg-blue-400' : 'bg-amber-400'}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">{summary.driver_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dot}`} />
                <span className="text-xs text-slate-400">{config.label}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900">${(summary.total_canvas_price || 0).toFixed(2)}</p>
            {summary.paid_date && (
              <p className="text-xs text-slate-400">{summary.paid_date}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 py-3 border-t border-b border-slate-100 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="w-3.5 h-3.5" />
            <span><strong className="text-slate-700">{summary.order_count}</strong> sipariş</span>
          </div>
          {summary.week_start_date && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{summary.week_start_date}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {summary.status === 'Hesaplandı' && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
              onClick={() => onStatusChange(summary.id, 'Onaylandı')}
            >
              Onayla
            </Button>
          )}
          {summary.status === 'Onaylandı' && (
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onStatusChange(summary.id, 'Ödendi')}
            >
              <Banknote className="w-3 h-3 mr-1" />
              Ödemeyi Tamamla
            </Button>
          )}
          {summary.status === 'Ödendi' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ödeme Tamamlandı
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
            onClick={onToggleOrders}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Expanded orders */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sipariş bulunamadı</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-slate-500 mb-2">{orders.length} Sipariş Detayı</p>
                {orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs font-mono font-medium text-slate-700">#{order.ezcater_order_id}</span>
                      <span className="text-xs text-slate-400 ml-2">{order.order_date}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800">${(order.canvas_price || 0).toFixed(2)}</span>
                      {order.pickup_time && <span className="text-xs text-slate-400 ml-1.5">{order.pickup_time}</span>}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                  <span className="text-xs font-medium text-slate-500">Toplam</span>
                  <span className="text-xs font-bold text-slate-900">
                    ${orders.reduce((s, o) => s + (o.canvas_price || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}