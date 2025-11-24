import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, AlertCircle, TrendingUp, Users, Package } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { analyzeRealAssignments } from '@/functions/analyzeRealAssignments';

export default function RealAssignmentAnalysis() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) {
            console.log("❌ Dosya seçilmedi");
            return;
        }

        const file = files[0];
        console.log("✅ Dosya seçildi:", file.name, "Boyut:", file.size, "bytes");

        setIsAnalyzing(true);
        setError(null);
        setResults(null);

        try {
            console.log("📤 Dosya yükleniyor...");
            
            const uploadResponse = await UploadFile({ file: file });
            
            console.log("✅ Upload başarılı:", uploadResponse);
            
            const fileUrl = uploadResponse.file_url;
            
            if (!fileUrl) {
                throw new Error("file_url alınamadı");
            }

            console.log("🔍 Analiz başlatılıyor...", fileUrl);
            const response = await analyzeRealAssignments({ file_url: fileUrl });
            
            console.log("📊 Analiz response:", response);

            if (response.data.success) {
                setResults(response.data);
                console.log("✅ Analiz tamamlandı:", response.data.stats);
            } else {
                setError(response.data.error || "Bilinmeyen hata");
                console.error("❌ Analiz hatası:", response.data.error);
            }
        } catch (err) {
            console.error("❌ Kritik hata:", err);
            const errorMsg = err.message || String(err);
            setError(errorMsg);
            alert(`❌ Hata: ${errorMsg}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveToDatabase = async () => {
        if (!results) return;

        const confirmMessage = `${results.stats.total_orders} siparişi veritabanına kaydetmek istediğinizden emin misiniz?\n\nBu işlem:\n- DailyOrder'a kaydedecek\n- Sürücü tercihlerini güncelleyecek\n- Zincir rotalarını öğrenecek`;
        
        if (!window.confirm(confirmMessage)) return;

        setIsSaving(true);
        try {
            const { saveRealAssignments } = await import("@/functions/saveRealAssignments");
            const response = await saveRealAssignments({ 
                assignments: results.assignments,
                driver_groups: results.driver_groups,
                chains: results.chains
            });

            if (response.data.success) {
                alert(`✅ ${response.data.message}\n\n📊 Detaylar:\n- Kaydedilen: ${response.data.saved_count}\n- Güncellenen Sürücü: ${response.data.updated_drivers}`);
            } else {
                alert(`❌ Hata: ${response.data.error}`);
            }
        } catch (error) {
            alert(`❌ Kaydetme hatası: ${error.message}`);
            console.error('Kaydetme hatası:', error);
        }
        setIsSaving(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gerçek Atama Analizi</h1>
                    <p className="text-slate-600 text-sm">HERE Admin'den indirdiğin HTML raporunu yükle</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>HTML Raporu Yükle</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                            <input
                                type="file"
                                accept=".html"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="html-upload"
                                disabled={isAnalyzing}
                            />
                            <label
                                htmlFor="html-upload"
                                className={`cursor-pointer flex flex-col items-center gap-2 ${
                                    isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                <Upload className="w-12 h-12 text-slate-400" />
                                <p className="text-sm text-slate-600">
                                    {isAnalyzing ? 'Analiz ediliyor...' : 'HTML dosyası seç veya buraya sürükle'}
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
                                <span className="text-slate-600">HTML parse ediliyor ve analiz ediliyor...</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="py-6">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                                <div>
                                    <p className="font-semibold text-red-900">Hata</p>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {results && (
                    <>
                        {/* Kaydet Butonu */}
                        <div className="flex justify-end">
                            <Button
                                onClick={handleSaveToDatabase}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Veritabanına Kaydet ve Öğren
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* İstatistikler */}
                        <div className="grid grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Toplam Sipariş</p>
                                            <p className="text-3xl font-bold text-slate-900">{results.stats.total_orders}</p>
                                        </div>
                                        <Package className="w-8 h-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Toplam Sürücü</p>
                                            <p className="text-3xl font-bold text-slate-900">{results.stats.total_drivers}</p>
                                        </div>
                                        <Users className="w-8 h-8 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Zincirli Sürücü</p>
                                            <p className="text-3xl font-bold text-slate-900">{results.stats.drivers_with_chains}</p>
                                        </div>
                                        <TrendingUp className="w-8 h-8 text-purple-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Ort. Sipariş/Sürücü</p>
                                            <p className="text-3xl font-bold text-slate-900">{results.stats.avg_orders_per_driver}</p>
                                        </div>
                                        <CheckCircle className="w-8 h-8 text-yellow-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Zincirler */}
                        {results.chains.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Sipariş Zincirleri ({results.chains.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {results.chains.map((chain, idx) => (
                                            <div key={idx} className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-purple-900">{chain.driver}</span>
                                                    <span className="text-sm text-purple-700">{chain.orders} sipariş</span>
                                                </div>
                                                <div className="text-sm text-purple-800 font-mono">
                                                    {chain.times}
                                                </div>
                                                <div className="text-xs text-purple-600 mt-1">
                                                    {chain.order_ids.join(', ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sürücü Bazında Detay */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Sürücü Bazında Atamalar</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {Object.entries(results.driver_groups).map(([driverName, orders]) => (
                                        <div key={driverName} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-semibold text-slate-900">{driverName}</h3>
                                                <span className="text-sm text-slate-600">{orders.length} sipariş</span>
                                            </div>
                                            <div className="space-y-2">
                                                {orders.map((order, idx) => (
                                                    <div key={idx} className="bg-white rounded p-3 text-sm border border-slate-200">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-medium text-blue-700">#{order.order_id}</span>
                                                            <span className="text-slate-600 font-mono">{order.delivery_time}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-600">
                                                            <p><strong>Pickup:</strong> {order.pickup_location}</p>
                                                            <p><strong>Delivery:</strong> {order.delivery_address}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}