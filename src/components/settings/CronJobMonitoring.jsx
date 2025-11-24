
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Play, // Used for Real Run button
  TestTube, // Used for Dry Run button and header icon
  Clock, // Used in grouped messages for pickup time
  MessageSquare, // Used in grouped messages icon
  Phone, // Used in grouped messages for phone number
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CronJobMonitoring() {
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isRealRunning, setIsRealRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [realRunResult, setRealRunResult] = useState(null);

  const handleDryRun = async () => {
    setIsDryRunning(true);
    setDryRunResult(null); // Clear previous dry run result
    setRealRunResult(null); // Clear real run result if dry run is initiated

    try {
      const response = await base44.functions.invoke('testScheduledMessages', {
        targetDate: new Date().toISOString().split('T')[0]
      });

      setDryRunResult(response.data);
    } catch (error) {
      setDryRunResult({
        success: false,
        error: error.message
      });
    }

    setIsDryRunning(false);
  };

  const handleRealRun = async () => {
    if (!window.confirm('⚠️ GERÇEK MESAJLAR GÖNDERİLECEK!\n\nBu işlem gerçek SMS gönderecek ve ücretlendirilecek.\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    setIsRealRunning(true);
    setRealRunResult(null); // Clear previous real run result
    setDryRunResult(null); // Clear dry run result if real run is initiated

    try {
      const response = await base44.functions.invoke('sendScheduledMessages', {});
      setRealRunResult(response.data);
    } catch (error) {
      setRealRunResult({
        success: false,
        error: error.message
      });
    }

    setIsRealRunning(false);
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5 text-purple-500" />
          Cron Job Test
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Zamanlanmış mesaj sistemini test edin
        </p>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="flex gap-3">
          <Button
            onClick={handleDryRun}
            disabled={isDryRunning || isRealRunning}
            className="bg-blue-600 hover:bg-blue-700 flex-1 h-auto py-3"
          >
            {isDryRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test Ediliyor...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                🧪 Dry Run (Mesaj Gönderilmez)
              </>
            )}
          </Button>

          <Button
            onClick={handleRealRun}
            disabled={isDryRunning || isRealRunning}
            className="bg-red-600 hover:bg-red-700 flex-1 h-auto py-3"
          >
            {isRealRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerçek Mesajlar Gönderiliyor...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                ⚡ Gerçek Çalıştır (SMS Gönderir!)
              </>
            )}
          </Button>
        </div>

        {/* 🔥 YENİ: GRUP MESAJLARI BÖLÜMÜ */}
        {dryRunResult && dryRunResult.groupedMessages && dryRunResult.groupedMessages.length > 0 && (
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              🔗 Gruplandırılmış Mesajlar
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 text-center border border-purple-200">
                <p className="text-xs text-slate-600">Toplam Mesaj</p>
                <p className="text-2xl font-bold text-purple-600">
                  {dryRunResult.summary?.total_messages || dryRunResult.groupedMessages.length}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-purple-200">
                <p className="text-xs text-slate-600">🔗 Grup</p>
                <p className="text-2xl font-bold text-purple-600">
                  {dryRunResult.summary?.grouped_messages || dryRunResult.groupedMessages.filter(m => m.order_count > 1).length}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                <p className="text-xs text-slate-600">📄 Tekil</p>
                <p className="text-2xl font-bold text-slate-600">
                  {dryRunResult.summary?.single_messages || dryRunResult.groupedMessages.filter(m => m.order_count === 1).length}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dryRunResult.groupedMessages.map((msg, idx) => {
                const isGrouped = msg.order_count > 1;
                return (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 ${
                      isGrouped
                        ? 'bg-gradient-to-r from-purple-100 to-indigo-100 border-2 border-purple-400'
                        : 'bg-white border border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isGrouped ? (
                          <>
                            <MessageSquare className="w-4 h-4 text-purple-600" />
                            <span className="font-bold text-purple-700">🔗 GRUP MESAJI</span>
                            <Badge className="bg-purple-600 text-white text-xs">
                              {msg.order_count} Sipariş
                            </Badge>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-slate-700">📄 Tekil</span>
                          </>
                        )}
                      </div>
                      <Badge className={
                        msg.status.includes('GÖNDERİLECEK') ? 'bg-green-600 text-white' :
                        msg.status.includes('ERKEN') ? 'bg-yellow-600 text-white' :
                        'bg-slate-400 text-white'
                      }>
                        {msg.status}
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1 text-slate-700">
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {msg.driver}
                      </p>
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        İlk Pickup: {msg.pickup_time} ({msg.minutes_until_pickup} dk kaldı)
                      </p>
                      {isGrouped && (
                        <div className="mt-2 space-y-1 pl-3 border-l-2 border-purple-400">
                          {msg.orders.map((o, i) => (
                            <p key={i} className="text-xs">
                              {i + 1}. {o.order_id} - {o.pickup_time}
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2">💡 {msg.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ESKİ: Sipariş detayları */}
        {dryRunResult && dryRunResult.details && (
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-3">📋 Tüm Sipariş Detayları</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 rounded p-2 text-center">
                <p className="text-xs text-slate-600">Gönderilecek</p>
                <p className="text-xl font-bold text-green-600">
                  {dryRunResult.summary?.would_send || 0}
                </p>
              </div>
              <div className="bg-yellow-50 rounded p-2 text-center">
                <p className="text-xs text-slate-600">Henüz Erken</p>
                <p className="text-xl font-bold text-yellow-600">
                  {dryRunResult.summary?.too_early || 0}
                </p>
              </div>
              <div className="bg-slate-50 rounded p-2 text-center">
                <p className="text-xs text-slate-600">Geçmiş</p>
                <p className="text-xl font-bold text-slate-600">
                  {dryRunResult.summary?.too_late || 0}
                </p>
              </div>
              <div className="bg-red-50 rounded p-2 text-center">
                <p className="text-xs text-slate-600">Hata</p>
                <p className="text-xl font-bold text-red-600">
                  {dryRunResult.summary?.errors || 0}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dryRunResult.details.map((detail, idx) => (
                <div key={idx} className="text-xs bg-slate-50 rounded p-2 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{detail.order_id}</span>
                      {detail.is_grouped && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          Grup ({detail.group_size})
                        </Badge>
                      )}
                    </div>
                    <span className={`font-semibold ${
                      detail.status.includes('GÖNDERİLECEK') ? 'text-green-600' :
                      detail.status.includes('ERKEN') ? 'text-yellow-600' :
                      'text-slate-500'
                    }`}>
                      {detail.status}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">{detail.driver}</p>
                  <p className="text-slate-500">{detail.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {realRunResult && (
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-3">⚡ Gerçek Çalıştırma Sonuçları</h3>

            {realRunResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded p-2 text-center">
                    <p className="text-xs text-slate-600">Gönderilen</p>
                    <p className="text-xl font-bold text-green-600">{realRunResult.sentCount || 0}</p>
                  </div>
                  <div className="bg-red-50 rounded p-2 text-center">
                    <p className="text-xs text-slate-600">Başarısız</p>
                    <p className="text-xl font-bold text-red-600">{realRunResult.failedCount || 0}</p>
                  </div>
                  <div className="bg-yellow-50 rounded p-2 text-center">
                    <p className="text-xs text-slate-600">Atlanan</p>
                    <p className="text-xl font-bold text-yellow-600">{realRunResult.skippedCount || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded p-2 text-center">
                    <p className="text-xs text-slate-600">🔗 Grup</p>
                    <p className="text-xl font-bold text-purple-600">{realRunResult.groupedMessages || 0}</p>
                  </div>
                </div>

                {realRunResult.sent && realRunResult.sent.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-green-700 mb-2">✅ Gönderilen Mesajlar:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {realRunResult.sent.map((s, i) => (
                        <div key={i} className="text-xs bg-green-50 rounded p-2 border border-green-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-semibold">{s.orderId}</span>
                            {s.isGrouped && (
                              <Badge className="bg-purple-600 text-white text-xs">
                                GRUP ({s.groupSize})
                              </Badge>
                            )}
                          </div>
                          <p>{s.driverName} - {s.driverPhone}</p>
                          <p className="text-slate-500">Pickup: {s.pickupTime}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {realRunResult.failed && realRunResult.failed.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-2">❌ Başarısız:</p>
                    <div className="space-y-1">
                      {realRunResult.failed.map((f, i) => (
                        <p key={i} className="text-xs text-red-600">• {f.orderId}: {f.reason}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 text-sm">
                ❌ Hata: {realRunResult.error}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 text-sm">⚙️ Cron Job Kurulumu:</h4>
          <div className="text-xs text-blue-800 space-y-2">
            <p>1. <strong>cron-job.org</strong> sitesine git</p>
            <p>2. Yeni cron job oluştur:</p>
            <div className="bg-white rounded p-2 font-mono text-xs border border-blue-300 mt-2">
              <p><strong>URL:</strong> [Dashboard → Code → Functions → sendScheduledMessages]</p>
              <p><strong>Schedule:</strong> Her 5 dakikada bir</p>
              <p><strong>Method:</strong> POST</p>
            </div>
            <p className="mt-2">3. Aktif et ve kaydet</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
