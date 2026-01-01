import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Phone,
  MapPin
} from 'lucide-react';

export default function MessageMonitoring() {
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]); // Tüm mesajlar stats için
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const getESTDate = () => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => getESTDate());

  const loadMessages = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`📅 ${selectedDate} tarihli mesajlar yükleniyor... (EST)`);

      // EST tarihini UTC'ye çevir: EST = UTC-5 (Kasım ayında, daylight saving bitti)
      const [year, month, day] = selectedDate.split('-').map(Number);
      const estStartUTC = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0)); // EST 00:00 = UTC 05:00
      const estEndUTC = new Date(Date.UTC(year, month - 1, day + 1, 4, 59, 59, 999)); // EST 23:59 = UTC 04:59 (ertesi gün)

      console.log(`🔍 EST Tarih: ${selectedDate}`);
      console.log(`🔍 UTC Aralığı: ${estStartUTC.toISOString()} - ${estEndUTC.toISOString()}`);

      // Tüm mesajları çek (geniş aralık)
      const allData = await base44.entities.CheckMessage.list('-created_date', 1000);

      console.log(`📨 Toplam ${allData.length} mesaj bulundu`);

      // Seçilen UTC aralığına uyan mesajları filtrele
      const data = allData.filter(msg => {
        const msgDate = new Date(msg.created_date);
        return msgDate >= estStartUTC && msgDate <= estEndUTC;
      });

      console.log(`✅ ${data.length} mesaj seçilen tarihe uyuyor (${selectedDate} EST = ${estStartUTC.toISOString()} - ${estEndUTC.toISOString()} UTC)`);

      if (data.length > 0) {
        console.log('İlk 3 mesaj:', data.slice(0, 3).map(m => ({
          id: m.id,
          order_id: m.order_id,
          created_date: m.created_date,
          est_date: new Date(m.created_date).toLocaleString('en-US', { timeZone: 'America/New_York' }),
          driver_phone: m.driver_phone,
          status: m.message_status
        })));
      } else {
        console.log('❌ Seçilen tarihte mesaj yok.');
        if (allData.length > 0) {
          console.log('Örnek mesaj tarihleri:');
          console.log(allData.slice(0, 5).map(m => ({
            created_date: m.created_date,
            est_date: new Date(m.created_date).toLocaleString('en-US', { timeZone: 'America/New_York' })
          })));
        }
      }
      
      // İlgili siparişleri çek
      const orderIds = [...new Set(data.map(m => m.order_id).filter(Boolean))];
      let orders = [];
      if (orderIds.length > 0) {
        try {
          orders = await base44.entities.DailyOrder.filter({
            id: { $in: orderIds }
          });
        } catch (error) {
          console.log('⚠️ Siparişler yüklenemedi:', error.message);
        }
      }
      
      // 🔥 Mesajları zenginleştir (sipariş bilgisiyle)
      const enrichedMessages = data.map(msg => {
        const orderData = orders.find(o => o.id === msg.order_id) || null;
        
        const sentTime = new Date(msg.sent_time);
        const now = new Date();
        const minutesSinceSent = Math.floor((now - sentTime) / 1000 / 60);
        
        let alertLevel = msg.alert_level || 'Normal';
        if (!msg.response_received) {
          if (minutesSinceSent >= 30) {
            alertLevel = 'Acil';
          } else if (minutesSinceSent >= 20) {
            alertLevel = 'Uyarı';
          }
        }
        
        let status = 'pending';
        if (msg.message_status === 'failed') {
          status = 'failed';
        } else if (msg.response_received) {
          status = 'responded';
        } else if (alertLevel === 'Acil') {
          status = 'critical';
        } else if (alertLevel === 'Uyarı') {
          status = 'warning';
        } else {
          status = 'sent';
        }
        
        return {
          ...msg,
          orderData,
          minutesSinceSent,
          alertLevel,
          status,
          lastUpdateTime: msg.response_time || msg.sent_time
        };
      });
      
      // Her sürücü için en kritik mesajı seç
      const messagesByDriver = enrichedMessages.reduce((acc, msg) => {
        const driverKey = msg.driver_phone;
        if (!driverKey) return acc;
        
        if (!acc[driverKey]) {
          acc[driverKey] = msg;
        } else {
          const existing = acc[driverKey];
          
          // Öncelik sırası: failed > critical > warning > pending > sent > responded
          const priorityOrder = { failed: 0, critical: 1, warning: 2, pending: 3, sent: 4, responded: 5 };
          const existingPriority = priorityOrder[existing.status] ?? 10;
          const newPriority = priorityOrder[msg.status] ?? 10;
          
          if (newPriority < existingPriority) {
            acc[driverKey] = msg;
          } else if (newPriority === existingPriority) {
            // Aynı öncelikse, en son güncellenenı al
            if (new Date(msg.lastUpdateTime) > new Date(existing.lastUpdateTime)) {
              acc[driverKey] = msg;
            }
          }
        }
        
        return acc;
      }, {});
      
      // Obje değerlerini array'e çevir ve son güncelleme zamanına göre sırala
      const consolidatedMessages = Object.values(messagesByDriver).sort((a, b) => 
        new Date(b.lastUpdateTime) - new Date(a.lastUpdateTime)
      );
      
      setAllMessages(enrichedMessages); // Stats için tüm mesajları sakla
      setMessages(consolidatedMessages);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error);
      setError(error.message);
    }
    
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadMessages();
  }, [selectedDate]); // 🔥 Tarih değişince yeniden yükle
  
  useEffect(() => {
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const getTimeDiff = (sentTime) => {
    const now = new Date();
    const sent = new Date(sentTime);
    const diffMinutes = Math.floor((now - sent) / 1000 / 60);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} dakika önce`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} saat önce`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return `${days} gün önce`;
    }
  };

  const getAlertColor = (status) => {
    switch(status) {
      case 'responded': return 'text-green-600 bg-green-50';
      case 'sent': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'warning': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      case 'failed': return 'text-gray-600 bg-gray-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'responded': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'sent': return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-gray-600" />;
      default: return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const filteredMessages = filterStatus === 'all' 
    ? messages 
    : messages.filter(m => m.status === filterStatus);

  // Stats tüm mesajlar üzerinden hesaplanır (konsolide edilmemiş)
  const stats = {
    total: allMessages.length,
    sent: allMessages.filter(m => m.message_status === 'sent').length,
    failed: allMessages.filter(m => m.message_status === 'failed').length,
    responded: allMessages.filter(m => m.response_received).length,
    pending: allMessages.filter(m => !m.response_received && m.status === 'sent').length,
    warning: allMessages.filter(m => m.status === 'warning').length,
    critical: allMessages.filter(m => m.status === 'critical').length,
  };

  const getFilterLabel = (status) => {
    switch(status) {
      case 'all': return `Tümü (${stats.total})`;
      case 'responded': return `✅ Yanıt Verildi (${stats.responded})`;
      case 'sent': return `📤 Gönderildi (${stats.sent})`;
      case 'pending': return `⏳ Bekliyor (${stats.pending})`;
      case 'warning': return `⚠️ Uyarı (${stats.warning})`;
      case 'critical': return `🚨 Kritik (${stats.critical})`;
      case 'failed': return `❌ Başarısız (${stats.failed})`;
      default: return status;
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Mesaj Takip
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Gönderilen hatırlatma mesajlarının durumunu izleyin
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <p className="text-xs text-slate-500">
                Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
              </p>
            )}
            <button
              onClick={loadMessages}
              disabled={isLoading}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* 🔥 Tarih seçici ve Status filtresi yan yana */}
        <div className="flex gap-3">
          <Input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[180px]"
          />

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Durum filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getFilterLabel('all')}</SelectItem>
              <SelectItem value="responded">{getFilterLabel('responded')}</SelectItem>
              <SelectItem value="sent">{getFilterLabel('sent')}</SelectItem>
              <SelectItem value="pending">{getFilterLabel('pending')}</SelectItem>
              <SelectItem value="warning">{getFilterLabel('warning')}</SelectItem>
              <SelectItem value="critical">{getFilterLabel('critical')}</SelectItem>
              <SelectItem value="failed">{getFilterLabel('failed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'all' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400' : 'bg-slate-50 border-slate-200'}`}
            onClick={() => setFilterStatus('all')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-600">Toplam</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'sent' ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400' : 'bg-blue-50 border-blue-200'}`}
            onClick={() => setFilterStatus('sent')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
              <p className="text-xs text-blue-800">Gönderildi</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'failed' ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-400' : 'bg-gray-50 border-gray-200'}`}
            onClick={() => setFilterStatus('failed')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{stats.failed}</p>
              <p className="text-xs text-gray-800">Başarısız</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'responded' ? 'bg-green-100 border-green-400 ring-2 ring-green-400' : 'bg-green-50 border-green-200'}`}
            onClick={() => setFilterStatus('responded')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.responded}</p>
              <p className="text-xs text-green-800">Yanıt Verildi</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'pending' ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-yellow-50 border-yellow-200'}`}
            onClick={() => setFilterStatus('pending')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-yellow-800">Bekliyor</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'warning' ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-400' : 'bg-orange-50 border-orange-200'}`}
            onClick={() => setFilterStatus('warning')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.warning}</p>
              <p className="text-xs text-orange-800">Uyarı (20+ dk)</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'critical' ? 'bg-red-100 border-red-400 ring-2 ring-red-400' : 'bg-red-50 border-red-200'}`}
            onClick={() => setFilterStatus('critical')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-red-800">Kritik (30+ dk)</p>
            </CardContent>
          </Card>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Mesajlar yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Hata: {error}</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">
              {selectedDate} tarihinde mesaj bulunamadı
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg) => (
              <Card 
                key={msg.id} 
                className={`border-l-4 ${getAlertColor(msg.status)} cursor-pointer hover:shadow-md transition-all`}
                onClick={() => {
                  const info = [
                    `📦 Sipariş: ${msg.orderData?.ezcater_order_id || msg.order_id}`,
                    msg.orderData?.driver_name ? `👤 Sürücü: ${msg.orderData.driver_name}` : null,
                    `📞 Telefon: ${msg.driver_phone}`,
                    msg.orderData?.pickup_time ? `⏰ Pickup: ${msg.orderData.pickup_time}` : null,
                    msg.orderData?.pickup_address ? `📍 Adres: ${msg.orderData.pickup_address}` : null,
                    `✉️ Mesaj: ${msg.message_content?.substring(0, 100)}...`
                  ].filter(Boolean).join('\n');
                  alert(info);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(msg.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {msg.orderData?.driver_name || 'Bilinmeyen Sürücü'}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {msg.orderData?.ezcater_order_id || msg.order_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Badge variant="outline" className="text-xs">
                            {msg.message_type}
                          </Badge>
                          <span className="truncate">
                            {getTimeDiff(msg.lastUpdateTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!msg.response_received && msg.message_status !== 'failed' && (
                      <div className="text-sm font-semibold text-slate-700">
                        {msg.minutesSinceSent} dk
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold mb-2">Durum Açıklamaları:</p>
          <p>• <strong>Gönderildi:</strong> Mesaj başarıyla gönderildi, yanıt bekleniyor</p>
          <p>• <strong>Yanıt Verildi:</strong> Sürücü mesaja cevap verdi</p>
          <p>• <strong>Bekliyor:</strong> Mesaj gönderildi, henüz yanıt yok (20 dk altı)</p>
          <p>• <strong>Uyarı:</strong> 20+ dakika yanıt yok, ikinci hatırlatma gönderildi</p>
          <p>• <strong>Kritik:</strong> 30+ dakika yanıt yok, case oluşturuldu</p>
          <p>• <strong>Başarısız:</strong> Mesaj gönderilemedi</p>
        </div>
      </CardContent>
    </Card>
  );
}