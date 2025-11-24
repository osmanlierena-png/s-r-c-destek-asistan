
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2, TrendingUp, MapPin, Navigation, BarChart3, Download } from 'lucide-react'; // Added Download icon
import { UploadFile } from '@/integrations/Core';
import { analyzeDriverRegions } from '@/functions/analyzeDriverRegions';
import { updateDriverRegionProfiles } from "@/functions/updateDriverRegionProfiles";

export default function DriverRegionAnalysis() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState(null);
    const [isUpdatingProfiles, setIsUpdatingProfiles] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const uploadResponse = await UploadFile({ file });
            const response = await analyzeDriverRegions({ file_url: uploadResponse.file_url });
            
            if (response.data.success) {
                setResults(response.data);
                alert(`✅ ${response.data.total_drivers} sürücü, ${response.data.total_assignments} sipariş analiz edildi!`);
            } else {
                alert(`❌ Hata: ${response.data.error}`);
            }
        } catch (error) {
            alert(`❌ Analiz hatası: ${error.message}`);
            console.error('Analiz hatası:', error);
        }
        setIsAnalyzing(false);
    };

    const handleDownloadAnalysis = () => {
        if (!results) return;
        
        // JSON formatında indir
        const dataStr = JSON.stringify(results, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `surucu_bolge_analizi_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    const handleDownloadReadable = () => {
        if (!results) return;
        
        // Okunabilir TXT formatında indir
        let text = `📊 SÜRÜCÜ BÖLGE ANALİZİ\n`;
        text += `${'='.repeat(80)}\n\n`;
        text += `📅 Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
        text += `👥 Toplam Sürücü: ${results.total_drivers}\n`;
        text += `📦 Toplam Sipariş: ${results.total_assignments}\n`;
        text += `📊 Ortalama: ${(results.total_assignments / results.total_drivers).toFixed(1)} sipariş/sürücü\n\n`;
        text += `${'='.repeat(80)}\n\n`;

        results.driver_stats.forEach((driver, idx) => {
            text += `\n${idx + 1}. 🚗 ${driver.driver_name}\n`;
            text += `${'-'.repeat(80)}\n`;
            text += `📊 Genel İstatistikler:\n`;
            text += `   • Toplam Sipariş: ${driver.total_orders}\n`;
            text += `   • Ortalama Mesafe: ${driver.avg_distance} mil\n`;
            text += `   • Max Mesafe: ${driver.max_distance} mil\n`;
            text += `   • Min Mesafe: ${driver.min_distance} mil\n`;
            text += `   • Uzun Mesafe Yüzdesi: ${driver.long_distance_percentage}%\n`;
            text += `   • Eyalet Geçiş Yüzdesi: ${driver.cross_state_percentage}%\n\n`;
            
            text += `🗺️ En Çok Gittiği Eyaletler (Top 3):\n`;
            driver.top_states.forEach((s, i) => {
                // Ensure s.state exists before accessing
                if (s && s.state) {
                    text += `   ${i + 1}. ${s.state}: ${s.count} sipariş (${s.percentage}%)\n`;
                }
            });
            text += `\n`;
            
            text += `🏙️ En Çok Gittiği Şehirler (Top 5):\n`;
            driver.top_cities.forEach((c, i) => {
                // Ensure c.city exists before accessing
                if (c && c.city) {
                    text += `   ${i + 1}. ${c.city}: ${c.count} sipariş (${c.percentage}%)\n`;
                }
            });
            text += `\n`;
            
            text += `📍 En Çok Gittiği Zip Code'lar (Top 10):\n`;
            driver.top_zip_codes.forEach((z, i) => {
                // Ensure z.zip exists before accessing
                if (z && z.zip) {
                    text += `   ${i + 1}. ${z.zip}: ${z.count} sipariş (${z.percentage}%)\n`;
                }
            });
            text += `\n`;
            
            text += `${'='.repeat(80)}\n`;
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `surucu_analizi_okunabilir_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    const handleUpdateProfiles = async () => {
        if (!results) return;
        
        setIsUpdatingProfiles(true);
        try {
            const response = await updateDriverRegionProfiles({
                analysis: results
            });
            
            if (response.data.success) {
                alert(`✅ ${response.data.message}\n\nGüncellenen: ${response.data.updatedCount}`);
            } else {
                alert(`❌ Hata: ${response.data.error}`);
            }
        } catch (error) {
            alert(`❌ Profil güncelleme hatası: ${error.message}`);
            console.error('Profil güncelleme hatası:', error);
        }
        setIsUpdatingProfiles(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sürücü Bölge Analizi</h1>
                    <p className="text-slate-600 text-sm">1 aylık gerçek atama verisinden sürücü bölge profillerini çıkar</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Data Report Yükle</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                            <input
                                type="file"
                                accept=".html"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="data-upload"
                                disabled={isAnalyzing}
                            />
                            <label
                                htmlFor="data-upload"
                                className={`cursor-pointer flex flex-col items-center gap-2 ${
                                    isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                <Upload className="w-12 h-12 text-slate-400" />
                                <p className="text-sm text-slate-600">
                                    {isAnalyzing ? 'Analiz ediliyor...' : 'Data Report HTML dosyası seç'}
                                </p>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {isAnalyzing && (
                    <Card>
                        <CardContent className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                <span className="text-slate-600">Sürücü profilleri oluşturuluyor...</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {results && (
                    <>
                        {/* Özet */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card>
                                <CardContent className="p-6 text-center">
                                    <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-slate-900">{results.total_drivers}</p>
                                    <p className="text-sm text-slate-600">Sürücü</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 text-center">
                                    <BarChart3 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-slate-900">{results.total_assignments}</p>
                                    <p className="text-sm text-slate-600">Toplam Sipariş</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6 text-center">
                                    <Navigation className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-slate-900">
                                        {(results.total_assignments / results.total_drivers).toFixed(1)}
                                    </p>
                                    <p className="text-sm text-slate-600">Ort. Sipariş/Sürücü</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* İndirme ve Güncelleme Butonları */}
                        <div className="flex gap-3 justify-end">
                            <Button
                                onClick={handleUpdateProfiles}
                                disabled={isUpdatingProfiles}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {isUpdatingProfiles ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Güncelleniyor...
                                    </>
                                ) : (
                                    <>
                                        <TrendingUp className="w-4 h-4 mr-2" />
                                        🔄 Driver Profillerini Güncelle
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleDownloadReadable}
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                📄 Okunabilir Rapor İndir (TXT)
                            </Button>
                            <Button
                                onClick={handleDownloadAnalysis}
                                variant="outline"
                                className="border-green-300 text-green-700 hover:bg-green-50"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                💾 JSON Veri İndir
                            </Button>
                        </div>

                        {/* Sürücü Detayları */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Sürücü Profilleri</CardTitle>
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
                                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                                <Badge className="bg-blue-100 text-blue-800">
                                                                    {driver.total_orders} Sipariş
                                                                </Badge>
                                                                <Badge className="bg-green-100 text-green-800">
                                                                    Ort: {driver.avg_distance} mil
                                                                </Badge>
                                                                <Badge className="bg-purple-100 text-purple-800">
                                                                    {driver.long_distance_percentage}% Uzun Mesafe
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {/* En Çok Gittiği Eyaletler */}
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                                                <MapPin className="w-4 h-4" />
                                                                Top Eyaletler
                                                            </p>
                                                            <div className="space-y-1">
                                                                {driver.top_states.map((s, i) => (
                                                                    <div key={i} className="flex justify-between text-sm">
                                                                        <span className="text-slate-600">{s.state}</span>
                                                                        <span className="font-medium text-slate-900">
                                                                            {s.count} ({s.percentage}%)
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {driver.cross_state_percentage > 0 && (
                                                                <p className="text-xs text-orange-600 mt-2">
                                                                    🔀 {driver.cross_state_percentage}% eyalet geçişli
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* En Çok Gittiği Şehirler */}
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-700 mb-2">
                                                                Top Şehirler
                                                            </p>
                                                            <div className="space-y-1">
                                                                {driver.top_cities.slice(0, 4).map((c, i) => (
                                                                    <div key={i} className="flex justify-between text-sm">
                                                                        <span className="text-slate-600 truncate">{c.city}</span>
                                                                        <span className="font-medium text-slate-900 ml-2">
                                                                            {c.count}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Mesafe İstatistikleri */}
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-700 mb-2">
                                                                Mesafe Profili
                                                            </p>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-600">Ortalama:</span>
                                                                    <span className="font-medium">{driver.avg_distance} mil</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-600">Maksimum:</span>
                                                                    <span className="font-medium">{driver.max_distance} mil</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-600">Minimum:</span>
                                                                    <span className="font-medium">{driver.min_distance} mil</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-600">Short/Long:</span>
                                                                    <span className="font-medium">
                                                                        {driver.short_distance_count}/{driver.long_distance_count}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Top Zip Codes */}
                                                    <details className="mt-3">
                                                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                                                            Top 10 Zip Code'u göster
                                                        </summary>
                                                        <div className="mt-2 grid grid-cols-5 gap-2">
                                                            {driver.top_zip_codes.map((z, i) => (
                                                                <Badge key={i} variant="outline" className="text-xs">
                                                                    {z.zip} ({z.count})
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
