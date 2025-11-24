import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Search,
  MessageSquare,
  Plus,
  RefreshCw
} from "lucide-react";
import CaseCard from "../components/dashboard/CaseCard";
import CaseDetails from "../components/dashboard/CaseDetails";
import NewCaseForm from "../components/dashboard/NewCaseForm";

export default function DashboardPage() {
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);

  const getESTDate = () => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => getESTDate());

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🔍 Dashboard - ${selectedDate} tarihli case'ler yükleniyor (EST)`);

      // EST tarihini UTC'ye çevir: EST = UTC-5
      const [year, month, day] = selectedDate.split('-').map(Number);
      const estStartUTC = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
      const estEndUTC = new Date(Date.UTC(year, month - 1, day + 1, 4, 59, 59, 999));

      // Direkt veritabanından sadece seçilen tarih aralığındaki case'leri çek
      const data = await base44.entities.Case.filter(
        { 
          created_date: { 
            $gte: estStartUTC.toISOString(),
            $lte: estEndUTC.toISOString()
          } 
        },
        '-created_date',
        500
      );

      console.log(`✅ ${data.length} case bulundu (${selectedDate})`);
      setCases(data);
    } catch (error) {
      console.error('Case\'ler yüklenirken hata:', error);
      setCases([]);
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadCases();
  }, [selectedDate]);

  useEffect(() => {
    let filtered = cases;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.sorun?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.konum?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (urgencyFilter !== "all") {
      filtered = filtered.filter(c => c.aciliyet === urgencyFilter);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(c => c.kategori === categoryFilter);
    }

    setFilteredCases(filtered);
  }, [searchTerm, urgencyFilter, categoryFilter, cases]);



  const stats = {
    total: cases.length,
    acil: cases.filter(c => c.aciliyet === "Acil").length,
    yuksek: cases.filter(c => c.aciliyet === "Yüksek").length,
    bildirildi: cases.filter(c => c.durum === "Bildirildi").length,
    islemde: cases.filter(c => c.durum === "İşlemde").length,
    cozuldu: cases.filter(c => c.durum === "Çözüldü").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Operasyon Paneli</h1>
            <p className="text-slate-600">Sürücü sorunlarını yönetin ve takip edin</p>
          </div>
          <Button 
            onClick={() => setShowNewCaseForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Case Oluştur
          </Button>
        </div>



        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Toplam Case</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-red-200/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Acil</p>
                  <p className="text-2xl font-bold text-red-600">{stats.acil}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-yellow-200/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Bekleyen</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.bildirildi}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-green-200/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Çözüldü</p>
                  <p className="text-2xl font-bold text-green-600">{stats.cozuldu}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Case Listesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Ara..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[180px] h-9"
              />

              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Aciliyet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="Acil">Acil</SelectItem>
                  <SelectItem value="Yüksek">Yüksek</SelectItem>
                  <SelectItem value="Orta">Orta</SelectItem>
                  <SelectItem value="Düşük">Düşük</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="Lojistik & Ulaşım">Lojistik & Ulaşım</SelectItem>
                  <SelectItem value="Ürünle İlgili">Ürünle İlgili</SelectItem>
                  <SelectItem value="Kurye Kaynaklı">Kurye Kaynaklı</SelectItem>
                  <SelectItem value="Teknolojik / Sistemsel">Teknolojik / Sistemsel</SelectItem>
                  <SelectItem value="Müşteri Kaynaklı">Müşteri Kaynaklı</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {selectedDate} tarihinde case bulunamadı
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onViewDetails={() => setSelectedCase(caseItem)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCase && (
          <CaseDetails
            caseItem={selectedCase}
            onClose={() => setSelectedCase(null)}
          />
        )}

        {showNewCaseForm && (
          <NewCaseForm
            onClose={() => setShowNewCaseForm(false)}
            onSuccess={() => {
              setShowNewCaseForm(false);
              loadCases();
            }}
          />
        )}
      </div>
    </div>
  );
}