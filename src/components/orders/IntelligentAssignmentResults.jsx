import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, ArrowRight, MapPin, Sparkles, TrendingUp, Link as LinkIcon, AlertTriangle, Clock, X, User, Download } from 'lucide-react';

export default function IntelligentAssignmentResults({ results, onClose }) {
  const [activeTab, setActiveTab] = useState("assigned");

  // Güvenli veri kontrolü
  if (!results || !results.assignments) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hata</DialogTitle>
          </DialogHeader>
          <p>Sonuç verisi yüklenemedi.</p>
          <DialogFooter>
            <Button onClick={onClose}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Zincirleri grupla
  const chains = [];
  let currentChain = [];
  let lastDriver = null;

  (results.assignments || []).forEach((assignment, index) => {
    if (assignment.driverName === lastDriver) {
      currentChain.push(assignment);
    } else {
      if (currentChain.length > 0) {
        chains.push([...currentChain]);
      }
      currentChain = [assignment];
      lastDriver = assignment.driverName;
    }
  });
  if (currentChain.length > 0) {
    chains.push(currentChain);
  }

  const getScoreExplanation = (key) => {
    const explanations = {
      distance: "Sürücünün konumuna mesafe",
      region_expertise: "Bölge uzmanlığı",
      early_morning: "Erken sabah uzmanı",
      past_experience: "Geçmiş teslimat deneyimi",
      repeat_order: "Daha önce aynı sipariş",
      ai_score: "AI performans skoru",
      priority_bonus: "Atama önceliği",
      route_history: "Rota geçmişi",
      region_loyalty: "Bölge sadakati",
      preferred_areas: "Tercih edilen bölgeler",
      fairness: "Adil dağılım bonusu",
      random: "Rastgele varyasyon",
      time_chain: "Zaman uyumu",
      first_order_proximity: "İlk sipariş proximity",
      preferences: "Bölge tercihleri",
      performance: "Performans skoru",
      time_slot_chain: "Sabah/Akşam zincir bonusu",
      random_jitter: "Rastgele jitter"
    };
    return explanations[key] || key;
  };

  // Güvenli veri çıkarımı
  const unassignedOrders = (results.detailedLogs || []).filter(log => !log.selectedDriver);
  const actualUnassignedCount = (results.totalOrders || 0) - (results.assignedCount || 0);

  // Debug raporu indirme fonksiyonu
  const handleDownloadDebugReport = () => {
    let report = `🔍 ATAMA DEBUG RAPORU\n`;
    report += `${'='.repeat(80)}\n\n`;
    report += `📅 Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
    report += `📊 Toplam Sipariş: ${results.totalOrders || 0}\n`;
    report += `✅ Atanan: ${results.assignedCount || 0}\n`;
    report += `❌ Atanamayan: ${actualUnassignedCount}\n`;
    report += `👥 Çalışan Sürücü: ${results.available_drivers || 0}\n\n`;
    report += `${'='.repeat(80)}\n\n`;

    if (unassignedOrders.length > 0) {
      unassignedOrders.forEach((log, idx) => {
        report += `\n❌ ATANAMAYAN SİPARİŞ #${idx + 1}: ${log.order}\n`;
        report += `${'-'.repeat(80)}\n`;
        report += `Sebep: ${log.reason || 'Bilinmiyor'}\n\n`;

        if (log.allCandidates && log.allCandidates.length > 0) {
          report += `🔎 DEĞERLENDİRİLEN SÜRÜCÜLER (${log.allCandidates.length}):\n\n`;
          
          log.allCandidates.forEach((candidate, i) => {
            report += `${i + 1}. ${candidate.driverName}\n`;
            
            if (candidate.rejected) {
              report += `   ❌ REDDEDİLDİ: ${candidate.rejectionReason}\n`;
            } else {
              report += `   ✅ UYGUN\n`;
              report += `   Skor: ${candidate.totalScore}\n`;
              report += `   Mesafe: ${candidate.distance} mil\n`;
              
              if (candidate.scoreDetails) {
                report += `   Skor Detayları:\n`;
                Object.entries(candidate.scoreDetails).forEach(([key, value]) => {
                  const explanation = getScoreExplanation(key);
                  report += `      • ${explanation}: ${typeof value === 'number' ? Math.round(value * 1000) / 1000 : value}\n`;
                });
              }
            }
            report += `\n`;
          });
        } else {
          report += `⚠️ Hiçbir sürücü değerlendirilmedi!\n`;
        }
        
        report += `\n${'='.repeat(80)}\n`;
      });
    } else {
      report += `✅ Tüm siparişler başarıyla atandı!\n`;
    }

    // Dosyayı indir
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atama_debug_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Akıllı Atama Sonuçları
          </DialogTitle>
          <DialogDescription>
            {results.message || 'Atama tamamlandı'}. {chains.filter(c => c.length > 1).length} zincirleme atama tespit edildi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 my-4 text-center">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Toplam Sipariş</p>
            <p className="text-2xl font-bold">{results.totalOrders || 0}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Atanan Sipariş</p>
            <p className="text-2xl font-bold text-green-700">{results.assignedCount || 0}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">Zincirleme Atama</p>
            <p className="text-2xl font-bold text-purple-700">{chains.filter(c => c.length > 1).length}</p>
          </div>
          <div 
            className="p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
            onClick={() => setActiveTab("unassigned")}
          >
            <p className="text-sm text-red-600">Atanamayan</p>
            <p className="text-2xl font-bold text-red-700">{actualUnassignedCount}</p>
            <p className="text-xs text-red-500 mt-1">📋 Detayları gör</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assigned" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Başarılı Atamalar ({results.assignedCount || 0})
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Atanamayan Siparişler ({actualUnassignedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[450px] border rounded-lg p-4">
              <div className="space-y-4">
                {chains.map((chain, chainIndex) => (
                  <div key={chainIndex} className={`p-4 rounded-lg border-2 ${
                    chain.length > 1 
                      ? 'bg-purple-50 border-purple-300' 
                      : 'bg-white border-slate-200'
                  }`}>
                    {chain.length > 1 && (
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-200">
                        <LinkIcon className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-purple-900">
                          Zincirleme Rota: {chain[0].driverName}
                        </span>
                        <Badge className="bg-purple-600 text-white">
                          {chain.length} Sipariş
                        </Badge>
                      </div>
                    )}

                    {chain.map((assignment, index) => (
                      <div key={index} className={`${index > 0 ? 'mt-3 pt-3 border-t border-slate-200' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">
                              {chain.length > 1 && `${index + 1}. `}
                              {assignment.orderDetails}
                            </p>
                            <p className="text-sm text-blue-600 font-medium">
                              {assignment.driverName}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-purple-100 text-purple-800">
                              Skor: {assignment.score}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {assignment.distanceKm} mil
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1 mb-2">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 font-mono">{assignment.pickupTime}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <span>Pickup: {assignment.pickupAddress}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 font-mono">{assignment.dropoffTime}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <span>Dropoff: {assignment.dropoffAddress}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {assignment.scoreBreakdown && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Skor Detayları
                            </summary>
                            <div className="mt-2 p-2 bg-slate-50 rounded text-xs space-y-1">
                              {Object.entries(assignment.scoreBreakdown).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-slate-600">
                                    {getScoreExplanation(key)}:
                                  </span>
                                  <span className="font-mono text-slate-800">
                                    +{Math.round(value * 1000) / 1000}
                                  </span>
                                </div>
                              ))}
                              <div className="pt-1 border-t border-slate-300 flex justify-between font-semibold">
                                <span>TOPLAM:</span>
                                <span className="text-purple-700">{assignment.score}</span>
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unassigned" className="flex-1 overflow-hidden mt-4">
            {actualUnassignedCount > 0 && (
              <div className="mb-4 flex justify-end">
                <Button 
                  onClick={handleDownloadDebugReport}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Debug Raporu İndir ({actualUnassignedCount} sipariş)
                </Button>
              </div>
            )}
            
            <ScrollArea className="h-[450px] border rounded-lg p-4">
              <div className="space-y-3">
                {unassignedOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-slate-600">Tüm siparişler başarıyla atandı!</p>
                  </div>
                ) : (
                  unassignedOrders.map((log, index) => (
                    <div key={index} className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-slate-900 text-lg">{log.order}</p>
                          <p className="text-sm text-red-600 font-medium mt-1">
                            ⚠️ {log.reason || 'Hiçbir sürücü uygun değil'}
                          </p>
                        </div>
                        <Badge className="bg-red-600 text-white">Atanamadı</Badge>
                      </div>

                      {log.allCandidates && log.allCandidates.length > 0 ? (
                        <details className="mt-3" open>
                          <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {log.allCandidates.length} Sürücü Değerlendirildi
                          </summary>
                          <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                            {log.allCandidates.map((candidate, idx) => (
                              <div key={idx} className={`rounded-lg p-3 border-2 ${
                                candidate.rejected 
                                  ? 'bg-white border-red-200' 
                                  : 'bg-green-50 border-green-200'
                              }`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    {candidate.rejected ? (
                                      <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    )}
                                    <span className="font-semibold text-slate-800">{candidate.driverName}</span>
                                  </div>
                                  {candidate.rejected ? (
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                      ❌ Reddedildi
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      Skor: {candidate.totalScore}
                                    </Badge>
                                  )}
                                </div>
                                
                                {candidate.rejected && candidate.rejectionReason && (
                                  <div className="mt-2 p-2 bg-red-100 rounded text-sm">
                                    <p className="text-red-800 font-medium">
                                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                                      {candidate.rejectionReason}
                                    </p>
                                  </div>
                                )}
                                
                                {!candidate.rejected && candidate.distance && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    Mesafe: {candidate.distance} mil
                                  </p>
                                )}

                                {candidate.scoreDetails && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-blue-600 cursor-pointer">
                                      Skor Hesaplaması
                                    </summary>
                                    <div className="mt-1 p-2 bg-slate-50 rounded text-xs space-y-1">
                                      {Object.entries(candidate.scoreDetails).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                          <span>{getScoreExplanation(key)}:</span>
                                          <span className="font-mono">+{Math.round(value * 1000) / 1000}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="mt-2 p-3 bg-red-100 border border-red-200 rounded">
                          <p className="text-sm text-red-700">
                            ℹ️ Bu sipariş için hiçbir sürücü değerlendirilemedi.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button onClick={onClose} className="w-full">
            <CheckCircle className="w-4 h-4 mr-2" />
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}