import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Info
} from "lucide-react";

export default function BulkMessagingPage() {
  const getESTDate = () => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => getESTDate());
  const [messageTemplate, setMessageTemplate] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);
  const [driverCount, setDriverCount] = useState(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState('approved_only');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const searchDrivers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const allDrivers = await base44.entities.Driver.filter({ status: 'Aktif' });
      const filtered = allDrivers.filter(d => 
        d.name && d.name.toLowerCase().includes(query.toLowerCase()) && d.phone && d.phone.trim() !== ''
      );
      setSearchResults(filtered.slice(0, 10)); // İlk 10 sonuç
    } catch (error) {
      console.error('Sürücü arama hatası:', error);
      setSearchResults([]);
    }
  };

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    setSearchQuery(driver.name);
    setSearchResults([]);
    setRecipientFilter('specific_driver');
    setDriverCount({
      drivers: 1,
      orders: 0,
      type: 'specific',
      driverName: driver.name
    });
  };

  const loadDriverCount = async (date, filter) => {
    if (filter === 'specific_driver' && selectedDriver) {
      setDriverCount({
        drivers: 1,
        orders: 0,
        type: 'specific',
        driverName: selectedDriver.name
      });
      return;
    }

    setIsLoadingCount(true);
    try {
      if (filter === 'approved_only') {
        const orders = await base44.entities.DailyOrder.filter({
          order_date: date,
          status: 'Sürücü Onayladı'
        });

        const uniqueDrivers = new Set();
        orders.forEach(order => {
          if (order.driver_id) {
            uniqueDrivers.add(order.driver_id);
          }
        });

        setDriverCount({
          drivers: uniqueDrivers.size,
          orders: orders.length,
          type: 'approved'
        });
      } else if (filter === 'all_active') {
        const allDrivers = await base44.entities.Driver.filter({
          status: 'Aktif'
        });

        const driversWithPhone = allDrivers.filter(d => d.phone && d.phone.trim() !== '');

        setDriverCount({
          drivers: driversWithPhone.length,
          orders: 0,
          type: 'all_active'
        });
      }
    } catch (error) {
      console.error('Sürücü sayısı yüklenirken hata:', error);
      setDriverCount(null);
    }
    setIsLoadingCount(false);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setResult(null);
    if (date) {
      loadDriverCount(date, recipientFilter);
    }
  };

  const handleFilterChange = (filter) => {
    setRecipientFilter(filter);
    setResult(null);
    if (filter !== 'specific_driver') {
      setSelectedDriver(null);
      setSearchQuery('');
      setSearchResults([]);
    }
    if (selectedDate) {
      loadDriverCount(selectedDate, filter);
    }
  };

  const sendBulkMessages = async () => {
    if (!messageTemplate.trim()) {
      alert('Lütfen mesaj şablonunu doldurun');
      return;
    }

    if (!selectedDate) {
      alert('Lütfen tarih seçin');
      return;
    }

    const confirmMsg = `${driverCount?.drivers || '?'} sürücüye mesaj gönderilecek. Emin misiniz?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('sendBulkMessages', {
        targetDate: selectedDate,
        messageTemplate: messageTemplate,
        messageType: recipientFilter,
        specificDriverId: recipientFilter === 'specific_driver' ? selectedDriver?.id : null
      });

      setResult(response);
      
      if (response.data.success) {
        // Mesaj başarılı gönderildiyse template'i temizle
        setMessageTemplate("");
      }
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    }

    setIsSending(false);
  };

  // Sayfa yüklendiğinde bugünün sürücülerini yükle
  React.useEffect(() => {
    loadDriverCount(selectedDate, recipientFilter);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Toplu Mesaj Gönder</h1>
          <p className="text-slate-600 text-sm">Onaylanmış siparişlerin sürücülerine toplu mesaj gönderin</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mesaj Ayarları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tarih Seçici ve Filtre */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sipariş Tarihi
                </label>
                <Input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Alıcı Filtresi
                </label>
                <Select value={recipientFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved_only">✅ Sadece Onaylananlar</SelectItem>
                    <SelectItem value="all_active">📞 Tüm Aktif Sürücüler</SelectItem>
                    <SelectItem value="specific_driver">🎯 Belirli Sürücü</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sürücü Arama */}
            {recipientFilter === 'specific_driver' && (
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sürücü Ara
                </label>
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchDrivers(e.target.value);
                  }}
                  placeholder="Sürücü adı yazın..."
                  className="w-full"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((driver) => (
                      <button
                        key={driver.id}
                        onClick={() => handleSelectDriver(driver)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{driver.name}</div>
                        <div className="text-xs text-slate-500">{driver.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sürücü Sayısı Gösterimi */}
            {selectedDate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-900">
                  <Users className="w-5 h-5" />
                  <span className="font-semibold">
                    {isLoadingCount ? (
                      "Yükleniyor..."
                    ) : driverCount ? (
                      `${driverCount.drivers} sürücü (${driverCount.orders} sipariş)`
                    ) : (
                      "Sürücü bulunamadı"
                    )}
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {driverCount?.type === 'approved' 
                    ? `"${selectedDate}" tarihindeki "Sürücü Onayladı" statusündeki siparişler`
                    : driverCount?.type === 'specific'
                    ? `Seçilen sürücü: ${driverCount.driverName}`
                    : 'Tüm aktif sürücüler (telefon numarası olanlar)'}
                </p>
              </div>
            )}

            {/* Mesaj Şablonu */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mesaj Şablonu
              </label>
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Mesajınızı buraya yazın..."
                rows={6}
                className="w-full"
              />
              <div className="flex items-start gap-2 mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Kullanabileceğiniz değişkenler:</p>
                  <p><code className="bg-white px-1 py-0.5 rounded">{"{driver_name}"}</code> - Sürücünün adı</p>
                  <p className="mt-2 text-slate-500">Örnek: "Merhaba {"{driver_name}"}, bugünkü siparişlerinle ilgili..."</p>
                </div>
              </div>
            </div>

            {/* Gönder Butonu */}
            <Button 
              onClick={sendBulkMessages}
              disabled={isSending || !messageTemplate.trim() || !driverCount?.drivers || (recipientFilter === 'specific_driver' && !selectedDriver)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Toplu Mesaj Gönder
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sonuç Gösterimi */}
        {result && (
          <Card className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.success ? '✅ Başarılı' : '❌ Hata'}
                  </h3>
                  <p className={`text-sm mb-3 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message || result.error}
                  </p>

                  {result.success && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <div className="text-slate-600 text-xs">Toplam Sürücü</div>
                        <div className="text-2xl font-bold text-slate-900">{result.totalDrivers}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <div className="text-slate-600 text-xs">Gönderilen</div>
                        <div className="text-2xl font-bold text-green-600">{result.sent}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <div className="text-slate-600 text-xs">Başarısız</div>
                        <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                      </div>
                    </div>
                  )}

                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm text-red-900 mb-2">Hatalar:</h4>
                      <div className="bg-white rounded-lg p-3 border border-red-200 max-h-48 overflow-y-auto">
                        {result.errors.map((err, idx) => (
                          <div key={idx} className="text-xs text-red-800 mb-2">
                            <span className="font-medium">{err.driver}</span> ({err.phone}): {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}