import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { calculateWeeklyEarnings } from "@/functions/calculateWeeklyEarnings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, Users, CheckCircle2, Clock, ChevronDown, ChevronUp,
  RefreshCw, Calculator, TrendingUp, AlertCircle, Package, Calendar,
  ArrowRight, Banknote, Search
} from "lucide-react";
import PaymentCard from "@/components/payments/PaymentCard.jsx";
import PaymentSummaryBar from "@/components/payments/PaymentSummaryBar.jsx";
import WeekSelector from "@/components/payments/WeekSelector.jsx";

export default function WeeklyPayments() {
  const [summaries, setSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSummary, setExpandedSummary] = useState(null);
  const [summaryOrders, setSummaryOrders] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(null);
  const [forceRecalculate, setForceRecalculate] = useState(false);

  // Week selector state
  const getWeekOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
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
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[1]?.weekStart || "");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const loadSummaries = async () => {
    setIsLoading(true);
    const data = await base44.entities.DriverWeeklySummary.list('-week_start_date', 200);
    setSummaries(data);
    setIsLoading(false);
  };

  useEffect(() => { loadSummaries(); }, []);

  const handleCalculate = async () => {
    let week_start, week_end;
    if (selectedWeek === "custom") {
      if (!customStart || !customEnd) return;
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
    if (summaryOrders[summaryId]) return;
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
    setSummaries(prev => prev.map(s => s.id === summaryId ? { ...s, ...updateData } : s));
  };

  // Filtered summaries for selected week view
  const selectedWeekOpt = selectedWeek === "custom"
    ? { weekStart: customStart, weekEnd: customEnd }
    : weekOptions.find(o => o.weekStart === selectedWeek);

  const weekSummaries = summaries.filter(s => {
    if (!selectedWeekOpt) return true;
    return s.week_start_date === selectedWeekOpt.weekStart;
  });

  const filtered = weekSummaries.filter(s => {
    const statusMatch = filterStatus === "all" || s.status === filterStatus;
    const searchMatch = !searchQuery || s.driver_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  // Stats
  const totalPending = weekSummaries.filter(s => s.status !== 'Ödendi').reduce((sum, s) => sum + (s.total_canvas_price || 0), 0);
  const totalPaid = weekSummaries.filter(s => s.status === 'Ödendi').reduce((sum, s) => sum + (s.total_canvas_price || 0), 0);
  const countPending = weekSummaries.filter(s => s.status === 'Hesaplandı').length;
  const countApproved = weekSummaries.filter(s => s.status === 'Onaylandı').length;
  const countPaid = weekSummaries.filter(s => s.status === 'Ödendi').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              Sürücü Ödemeleri
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Haftalık kazanç ve ödeme takibi</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSummaries} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Week Selector + Calculate */}
        <WeekSelector
          weekOptions={weekOptions}
          selectedWeek={selectedWeek}
          setSelectedWeek={setSelectedWeek}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          forceRecalculate={forceRecalculate}
          setForceRecalculate={setForceRecalculate}
          isCalculating={isCalculating}
          onCalculate={handleCalculate}
          calcResult={calcResult}
        />

        {/* Summary Bar */}
        <PaymentSummaryBar
          totalPending={totalPending}
          totalPaid={totalPaid}
          countPending={countPending}
          countApproved={countApproved}
          countPaid={countPaid}
          totalDrivers={weekSummaries.length}
        />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Sürücü ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-white"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-9 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="Hesaplandı">⏳ Hesaplandı</SelectItem>
              <SelectItem value="Onaylandı">✅ Onaylandı</SelectItem>
              <SelectItem value="Ödendi">💰 Ödendi</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500 ml-auto">{filtered.length} sürücü</span>
        </div>

        {/* Payment Cards */}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Bu haftaya ait ödeme kaydı bulunamadı</p>
            <p className="text-slate-400 text-sm mt-1">Hesaplama yaparak veri oluşturabilirsiniz</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(summary => (
              <PaymentCard
                key={summary.id}
                summary={summary}
                isExpanded={expandedSummary === summary.id}
                orders={summaryOrders[summary.id]}
                loadingOrders={loadingOrders === summary.id}
                onToggleOrders={() => toggleSummaryOrders(summary.id)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}