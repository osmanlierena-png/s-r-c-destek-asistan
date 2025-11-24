
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  Calendar,
  TrendingUp,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Loader2
} from "lucide-react";
import { UploadFile } from "@/integrations/Core";
import { analyzeWeeklyAssignments } from "@/functions/analyzeWeeklyAssignments";

export default function WeeklyAnalysisPage() {
  const [dailyFiles, setDailyFiles] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState('2025-09-29'); // Hafta başlangıcı (Pazartesi)

  // Hafta başlangıç tarihinden diğer günleri hesapla
  const calculateWeekDays = (startDate) => {
    const days = [];
    const start = new Date(startDate);
    
    // Adjust start date to be a Monday if it's not.
    // However, the input type="date" widget itself usually handles date selection.
    // For consistency, we assume `startDate` passed is intended to be a Monday.
    // If we wanted to ensure it's always a Monday, we'd add logic here to find the closest Monday.

    const dayLabels = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      days.push({
        key: dayKeys[i],
        label: dayLabels[i],
        date: dateStr
      });
    }
    
    return days;
  };

  const DAYS = calculateWeekDays(weekStartDate);

  const handleFileSelect = (dayKey, file) => {
    const day = DAYS.find(d => d.key === dayKey);

    file.assignedDate = day.date;
    file.dayLabel = day.label;

    setDailyFiles(prev => ({
      ...prev,
      [dayKey]: file
    }));
  };

  const handleAnalyze = async () => {
    const uploadedDays = Object.keys(dailyFiles);

    if (uploadedDays.length === 0) {
      alert('Lütfen en az bir günün raporunu yükleyin!');
      return;
    }

    setIsProcessing(true);
    setResults(null);
    setDebugLogs([]);

    try {
      const dailyReports = [];
      const logs = [];

      logs.push('🚀 Analiz işlemi başlatıldı...\n');

      for (const [dayKey, file] of Object.entries(dailyFiles)) {
        logs.push(`⏳ ${file.dayLabel} raporu yükleniyor: ${file.name}`);
        setDebugLogs([...logs]);

        const uploadResponse = await UploadFile({ file });

        dailyReports.push({
          date: file.assignedDate,
          day_name: file.dayLabel,
          file_url: uploadResponse.file_url
        });

        logs.push(`✅ ${file.dayLabel} raporu yüklendi: ${uploadResponse.file_url}\n`);
        setDebugLogs([...logs]);
      }

      logs.push('📡 analyzeWeeklyAssignments fonksiyonu çağrılıyor...\n');
      setDebugLogs([...logs]);

      const response = await analyzeWeeklyAssignments({ dailyReports });

      logs.push(`📥 Response alındı: ${JSON.stringify(response.data, null, 2)}\n`);
      setDebugLogs([...logs]);

      if (response.data.success) {
        setResults(response.data);

        let message = `✅ ${response.data.message}\n\n`;
        message += `📊 ${response.data.summary.total_assignments} atama analiz edildi\n`;
        message += `👥 ${response.data.summary.updated_drivers} sürücü güncellendi\n\n`;

        if (response.data.summary.name_mapping && response.data.summary.name_mapping.length > 0) {
          message += `🔄 İsim Eşleştirmeleri:\n`;
          response.data.summary.name_mapping.slice(0, 5).forEach(m => {
            message += `  "${m.html}" → "${m.system}" (${m.score}%)\n`;
          });
          if (response.data.summary.name_mapping.length > 5) {
            message += `  ... ve ${response.data.summary.name_mapping.length - 5} tane daha\n`;
          }
        }
        logs.push(`\n✅ Başarılı: ${response.data.message}`);
        logs.push(`📊 ${response.data.summary.total_assignments} atama analiz edildi`);
        logs.push(`👥 ${response.data.summary.updated_drivers} sürücü güncellendi`);
        setDebugLogs([...logs]);
        alert(message);
      } else {
        logs.push(`\n❌ Hata: ${response.data.error}`);
        setDebugLogs([...logs]);
        alert(`❌ Hata: ${response.data.error}`);
      }

    } catch (error) {
      console.error('Analiz hatası:', error);
      setDebugLogs(prev => [...prev, `\n❌ HATA: ${error.message}`]);
      alert(`❌ Hata: ${error.message}`);
    }

    setIsProcessing(false);
  };

  const handleTestParse = async () => {
    // En az bir dosya yüklü mü kontrol et
    const uploadedFiles = Object.values(dailyFiles);
    if (uploadedFiles.length === 0) {
      alert('Önce bir HTML dosyası yükleyin!');
      return;
    }

    try {
      // İlk yüklenen dosyayı test et
      const firstFile = uploadedFiles[0];

      alert('Dosya yükleniyor...');
      const uploadResponse = await UploadFile({ file: firstFile });

      const { testAssignmentParse } = await import("@/functions/testAssignmentParse");
      const response = await testAssignmentParse({ file_url: uploadResponse.file_url });

      setTestResults(response.data);
      console.log("Test Results:", response.data);

      if (response.data.success) {
        alert(`✅ Parse başarılı!\n\n${response.data.sample_assignments?.length || 0} atama bulundu`);
      } else {
        alert(`❌ Parse başarısız: ${response.data.error}`);
      }
    } catch (error) {
      alert(`Test hatası: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Haftalık Atama Analizi</h1>
          <p className="text-slate-600">
            7 günlük gerçek atama verilerini analiz ederek sürücü profillerini ve algoritma parametrelerini güncelleyin
          </p>
        </div>

        {/* Hafta Başlangıç Tarihi Seçici */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <label htmlFor="week-start-date" className="font-semibold text-blue-900">Hafta Başlangıcı (Pazartesi):</label>
              </div>
              <input
                type="date"
                id="week-start-date"
                value={weekStartDate}
                onChange={(e) => {
                  setWeekStartDate(e.target.value);
                  setDailyFiles({}); // Tarihi değiştirince dosyaları sıfırla
                }}
                className="px-3 py-2 border border-blue-300 rounded-lg font-medium"
              />
              <span className="text-sm text-blue-700">
                → Pazar: {DAYS[6]?.date}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Debug Logs Card */}
        {debugLogs.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">🔍 Debug Logları</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                  {debugLogs.join('\n')}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Test Butonu */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-yellow-900">🔍 Atama HTML Parse Debug</p>
                <p className="text-sm text-yellow-700">Yüklediğiniz HTML formatını test edin</p>
              </div>
              <Button onClick={handleTestParse} variant="outline" className="border-yellow-300">
                Test Et
              </Button>
            </div>
            {testResults && (
              <div className="mt-4 bg-white rounded p-3 text-xs">
                <pre className="whitespace-pre-wrap">
                  {testResults.logs?.join('\n')}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dosya Yükleme Alanı */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Günlük Atama Raporları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {DAYS.map((day) => (
                <div key={day.key} className="border-2 border-dashed border-slate-300 rounded-lg p-4">
                  <input
                    type="file"
                    id={`file-${day.key}`}
                    accept=".html,.csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFileSelect(day.key, file);
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor={`file-${day.key}`} className="cursor-pointer flex flex-col items-center gap-2">
                    {dailyFiles[day.key] ? (
                      <>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <span className="text-xs font-medium text-green-700">{dailyFiles[day.key].dayLabel}</span>
                        <span className="text-xs text-slate-500">{dailyFiles[day.key].assignedDate}</span>
                        <span className="text-xs text-slate-500 truncate max-w-full">
                          {dailyFiles[day.key].name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">{day.label}</span>
                        <span className="text-xs text-slate-400">{day.date}</span>
                        <span className="text-xs text-slate-400">HTML Raporu</span>
                      </>
                    )}
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleAnalyze}
                disabled={isProcessing || Object.keys(dailyFiles).length === 0}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Analiz Et ve Güncelle
                  </>
                )}
              </Button>
            </div>

            {Object.keys(dailyFiles).length > 0 && (
              <div className="mt-4 text-center text-sm text-slate-600">
                ✓ {Object.keys(dailyFiles).length} gün seçildi
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sonuçlar */}
        {results && (
          <>
            {/* Özet İstatistikler */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4 text-center">
                  <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-900">{results.summary.total_days}</p>
                  <p className="text-sm text-blue-700">Gün Analiz Edildi</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-900">{results.summary.total_assignments}</p>
                  <p className="text-sm text-green-700">Toplam Atama</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-900">{results.summary.total_drivers}</p>
                  <p className="text-sm text-purple-700">Aktif Sürücü</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-900">{results.summary.avg_assignments_per_day}</p>
                  <p className="text-sm text-orange-700">Günlük Ortalama</p>
                </CardContent>
              </Card>
            </div>

            {/* Günlük Breakdown */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Günlük Detaylar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {results.daily_data.map((day, idx) => (
                    <Card key={idx} className="bg-slate-50 border-slate-200">
                      <CardContent className="p-4">
                        <p className="font-semibold text-slate-900 mb-2">{day.day_name}</p>
                        <p className="text-sm text-slate-600">{day.date}</p>
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Atama:</span>
                            <span className="font-medium text-slate-900">{day.assignments}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Sürücü:</span>
                            <span className="font-medium text-slate-900">{day.drivers}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sürücü Detayları */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Sürücü Analizi ({results.driver_stats.length} Sürücü)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {results.driver_stats.map((driver, idx) => (
                      <Card key={idx} className="bg-slate-50 border-slate-200">
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">{driver.driver_name}</h3>
                              <div className="flex gap-2 mt-2">
                                <Badge className="bg-blue-100 text-blue-800">
                                  {driver.total_orders} Sipariş
                                </Badge>
                                <Badge className="bg-green-100 text-green-800">
                                  {driver.working_days_count} Gün
                                </Badge>
                                <Badge className="bg-purple-100 text-purple-800">
                                  Ort: {driver.avg_orders_per_day}/gün
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Çalışma Günleri */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Çalışma Günleri
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {driver.working_days.map(day => (
                                  <Badge key={day} variant="outline" className="text-xs">
                                    {day}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* En Çok Teslimat Yaptığı Bölgeler */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                Top Bölgeler
                              </p>
                              <div className="space-y-1">
                                {driver.top_dropoff_cities.slice(0, 3).map((city, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-slate-600">{city.city}</span>
                                    <span className="font-medium text-slate-900">
                                      {city.count} ({city.percentage}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* En Aktif Saat Dilimleri */}
                            {driver.top_time_slots.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  Aktif Saatler
                                </p>
                                <div className="space-y-1">
                                  {driver.top_time_slots.map(([slot, count], i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span className="text-slate-600">{slot}</span>
                                      <span className="font-medium text-slate-900">{count} pickup</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Rota Zincirleri */}
                            {driver.chain_count > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2">
                                  🔗 {driver.chain_count} Rota Zinciri
                                </p>
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                    Detayları Gör
                                  </summary>
                                  <div className="mt-2 space-y-1 text-slate-600">
                                    {driver.chains.slice(0, 5).map((chain, i) => (
                                      <div key={i}>
                                        <span className="font-medium">{chain.date}:</span> {chain.chain}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Hatalar */}
            {results.errors && results.errors.length > 0 && (
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    Güncellenemeyen Sürücüler ({results.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.errors.map((error, idx) => (
                      <div key={idx} className="bg-white rounded p-3 text-sm">
                        <span className="font-medium text-slate-900">{error.driver}:</span>
                        <span className="text-red-600 ml-2">{error.error}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

      </div>
    </div>
  );
}
