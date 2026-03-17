import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function WeekSelector({
  weekOptions, selectedWeek, setSelectedWeek,
  customStart, setCustomStart, customEnd, setCustomEnd,
  forceRecalculate, setForceRecalculate,
  isCalculating, onCalculate, calcResult
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-blue-600" />
        <h2 className="font-semibold text-slate-800 text-sm">Haftalık Kazanç Hesapla</h2>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-52">
          <label className="text-xs text-slate-500 mb-1.5 block font-medium">Hafta Seçin</label>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Hafta seçin..." />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((opt, i) => (
                <SelectItem key={opt.weekStart} value={opt.weekStart}>
                  {i === 0 ? '📌 Bu Hafta' : i === 1 ? '◀ Geçen Hafta' : ''} {opt.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">🗓️ Özel Tarih</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedWeek === "custom" && (
          <>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">Başlangıç</label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40 h-9" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">Bitiş</label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40 h-9" />
            </div>
          </>
        )}

        <div className="flex items-center gap-3 mt-auto">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 h-9 select-none">
            <input
              type="checkbox"
              checked={forceRecalculate}
              onChange={e => setForceRecalculate(e.target.checked)}
              className="w-3 h-3 accent-orange-500"
            />
            <AlertTriangle className="w-3 h-3" />
            Yeniden Hesapla
          </label>
          <Button
            onClick={onCalculate}
            disabled={isCalculating}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white px-5"
          >
            {isCalculating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Hesaplanıyor...
              </>
            ) : (
              <>
                <Calculator className="w-3.5 h-3.5 mr-1.5" />
                Hesapla
              </>
            )}
          </Button>
        </div>
      </div>

      {calcResult && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${calcResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {calcResult.success
            ? <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> <span><strong>{calcResult.total_orders_processed}</strong> sipariş, <strong>{calcResult.summaries_created}</strong> sürücü başarıyla işlendi — {calcResult.week?.weekStart} / {calcResult.week?.weekEnd}</span></>
            : <><AlertTriangle className="w-4 h-4 flex-shrink-0" /> Hata: {calcResult.error}</>
          }
        </div>
      )}
    </div>
  );
}