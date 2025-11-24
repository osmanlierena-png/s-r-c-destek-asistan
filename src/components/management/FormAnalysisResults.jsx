
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, AlertCircle, TrendingUp, User, Phone, MapPin, Calendar, Trash2 } from "lucide-react";

export default function FormAnalysisResults({ report, onClose, onConfirmUpdate, isUpdatingFromForm }) {
    // Eşleşmeleri state'e al ki silebilsin
    const [filteredMatched, setFilteredMatched] = useState(report?.matched || []);
    const [markingTopDashers, setMarkingTopDashers] = useState(false);
    
    if (!report) return null;

    const { notFoundInSystem } = report;
    
    // Dinamik hesaplama
    const matchedCount = filteredMatched.length;
    const withChanges = filteredMatched.filter(m => m.hasChanges).length;

    // Eşleşme silme
    const handleRemoveMatch = (matchToRemove) => {
        if (window.confirm(`"${matchToRemove.systemName}" eşleşmesini kaldırmak istiyor musunuz?`)) {
            setFilteredMatched(prev => prev.filter(m => m.systemDriver.id !== matchToRemove.systemDriver.id));
        }
    };

    // Güncellenmiş raporu oluştur
    const getUpdatedReport = () => {
        return {
            ...report,
            matched: filteredMatched,
            matchedCount: filteredMatched.length,
            withChanges: filteredMatched.filter(m => m.hasChanges).length
        };
    };

    // Eşleşenleri Top Dasher Yap
    const handleMarkAllAsTopDasher = async () => {
        if (!window.confirm(`${filteredMatched.length} eşleşen sürücüyü Top Dasher olarak işaretlemek istiyor musunuz?`)) {
            return;
        }

        setMarkingTopDashers(true);
        try {
            const { Driver } = await import("@/entities/Driver");
            
            let successCount = 0;
            for (const match of filteredMatched) {
                try {
                    await Driver.update(match.systemDriver.id, { is_top_dasher: true });
                    successCount++;
                } catch (error) {
                    console.error(`${match.systemName} güncellenemedi:`, error);
                }
            }
            
            alert(`✅ ${successCount}/${filteredMatched.length} sürücü Top Dasher yapıldı!`);
        } catch (error) {
            alert(`❌ Hata: ${error.message}`);
        }
        setMarkingTopDashers(false);
    };

    // Top Dasher'ları Geri Al
    const handleUnmarkAllTopDashers = async () => {
        const topDashers = filteredMatched.filter(m => m.systemDriver.is_top_dasher);
        
        if (topDashers.length === 0) {
            alert('ℹ️ Hiçbir sürücü Top Dasher değil!');
            return;
        }

        if (!window.confirm(`${topDashers.length} sürücünün Top Dasher işaretini kaldırmak istiyor musunuz?`)) {
            return;
        }

        setMarkingTopDashers(true);
        try {
            const { Driver } = await import("@/entities/Driver");
            
            let successCount = 0;
            for (const match of topDashers) {
                try {
                    await Driver.update(match.systemDriver.id, { is_top_dasher: false });
                    successCount++;
                } catch (error) {
                    console.error(`${match.systemName} güncellenemedi:`, error);
                }
            }
            
            alert(`✅ ${successCount}/${topDashers.length} sürücünün işareti kaldırıldı!`);
        } catch (error) {
            alert(`❌ Hata: ${error.message}`);
        }
        setMarkingTopDashers(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-6xl h-[90vh] flex flex-col bg-white shadow-2xl">
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                📋 Form Analiz Sonuçları
                            </CardTitle>
                            <p className="text-sm text-slate-600 mt-2">
                                Form verilerini sistem sürücüleriyle eşleştirme raporu
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Özet İstatistikler */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                            <p className="text-2xl font-bold text-blue-600">{matchedCount}</p>
                            <p className="text-xs text-slate-600">Eşleşen Sürücü</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                            <p className="text-2xl font-bold text-green-600">{withChanges}</p>
                            <p className="text-xs text-slate-600">Güncellenecek</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                            <p className="text-2xl font-bold text-orange-600">{notFoundInSystem.length}</p>
                            <p className="text-xs text-slate-600">Sistemde Yok</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                            <p className="text-2xl font-bold text-purple-600">
                                {matchedCount > 0 ? ((withChanges / matchedCount) * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-xs text-slate-600">Değişiklik Oranı</p>
                        </div>
                    </div>

                    {/* Top Dasher İşlem Butonları */}
                    {matchedCount > 0 && (
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={handleMarkAllAsTopDasher}
                                disabled={markingTopDashers}
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                                size="sm"
                            >
                                {markingTopDashers ? (
                                    <>Güncelleniyor...</>
                                ) : (
                                    <>⭐ Tüm Eşleşenleri Top Dasher Yap ({filteredMatched.length})</>
                                )}
                            </Button>
                            <Button
                                onClick={handleUnmarkAllTopDashers}
                                disabled={markingTopDashers}
                                variant="outline"
                                size="sm"
                            >
                                {markingTopDashers ? (
                                    <>Güncelleniyor...</>
                                ) : (
                                    <>↩️ Top Dasher İşaretlerini Kaldır</>
                                )}
                            </Button>
                        </div>
                    )}
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        
                        {/* Sistemde Olmayan Sürücüler */}
                        {notFoundInSystem.length > 0 && (
                            <div>
                                <h3 className="font-bold text-lg text-orange-700 mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Sistemde Bulunamayan Sürücüler ({notFoundInSystem.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {notFoundInSystem.map((name, idx) => (
                                        <Card key={idx} className="bg-orange-50 border-orange-200">
                                            <CardContent className="p-3">
                                                <p className="text-sm font-medium text-orange-900">{name}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Değişiklik Olan Sürücüler */}
                        {filteredMatched.filter(m => m.hasChanges).length > 0 && (
                            <div>
                                <h3 className="font-bold text-lg text-green-700 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    Güncellenecek Sürücüler ({filteredMatched.filter(m => m.hasChanges).length})
                                </h3>
                                <div className="space-y-4">
                                    {filteredMatched.filter(m => m.hasChanges).map((match, idx) => (
                                        <Card key={idx} className="bg-green-50 border-green-200">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-green-900 flex items-center gap-2">
                                                            <User className="w-4 h-4" />
                                                            {match.systemName}
                                                        </h4>
                                                        <p className="text-xs text-green-700 mt-1">
                                                            Form: "{match.formName}"
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-green-600 text-white">
                                                            {(match.matchScore * 100).toFixed(0)}% eşleşme
                                                        </Badge>
                                                        {/* SİLME BUTONU */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveMatch(match)}
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            title="Bu eşleşmeyi kaldır"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {match.changes.map((change, cIdx) => (
                                                        <div key={cIdx} className="bg-white rounded-lg p-3 border border-green-200">
                                                            <div className="flex items-start gap-2">
                                                                {change.field === 'address' && <MapPin className="w-4 h-4 text-green-600 mt-0.5" />}
                                                                {change.field === 'phone' && <Phone className="w-4 h-4 text-green-600 mt-0.5" />}
                                                                {change.field === 'working_days' && <Calendar className="w-4 h-4 text-green-600 mt-0.5" />}
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-medium text-slate-600 uppercase">
                                                                        {change.field === 'address' && 'Adres'}
                                                                        {change.field === 'phone' && 'Telefon'}
                                                                        {change.field === 'working_days' && 'Çalışma Günleri'}
                                                                        {change.field === 'preferred_area_note' && 'Tercih Edilen Bölge'}
                                                                    </p>
                                                                    <div className="mt-1 space-y-1">
                                                                        <p className="text-sm text-slate-500">
                                                                            <span className="font-medium">Eski:</span>{' '}
                                                                            <span className="line-through">{change.current}</span>
                                                                        </p>
                                                                        <p className="text-sm text-green-700 font-medium">
                                                                            <span className="font-medium">Yeni:</span> {change.new}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <p className="text-xs text-green-600 mt-2 italic">
                                                    💡 {match.matchReason}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Değişiklik Olmayan Ama Eşleşen */}
                        {filteredMatched.filter(m => !m.hasChanges).length > 0 && (
                            <div>
                                <h3 className="font-bold text-lg text-blue-700 mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Değişiklik Olmayan Eşleşmeler ({filteredMatched.filter(m => !m.hasChanges).length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {filteredMatched.filter(m => !m.hasChanges).map((match, idx) => (
                                        <Card key={idx} className="bg-blue-50 border-blue-200 relative">
                                            <CardContent className="p-3">
                                                {/* SİLME BUTONU */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveMatch(match)}
                                                    className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    title="Bu eşleşmeyi kaldır"
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                                <p className="text-sm font-medium text-blue-900 pr-8">{match.systemName}</p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    {(match.matchScore * 100).toFixed(0)}% - {match.matchReason}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                <div className="border-t p-4 bg-slate-50 flex justify-between items-center flex-shrink-0">
                    <div className="text-sm text-slate-600">
                        {withChanges > 0 ? (
                            <span>✅ {withChanges} sürücü güncellenmeye hazır</span>
                        ) : (
                            <span>ℹ️ Hiçbir sürücüde güncelleme gerekmiyor</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Kapat
                        </Button>
                        {withChanges > 0 && (
                            <Button 
                                onClick={() => onConfirmUpdate(getUpdatedReport())}
                                disabled={isUpdatingFromForm}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isUpdatingFromForm ? (
                                    <>Güncelleniyor...</>
                                ) : (
                                    <>✅ {withChanges} Sürücüyü Güncelle</>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
