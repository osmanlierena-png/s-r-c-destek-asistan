import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { calculateWeeklyEarnings } from "@/functions/calculateWeeklyEarnings";
import { DollarSign, Users, CheckCircle, RefreshCw, Package, ChevronDown, ChevronUp, Calendar, AlertTriangle } from "lucide-react";

const STATUS_COLORS = {
  "Hesaplandı": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Onaylandı": "bg-blue-100 text-blue-800 border-blue-300",
  "Ödendi": "bg-green-100 text-green-800 border-green-300"
};

export default function WeeklyPayments() {
  const [summaries, setSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [calcResult, setCalcResult] = useState(null);
  const [forceRecalculate, setForceRecalculate] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState(null);
  const [summaryOrders, setSummaryOrders] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(null);

  // Hafta seçimi için
  const getWeekOptions = () => {
    const options = [];
    const now = new Date();
    // Son 8 haftayı oluştur
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
      // Bu haftanın Pazartesi'sini bul
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + diffToMonday - i * 7);
      const monday = d.toISOString().split('T')[0];
      const sunday = new Date(d);
      sunday.setDate(d.getDate() + 6);
      const sundayStr = sunday.toISOString().split('T')[0];
      options.push({ label: `${monday} — ${sundayStr}`, weekStart: monday, weekEnd: sundayStr });
    }
    return options;
  };

  const weekOptions = getWeekOptions();
  const [selectedWeek, setSelectedWeek] = useState("custom");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const loadSummaries = async () => {
    setIsLoading(true);
    const data = await base44.entities.DriverWeeklySummary.list('-week_start_date', 200);
    setSummaries(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  const handleCalculate = async () => {
    let week_start, week_end;
    if (selectedWeek === "custom") {
      if (!customStart || !customEnd) return alert("Lütfen başlangıç ve bitiş tarihini girin.");
      week_start = customStart;
      week_end = customEnd;
    } else {
      const opt = weekOptions.find(o => o.weekStart === selectedWeek);
      if (!opt) return;
      week_start = opt.weekStart;
      week_end = opt.weekEnd;
    }
    setIsCalculating(true);
    setCalcResult(null);
    const res = await calculateWeeklyEarnings({ week_start, week_end, force_recalculate: forceRecalculate });
    setCalcResult(res.data);
    await loadSummaries();
    setIsCalculating(false);
  };

  const toggleSummaryOrders = async (summaryId) => {
    if (expandedSummary === summaryId) {
      setExpandedSummary(null);
      return;
    }
    setExpandedSummary(summaryId);
    if (summaryOrders[summaryId]) return; // zaten yüklendi
    setLoadingOrders(summaryId);
    const orders = await base44.entities.DailyOrder.filter({ weekly_summary_id: summaryId });
    setSummaryOrders(prev => ({ ...prev, [summaryId]: orders }));
    setLoadingOrders(null);
  };

  const handleStatusChange = async (summaryId, newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'Ödendi') {
      updateData.paid_date = new Date().toISOString().split('T')[0];
    }
    await base44.entities.DriverWeeklySummary.update(summaryId, updateData);
    await loadSummaries();
  };

  const filtered = filterStatus === "all"
    ? summaries
    : summaries.filter(s => s.status === filterStatus);

  const totalUnpaid = summaries
    .filter(s => s.status !== 'Ödendi')
    .reduce((sum, s) => sum + (s.total_canvas_price || 0), 0);

  const grouped = filtered.reduce((acc, s) => {
    const key = `${s.week_start_date} - ${s.week_end_date}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Haftalık Ödemeler</h1>
          <p className="text-slate-500 text-sm mt-1">Sürücü haftalık kazanç özetleri</p>
        </div>
        <Button variant="outline" onClick={loadSummaries} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
      </div>

      {/* Hafta Seçimi ve Hesaplama */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800 text-sm">Hafta Seç ve Hesapla</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-xs text-slate-500 mb-1 block">Hafta</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map(opt => (
                    <SelectItem key={opt.weekStart} value={opt.weekStart}>{opt.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">🗓️ Özel Tarih Aralığı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedWeek === "custom" && (
              <>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Başlangıç</label>
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Bitiş</label>
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={forceRecalculate}
                  onChange={e => setForceRecalculate(e.target.checked)}
                  className="w-3 h-3"
                />
                <AlertTriangle className="w-3 h-3" />
                Yeniden Hesapla
              </label>
              <Button onClick={handleCalculate} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-700">
                {isCalculating ? 'Hesaplanıyor...' : 'Hesapla'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {calcResult && (
        <div className={`rounded-lg p-4 text-sm border ${calcResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {calcResult.success
            ? `✅ ${calcResult.week?.weekStart} - ${calcResult.week?.weekEnd} haftası: ${calcResult.total_orders_processed} sipariş, ${calcResult.summaries_created} sürücü işlendi.`
            : `❌ Hata: ${calcResult.error}`}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xs text-slate-500">Ödenmemiş Toplam</p>
              <p className="text-xl font-bold text-slate-900">${totalUnpaid.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-slate-500">Toplam Kayıt</p>
              <p className="text-xl font-bold text-slate-900">{summaries.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-slate-500">Ödendi</p>
              <p className="text-xl font-bold text-slate-900">{summaries.filter(s => s.status === 'Ödendi').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Filtrele:</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="Hesaplandı">Hesaplandı</SelectItem>
            <SelectItem value="Onaylandı">Onaylandı</SelectItem>
            <SelectItem value="Ödendi">Ödendi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-slate-500">Kayıt bulunamadı.</div>
      ) : (
        Object.entries(grouped).map(([weekRange, items]) => (
          <div key={weekRange} className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-semibold text-slate-700">📅 {weekRange}</h2>
              <span className="text-sm text-slate-500">
                Toplam: <strong>${items.reduce((s, i) => s + (i.total_canvas_price || 0), 0).toFixed(2)}</strong>
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map(summary => (
                <Card key={summary.id} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-900">{summary.driver_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{summary.order_count} sipariş</span>
                        </div>
                        {summary.paid_date && (
                          <p className="text-xs text-slate-400 mt-1">Ödendi: {summary.paid_date}</p>
                        )}
                        {summary.notes && (
                          <p className="text-xs text-slate-500 mt-1 italic">{summary.notes}</p>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-xl font-bold text-slate-900">
                          ${(summary.total_canvas_price || 0).toFixed(2)}
                        </p>
                        <Badge className={`${STATUS_COLORS[summary.status]} border text-xs`}>
                          {summary.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t items-center justify-between">
                      <div className="flex gap-2">
                        {summary.status === 'Hesaplandı' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-blue-600 hover:bg-blue-50"
                            onClick={() => handleStatusChange(summary.id, 'Onaylandı')}
                          >
                            Onayla
                          </Button>
                        )}
                        {summary.status === 'Onaylandı' && (
                          <Button
                            size="sm"
                            className="text-xs h-7 bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusChange(summary.id, 'Ödendi')}
                          >
                            Ödendi İşaretle
                          </Button>
                        )}
                        {summary.status === 'Ödendi' && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Ödeme Tamamlandı
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-slate-500"
                        onClick={() => toggleSummaryOrders(summary.id)}
                      >
                        {expandedSummary === summary.id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                        Siparişler
                      </Button>
                    </div>

                    {expandedSummary === summary.id && (
                      <div className="mt-3 pt-3 border-t space-y-1">
                        {loadingOrders === summary.id ? (
                          <p className="text-xs text-slate-400">Yükleniyor...</p>
                        ) : (summaryOrders[summary.id] || []).length === 0 ? (
                          <p className="text-xs text-slate-400">Sipariş bulunamadı.</p>
                        ) : (
                          (summaryOrders[summary.id] || []).map(order => (
                            <div key={order.id} className="flex justify-between items-center py-1 px-2 bg-slate-50 rounded text-xs">
                              <div>
                                <span className="font-medium text-slate-700">#{order.ezcater_order_id}</span>
                                <span className="text-slate-400 ml-2">{order.order_date}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-slate-800">${(order.canvas_price || 0).toFixed(2)}</span>
                                <span className="text-slate-400 ml-2">{order.pickup_time}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}