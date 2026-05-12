import React from "react";
import { Badge } from "@/components/ui/badge";
import { X, MessageSquare, Clock, BarChart3 } from "lucide-react";

export default function GroupPreviewModal({ groupPreview, onClose }) {
  if (!groupPreview) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 z-10">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <h2 className="text-2xl font-bold">🔗 Toplu Mesaj Gruplandırma Önizlemesi</h2>
              <p className="text-sm text-purple-100 mt-1">Hangi sürücüye kaç sipariş birleşik gönderilecek</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-purple-200 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {groupPreview.map((driverGroup, idx) => (
            <div key={idx} className="border-2 border-slate-300 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50 shadow-md">
              <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-slate-200">
                <div>
                  <h3 className="font-bold text-xl text-slate-900">{driverGroup.driverName}</h3>
                  <p className="text-sm text-slate-600 mt-1">{driverGroup.driverPhone}</p>
                </div>
                <div className="text-right bg-purple-100 rounded-lg px-4 py-2">
                  <p className="text-xs text-purple-700 font-semibold">MESAJ SAYISI</p>
                  <p className="text-3xl font-bold text-purple-700">{driverGroup.groups.length}</p>
                </div>
              </div>

              <div className="space-y-4">
                {driverGroup.groups.map((group, groupIdx) => {
                  const isGrouped = group.length > 1;
                  return (
                    <div
                      key={groupIdx}
                      className={`rounded-xl p-5 shadow-md ${
                        isGrouped
                          ? 'bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-100 border-4 border-purple-400'
                          : 'bg-white border-2 border-slate-300'
                      }`}
                    >
                      <div className={`flex items-center justify-between mb-4 pb-3 border-b-2 ${isGrouped ? 'border-purple-300' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          {isGrouped ? (
                            <>
                              <div className="bg-purple-600 rounded-full p-2">
                                <MessageSquare className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="font-black text-xl text-purple-800 uppercase tracking-wide">🔗 GRUP MESAJI</p>
                                <p className="text-purple-600 text-sm font-semibold mt-1">{group.length} sipariş tek SMS'te birleştirildi</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="bg-slate-400 rounded-full p-2">
                                <MessageSquare className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-base text-slate-700">📄 Tekil Mesaj</p>
                                <p className="text-slate-500 text-xs mt-0.5">Tek sipariş için ayrı mesaj</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">İlk Pickup</p>
                          <p className="text-lg font-bold text-slate-700">{group[0].pickup_time}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.map((order, orderIdx) => (
                          <div key={orderIdx} className={`rounded-lg p-4 ${isGrouped ? 'bg-white border-2 border-purple-300' : 'bg-slate-50 border border-slate-300'}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-mono font-black text-base text-slate-900">{order.ezcater_order_id}</p>
                                  {isGrouped && (
                                    <Badge className={`${orderIdx === 0 ? 'bg-purple-700' : 'bg-purple-500'} text-white font-bold`}>
                                      {orderIdx === 0 ? 'ANA' : `+${orderIdx}`}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-700 flex items-center gap-1 font-semibold">
                                  <Clock className="w-4 h-4" />
                                  {order.pickup_time} → {order.dropoff_time}
                                </p>
                                <p className="text-xs text-slate-600 mt-2">📍 {order.pickup_address}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {isGrouped && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg">
                          <div className="flex items-start gap-3 text-white">
                            <div className="bg-white/20 rounded-full p-2">
                              <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-base mb-1">💬 TEK SMS GÖNDERİMİ</p>
                              <p className="text-sm text-purple-100">
                                Bu {group.length} sipariş için sadece <strong className="text-yellow-300">1 adet SMS</strong> gönderilecek.
                                Pickup süreleri 2.5 saat içinde olduğu için gruplandırıldı.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 border-4 border-blue-400 rounded-xl p-6 shadow-xl">
            <h4 className="font-black text-blue-900 mb-4 text-xl flex items-center gap-3">
              <div className="bg-blue-600 rounded-full p-2">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              📊 MESAJ GÖNDERİM ÖZETİ
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border-2 border-blue-300 shadow-md">
                <p className="text-xs text-slate-600 mb-2 font-semibold">TOPLAM SÜRÜCÜ</p>
                <p className="text-4xl font-black text-blue-600">{groupPreview.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border-2 border-purple-300 shadow-md">
                <p className="text-xs text-slate-600 mb-2 font-semibold">SMS GÖNDERİLECEK</p>
                <p className="text-4xl font-black text-purple-600">
                  {groupPreview.reduce((sum, d) => sum + d.groups.length, 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border-2 border-purple-300 shadow-md">
                <p className="text-xs text-slate-600 mb-2 font-semibold">🔗 GRUPLANDIRILMIŞ</p>
                <p className="text-4xl font-black text-purple-600">
                  {groupPreview.reduce((sum, d) => sum + d.groups.filter(g => g.length > 1).length, 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border-2 border-slate-300 shadow-md">
                <p className="text-xs text-slate-600 mb-2 font-semibold">📄 TEKİL</p>
                <p className="text-4xl font-black text-slate-700">
                  {groupPreview.reduce((sum, d) => sum + d.groups.filter(g => g.length === 1).length, 0)}
                </p>
              </div>
            </div>
            <div className="mt-5 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg border-2 border-blue-700 shadow-lg">
              <p className="text-sm text-white font-semibold">
                💡 <strong className="text-yellow-200">FARK:</strong> Gruplandırılmış mesajlarda birden fazla sipariş tek SMS'te gönderilir.
                Bu sayede hem <strong className="text-yellow-200">maliyet düşer</strong> hem de sürücü için <strong className="text-yellow-200">daha kolay okunur</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}