import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateWeeklyEarnings } from "@/functions/calculateWeeklyEarnings";
import { DollarSign, Users, CheckCircle, RefreshCw, Package } from "lucide-react";

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
    setIsCalculating(true);
    setCalcResult(null);
    const res = await calculateWeeklyEarnings({});
    setCalcResult(res.data);
    await loadSummaries();
    setIsCalculating(false);
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
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadSummaries} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
          <Button onClick={handleCalculate} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-700">
            {isCalculating ? 'Hesaplanıyor...' : 'Geçen Haftayı Hesapla'}
          </Button>
        </div>
      </div>

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
                    <div className="flex gap-2 mt-3 pt-3 border-t">
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