import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Save, TestTube, Loader2, CheckCircle, AlertCircle, Bug, Globe } from 'lucide-react';

export default function MessageTemplates() {
  const [settings, setSettings] = useState({
    message_template_tr: "Selam {driver_name}! {order_id} nolu siparişin {minutes} dakika sonra başlıyor. Hazır mısın? EVET veya HAYIR ile yanıt ver.\n\nPickup adresine ulaşınca Arrive'a basmayı unutma. Kolay gelsin! 🚗",
    message_template_en: "Hey {driver_name}! Your order {order_id} starts in {minutes} minutes. Are you ready? Reply YES or NO.\n\nDon't forget to press Arrive when you reach the pickup location. Good luck! 🚗",
    grouped_message_template_tr: "Selam {driver_name}! {order_count} pickup'ın var:\n\n{order_list}\n\nHazır mısın?\n✅ EVET\n❌ HAYIR\n\nPickup adreslerine ulaşınca Arrive'a basmayı unutma. Kolay gelsin! 🚗",
    grouped_message_template_en: "Hey {driver_name}! You have {order_count} pickups:\n\n{order_list}\n\nAre you ready?\n✅ YES\n❌ NO\n\nDon't forget to press Arrive when you reach the pickup locations. Good luck! 🚗",
    minutes_before: 60,
    is_active: false,
    response_timeout_minutes: 15
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [settingsId, setSettingsId] = useState(null);

  const [isTestingUnresponded, setIsTestingUnresponded] = useState(false);
  const [unrespondedResult, setUnrespondedResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const allSettings = await base44.entities.AutoMessageSettings.list();
      
      if (allSettings && allSettings.length > 0) {
        const saved = allSettings[0];
        setSettings({
          message_template_tr: saved.message_template_tr || settings.message_template_tr,
          message_template_en: saved.message_template_en || settings.message_template_en,
          grouped_message_template_tr: saved.grouped_message_template_tr || settings.grouped_message_template_tr,
          grouped_message_template_en: saved.grouped_message_template_en || settings.grouped_message_template_en,
          minutes_before: saved.minutes_before || settings.minutes_before,
          is_active: saved.is_active || false,
          response_timeout_minutes: saved.response_timeout_minutes || 15
        });
        setSettingsId(saved.id);
      } else {
        const newSettings = await base44.entities.AutoMessageSettings.create(settings);
        setSettingsId(newSettings.id);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (settingsId) {
        await base44.entities.AutoMessageSettings.update(settingsId, settings);
      } else {
        const newSettings = await base44.entities.AutoMessageSettings.create(settings);
        setSettingsId(newSettings.id);
      }
      alert('✅ Ayarlar kaydedildi!\n\n⚠️ Not: Otomatik mesajların çalışması için harici bir cron servisi (cron-job.org) ayarlanmalıdır.');
    } catch (error) {
      console.error('Kayıt hatası:', error);
      alert('❌ Ayarlar kaydedilemedi: ' + error.message);
    }
    setIsSaving(false);
  };

  const handleDebug = async () => {
    setIsDebugging(true);
    setDebugInfo(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const orders = await base44.entities.DailyOrder.filter({
        order_date: today,
        status: { $in: ["Atandı", "Sürücü Onayladı"] }
      });
      
      const now = new Date();
      const info = {
        date: today,
        currentTime: now.toLocaleTimeString('tr-TR'),
        totalOrders: orders.length,
        ordersWithTime: []
      };
      
      orders.forEach(order => {
        const pickupTimeStr = order.pickup_time || 'YOK';
        
        let targetTime = null;
        if (pickupTimeStr !== 'YOK') {
          try {
            let hours, minutes;
            if (pickupTimeStr.includes('AM') || pickupTimeStr.includes('PM')) {
              const isPM = pickupTimeStr.includes('PM');
              const timeOnly = pickupTimeStr.replace('AM', '').replace('PM', '').trim();
              const [h, m] = timeOnly.split(':');
              hours = parseInt(h);
              if (isPM && hours !== 12) hours += 12;
              if (!isPM && hours === 12) hours = 0;
              minutes = parseInt(m);
            } else {
              const parts = pickupTimeStr.split(':');
              hours = parseInt(parts[0]);
              minutes = parseInt(parts[1] || 0);
            }
            
            const pickupTime = new Date(now);
            pickupTime.setHours(hours, minutes, 0, 0);
            
            const messageTime = new Date(pickupTime.getTime() - (settings.minutes_before * 60 * 1000));
            const timeDiff = (messageTime.getTime() - now.getTime()) / 1000 / 60;
            
            targetTime = {
              pickup: pickupTime.toLocaleTimeString('tr-TR'),
              messageTime: messageTime.toLocaleTimeString('tr-TR'),
              minutesUntilMessage: Math.round(timeDiff),
              shouldSendNow: Math.abs(timeDiff) <= 5
            };
          } catch (e) {
            console.error('Time parse error:', e);
          }
        }
        
        info.ordersWithTime.push({
          orderId: order.ezcater_order_id,
          driver: order.driver_name,
          pickupTimeRaw: pickupTimeStr,
          parsedTime: targetTime
        });
      });
      
      setDebugInfo(info);
    } catch (error) {
      console.error('Debug hatası:', error);
      setDebugInfo({
        error: error.message
      });
    }
    
    setIsDebugging(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { sendScheduledMessages } = await import('@/functions/sendScheduledMessages');
      const response = await sendScheduledMessages({ targetDate: today });
      
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message,
          details: response.data.messagesSent
        });
      } else {
        setTestResult({
          success: false,
          message: response.data.message || response.data.error
        });
      }
    } catch (error) {
      console.error('Test hatası:', error);
      setTestResult({
        success: false,
        message: error.message
      });
    }
    
    setIsTesting(false);
  };

  const handleForceSend = async () => {
    if (!window.confirm('⚠️ FORCE SEND MODE\n\nBugünün TÜM "Sürücü Onayladı" siparişlerine (pickup time gözetmeksizin) test mesajı gönderilecek!\n\nEmin misiniz?')) {
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { sendScheduledMessages } = await import('@/functions/sendScheduledMessages');
      const response = await sendScheduledMessages({ 
        targetDate: today,
        forceMode: true
      });
      
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message,
          details: response.data.messagesSent
        });
      } else {
        setTestResult({
          success: false,
          message: response.data.message || response.data.error
        });
      }
    } catch (error) {
      console.error('Force send hatası:', error);
      setTestResult({
        success: false,
        message: error.message
      });
    }
    
    setIsTesting(false);
  };

  const handleTestUnresponded = async () => {
    setIsTestingUnresponded(true);
    setUnrespondedResult(null);
    
    try {
      const { checkUnrespondedMessages } = await import('@/functions/checkUnrespondedMessages');
      const response = await checkUnrespondedMessages({});
      
      if (response.data.success) {
        setUnrespondedResult({
          success: true,
          message: response.data.message,
          details: response.data.results
        });
      } else {
        setUnrespondedResult({
          success: false,
          message: response.data.error
        });
      }
    } catch (error) {
      console.error('Yanıtsız mesaj kontrolü hatası:', error);
      setUnrespondedResult({
        success: false,
        message: error.message
      });
    }
    
    setIsTestingUnresponded(false);
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Ayarlar yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Otomatik Hatırlatma Mesajı
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Pickup öncesi sürücülere EVET/HAYIR onayı isteyen hatırlatma gönder
            </p>
          </div>
          {settings.is_active && (
            <Badge className="bg-green-100 text-green-800">
              Aktif
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>✅ YENİ SİSTEM:</strong> Sürücü <strong>EVET</strong> derse → Hazır! <strong>HAYIR</strong> derse → Sisteme alert düşer ve operasyon ekibi bilgilendirilir.
          </p>
          <p className="text-sm text-blue-800 mt-2">
            <strong>📱 Arrive Hatırlatması:</strong> Mesajın sonunda "Pickup adresine ulaşınca Arrive'a bas" hatırlatması var.
          </p>
        </div>

        {/* 🆕 GRUPLANDIRMA SİSTEMİ BİLGİSİ */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">🔗 Akıllı Gruplandırma Sistemi</h4>
          <div className="text-sm text-purple-800 space-y-1">
            <p>• Aynı sürücüye ait siparişler pickup time'larına göre kontrol edilir</p>
            <p>• Pickup time farkı <strong>2.5 saatten az</strong> ise → Tek mesajda birleştirilir</p>
            <p>• Pickup time farkı <strong>2.5 saatten fazla</strong> ise → Ayrı mesajlar gönderilir</p>
            <p className="text-xs text-purple-600 mt-2 italic">
              Bu sistem otomatik çalışır, mesaj sayısını azaltır ve sürücüleri rahatsız etmez.
            </p>
          </div>
        </div>

        {/* 🆕 YANITSIZ MESAJ TAKİP SİSTEMİ */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-900 mb-2">🔔 Yanıtsız Mesaj Takip Sistemi</h4>
          <div className="text-sm text-orange-800 space-y-1">
            <p>• <strong>20 dakika</strong> yanıt yok → İkinci hatırlatma mesajı gönderilir</p>
            <p>• <strong>30 dakika</strong> yanıt yok → 🚨 KIRMIZI LİSTE (Case oluşur, kritik alert)</p>
            <p className="text-xs text-orange-600 mt-2 italic">
              Not: Gruplandırılmış mesajlar için tek bir takip yapılır (gereksiz tekrar mesaj önlenir)
            </p>
          </div>
          <div className="mt-3">
            <Button 
              onClick={handleTestUnresponded}
              disabled={isTestingUnresponded}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              size="sm"
            >
              {isTestingUnresponded ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kontrol Ediliyor...
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Yanıtsız Mesajları Kontrol Et
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 🆕 YANITSIZ MESAJ SONUÇLARI */}
        {unrespondedResult && (
          <div className={`p-4 rounded-lg border-2 ${
            unrespondedResult.success 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {unrespondedResult.success ? (
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  unrespondedResult.success ? 'text-blue-900' : 'text-red-900'
                }`}>
                  {unrespondedResult.message}
                </p>
                {unrespondedResult.details && (
                  <div className="mt-3 space-y-3 text-sm">
                    {unrespondedResult.details.secondRemindersSent?.length > 0 && (
                      <div className="bg-yellow-50 rounded p-2">
                        <p className="font-semibold text-yellow-800">⚠️ İkinci Hatırlatma Gönderilen ({unrespondedResult.details.secondRemindersSent.length}):</p>
                        {unrespondedResult.details.secondRemindersSent.map((item, i) => (
                          <p key={i} className="text-xs text-yellow-700 mt-1">
                            • {item.order} - {item.driver} ({item.minutesSinceFirst} dk)
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {unrespondedResult.details.escalatedToCritical?.length > 0 && (
                      <div className="bg-red-50 rounded p-2">
                        <p className="font-semibold text-red-800">🚨 Kırmızı Listeye Alınan ({unrespondedResult.details.escalatedToCritical.length}):</p>
                        {unrespondedResult.details.escalatedToCritical.map((item, i) => (
                          <p key={i} className="text-xs text-red-700 mt-1">
                            • {item.order} - {item.driver} ({item.minutesUnresponded} dk yanıtsız!)
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {unrespondedResult.details.stillWaiting?.length > 0 && (
                      <div className="bg-gray-50 rounded p-2">
                        <p className="font-semibold text-gray-800">⏳ Beklemede ({unrespondedResult.details.stillWaiting.length}):</p>
                        {unrespondedResult.details.stillWaiting.slice(0, 5).map((item, i) => (
                          <p key={i} className="text-xs text-gray-700 mt-1">
                            • {item.orderId} - {item.minutesSinceSent} dk geçti, {item.remainingMinutes} dk kaldı
                          </p>
                        ))}
                        {unrespondedResult.details.stillWaiting.length > 5 && (
                          <p className="text-xs text-gray-500 mt-1">... ve {unrespondedResult.details.stillWaiting.length - 5} sipariş daha</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h4 className="font-medium">Otomatik Mesaj Gönder</h4>
            <p className="text-sm text-slate-500">Pickup saatinden önce hatırlatma SMS'i</p>
          </div>
          <Switch
            checked={settings.is_active}
            onCheckedChange={(checked) => setSettings({...settings, is_active: checked})}
          />
        </div>

        {settings.is_active && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Pickup Time'dan Kaç Dakika Önce?
              </label>
              <Input
                type="number"
                value={settings.minutes_before}
                onChange={(e) => setSettings({...settings, minutes_before: parseInt(e.target.value)})}
                className="w-32"
                min="5"
                max="120"
              />
              <p className="text-xs text-slate-500 mt-1">5-120 dakika arası</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Yanıt Bekleme Süresi (Dakika)
              </label>
              <Input
                type="number"
                value={settings.response_timeout_minutes}
                onChange={(e) => setSettings({...settings, response_timeout_minutes: parseInt(e.target.value)})}
                className="w-32"
                min="5"
                max="60"
              />
              <p className="text-xs text-slate-500 mt-1">Bu süreden sonra alert oluşur</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">📝 Tekil Sipariş Mesajları</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  🇹🇷 Türkçe Mesaj İçeriği
                </label>
                <Textarea
                  value={settings.message_template_tr}
                  onChange={(e) => setSettings({...settings, message_template_tr: e.target.value})}
                  placeholder="Türkçe mesaj..."
                  rows={5}
                />
                <p className="text-xs text-slate-500 mt-1">
                  <code>{`{driver_name}`}</code> = Sürücü adı, 
                  <code>{`{minutes}`}</code> = Dakika,
                  <code>{`{pickup_time}`}</code> = Pickup saati,
                  <code>{`{pickup_address}`}</code> = Pickup adresi
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  🇺🇸 İngilizce Mesaj İçeriği
                </label>
                <Textarea
                  value={settings.message_template_en}
                  onChange={(e) => setSettings({...settings, message_template_en: e.target.value})}
                  placeholder="English message..."
                  rows={5}
                />
                <p className="text-xs text-slate-500 mt-1">
                  <code>{`{driver_name}`}</code> = Driver name, 
                  <code>{`{minutes}`}</code> = Minutes,
                  <code>{`{pickup_time}`}</code> = Pickup time,
                  <code>{`{pickup_address}`}</code> = Pickup address
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">🔗 Gruplandırılmış Sipariş Mesajları</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  🇹🇷 Türkçe Grup Mesajı
                </label>
                <Textarea
                  value={settings.grouped_message_template_tr}
                  onChange={(e) => setSettings({...settings, grouped_message_template_tr: e.target.value})}
                  placeholder="Türkçe grup mesajı..."
                  rows={6}
                />
                <p className="text-xs text-slate-500 mt-1">
                  <code>{`{driver_name}`}</code> = Sürücü adı, 
                  <code>{`{order_count}`}</code> = Sipariş sayısı,
                  <code>{`{order_list}`}</code> = Sipariş listesi (otomatik formatlanır)
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  🇺🇸 İngilizce Grup Mesajı
                </label>
                <Textarea
                  value={settings.grouped_message_template_en}
                  onChange={(e) => setSettings({...settings, grouped_message_template_en: e.target.value})}
                  placeholder="English group message..."
                  rows={6}
                />
                <p className="text-xs text-slate-500 mt-1">
                  <code>{`{driver_name}`}</code> = Driver name, 
                  <code>{`{order_count}`}</code> = Order count,
                  <code>{`{order_list}`}</code> = Order list (auto-formatted)
                </p>
              </div>
            </div>
          </>
        )}

        {debugInfo && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold mb-2">🔍 Debug Bilgisi</h4>
            <div className="text-sm space-y-1">
              <p><strong>Tarih:</strong> {debugInfo.date}</p>
              <p><strong>Şu an:</strong> {debugInfo.currentTime}</p>
              <p><strong>Atanmış Sipariş:</strong> {debugInfo.totalOrders}</p>
              
              {debugInfo.ordersWithTime && debugInfo.ordersWithTime.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="font-medium">Siparişler:</p>
                  {debugInfo.ordersWithTime.map((order, i) => (
                    <div key={i} className="pl-3 border-l-2 border-slate-300">
                      <p className="font-mono text-xs">{order.orderId}</p>
                      <p className="text-xs text-slate-600">{order.driver}</p>
                      <p className="text-xs">
                        Pickup: <strong>{order.pickupTimeRaw}</strong>
                      </p>
                      {order.parsedTime ? (
                        <>
                          <p className="text-xs">
                            Mesaj zamanı: <strong>{order.parsedTime.messageTime}</strong>
                          </p>
                          <p className={`text-xs font-semibold ${
                            order.parsedTime.shouldSendNow 
                              ? 'text-green-600' 
                              : order.parsedTime.minutesUntilMessage > 0
                                ? 'text-orange-600'
                                : 'text-red-600'
                          }`}>
                            {order.parsedTime.shouldSendNow 
                              ? '✅ ŞİMDİ GÖNDERİLMELİ!' 
                              : order.parsedTime.minutesUntilMessage > 0
                                ? `⏰ ${order.parsedTime.minutesUntilMessage} dk sonra`
                                : `❌ ${Math.abs(order.parsedTime.minutesUntilMessage)} dk önce geçti`
                            }
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-red-600">❌ Zaman parse edilemedi</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {debugInfo.error && (
                <p className="text-red-600">Hata: {debugInfo.error}</p>
              )}
            </div>
          </div>
        )}

        {testResult && (
          <div className={`p-4 rounded-lg border-2 ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  testResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {testResult.message}
                </p>
                {testResult.details && testResult.details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {testResult.details.map((msg, i) => (
                      <p key={i} className="text-sm text-green-800">
                        ✅ {msg.driver} ({msg.order}) - {msg.phone} [{msg.language.toUpperCase()}]
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end flex-wrap">
          <Button 
            onClick={handleDebug}
            disabled={isDebugging}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            {isDebugging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analiz Ediliyor...
              </>
            ) : (
              <>
                <Bug className="w-4 h-4 mr-2" />
                Bugünkü Siparişleri Göster
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleTest}
            disabled={isTesting || !settings.is_active}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test Ediliyor...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Normal Test (Zaman Kontrollü)
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleForceSend}
            disabled={isTesting || !settings.is_active}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 mr-2" />
                Force Send (Test)
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>

        {/* 🆕 CRON JOB KURULUM KILAVUZU */}
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-slate-900 mb-2">📋 Cron Job Kurulum</h4>
          <div className="text-sm text-slate-700 space-y-2">
            <p className="font-medium">cron-job.org'da 2 ayrı job oluştur:</p>
            <div className="bg-white rounded p-2 border border-slate-200">
              <p className="font-semibold">1️⃣ Hatırlatma Mesajları</p>
              <p className="text-xs text-slate-600 mt-1">Endpoint: <code>/sendScheduledMessages</code></p>
              <p className="text-xs text-slate-600">Interval: Her 5 dakika</p>
              <p className="text-xs text-green-600 mt-1">✅ Gruplandırma sistemi otomatik çalışır</p>
            </div>
            <div className="bg-white rounded p-2 border border-slate-200">
              <p className="font-semibold">2️⃣ Yanıtsız Mesaj Kontrolü</p>
              <p className="text-xs text-slate-600 mt-1">Endpoint: <code>/checkUnrespondedMessages</code></p>
              <p className="text-xs text-slate-600">Interval: Her 5 dakika</p>
              <p className="text-xs text-green-600 mt-1">✅ Grup mesajları için tek takip yapar</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}