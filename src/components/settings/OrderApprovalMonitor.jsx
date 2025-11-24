import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  User,
  Calendar,
  TrendingUp,
  XCircle,
  CheckCircle2
} from 'lucide-react';

export default function OrderApprovalMonitor() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    assigned: 0,
    completed: 0,
    problem: 0,
    other: 0
  });

  useEffect(() => {
    loadOrders();
    
    // Her 30 saniyede bir yenile
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Bugünkü tüm siparişleri çek
      const todayOrders = await base44.entities.DailyOrder.filter({
        order_date: today
      }, '-created_date', 200);

      // İstatistikleri hesapla
      const newStats = {
        total: todayOrders.length,
        approved: todayOrders.filter(o => o.status === 'Sürücü Onayladı').length,
        assigned: todayOrders.filter(o => o.status === 'Atandı').length,
        completed: todayOrders.filter(o => o.status === 'Tamamlandı').length,
        problem: todayOrders.filter(o => o.status === 'Problem').length,
        other: todayOrders.filter(o => 
          o.status !== 'Sürücü Onayladı' && 
          o.status !== 'Atandı' && 
          o.status !== 'Tamamlandı' && 
          o.status !== 'Problem'
        ).length
      };

      setOrders(todayOrders);
      setStats(newStats);
    } catch (error) {
      console.error('Siparişler yüklenemedi:', error);
      setError(error.message || 'Siparişler yüklenirken hata oluştu');
    }
    setIsLoading(false);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Sürücü Onayladı':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'Atandı':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'Çekildi':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'Tamamlandı':
        return 'bg-slate-100 border-slate-300 text-slate-800';
      case 'Problem':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Sürücü Onayladı':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Atandı':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'Tamamlandı':
        return <CheckCircle2 className="w-4 h-4 text-slate-600" />;
      case 'Problem':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Package className="w-4 h-4 text-slate-600" />;
    }
  };

  const willReceiveMessage = (order) => {
    // Mesaj alacak mı kontrol et
    if (order.status !== 'Sürücü Onayladı') return false;
    
    // Pickup time var mı?
    if (!order.pickup_time) return false;
    
    return true;
  };

  const ordersWillReceiveMessage = orders.filter(willReceiveMessage);
  const ordersWontReceiveMessage = orders.filter(o => 
    !willReceiveMessage(o) && 
    o.status !== 'Tamamlandı' && 
    o.status !== 'Problem' &&
    o.status !== 'Sürücü Reddetti'
  );
  const completedOrders = orders.filter(o => o.status === 'Tamamlandı');
  const problemOrders = orders.filter(o => o.status === 'Problem');
  const rejectedOrders = orders.filter(o => o.status === 'Sürücü Reddetti');

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Siparişler yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-red-200/50 shadow-lg">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-3" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={loadOrders} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tekrar Dene
          </Button>
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
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Sipariş Onay Durumu Kontrolü
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Hangi siparişlerin otomatik mesaj alacağını kontrol edin
            </p>
          </div>
          <Button
            onClick={loadOrders}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-600 mb-1">Toplam Sipariş</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 mb-1">Mesaj Alacak ✅</p>
            <p className="text-2xl font-bold text-green-600">{ordersWillReceiveMessage.length}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-xs text-yellow-600 mb-1">Beklemede ⏳</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.assigned}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 mb-1">Mesaj Almayacak ⚠️</p>
            <p className="text-2xl font-bold text-red-600">{ordersWontReceiveMessage.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-600 mb-1">Tamamlandı 🏁</p>
            <p className="text-2xl font-bold text-slate-600">{completedOrders.length}</p>
          </div>
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 mb-1">Problem ❌</p>
            <p className="text-2xl font-bold text-red-600">{problemOrders.length + rejectedOrders.length}</p>
          </div>
        </div>

        {/* Doğrulama */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 mb-2">
                📊 Toplam Doğrulama
              </p>
              <div className="text-sm text-blue-800 space-y-1">
                <p>✅ Mesaj Alacak: <strong>{ordersWillReceiveMessage.length}</strong></p>
                <p>⏳ Beklemede: <strong>{stats.assigned}</strong></p>
                <p>⚠️ Mesaj Almayacak: <strong>{ordersWontReceiveMessage.length}</strong></p>
                <p>🏁 Tamamlandı: <strong>{completedOrders.length}</strong></p>
                <p>❌ Problem/Reddedildi: <strong>{problemOrders.length + rejectedOrders.length}</strong></p>
                <p className="pt-2 border-t border-blue-300 mt-2">
                  <strong>TOPLAM: {ordersWillReceiveMessage.length + stats.assigned + ordersWontReceiveMessage.length + completedOrders.length + problemOrders.length + rejectedOrders.length}</strong>
                  {' '}
                  {(ordersWillReceiveMessage.length + stats.assigned + ordersWontReceiveMessage.length + completedOrders.length + problemOrders.length + rejectedOrders.length) === stats.total ? (
                    <span className="text-green-700">✅ Tüm siparişler hesaplandı!</span>
                  ) : (
                    <span className="text-red-700">❌ {stats.total - (ordersWillReceiveMessage.length + stats.assigned + ordersWontReceiveMessage.length + completedOrders.length + problemOrders.length + rejectedOrders.length)} sipariş eksik!</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Uyarı Mesajları */}
        {ordersWontReceiveMessage.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-900 mb-1">
                  ⚠️ DİKKAT: {ordersWontReceiveMessage.length} Sipariş Mesaj Almayacak!
                </p>
                <p className="text-sm text-yellow-800">
                  Bu siparişlerin durumu "Sürücü Onayladı" değil. 
                  Otomatik mesaj sistemi bunları görmeyecek!
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                  💡 Çözüm: Order Management sayfasında "Atamaları Onayla" butonuna basın.
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.assigned > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-1">
                  📋 {stats.assigned} Sipariş Onay Bekliyor
                </p>
                <p className="text-sm text-blue-800">
                  Bu siparişler "Atandı" durumunda. Onaylandıktan sonra mesaj alacaklar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mesaj Alacak Siparişler */}
        {ordersWillReceiveMessage.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Otomatik Mesaj Alacak Siparişler ({ordersWillReceiveMessage.length})
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {ordersWillReceiveMessage.map((order) => (
                <div
                  key={order.id}
                  className="bg-green-50 border border-green-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-900">
                          {order.ezcater_order_id}
                        </span>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          ✅ Mesaj Gönderilecek
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-green-800">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.driver_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pickup: {order.pickup_time}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mesaj Almayacak Siparişler */}
        {ordersWontReceiveMessage.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Mesaj Almayacak Siparişler ({ordersWontReceiveMessage.length})
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {ordersWontReceiveMessage.map((order) => (
                <div
                  key={order.id}
                  className={`border-2 rounded-lg p-3 ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(order.status)}
                        <span className="font-semibold">
                          {order.ezcater_order_id}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.driver_name || 'Atanmadı'}
                        </div>
                        {order.pickup_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {order.pickup_time}
                          </div>
                        )}
                      </div>
                      <p className="text-xs mt-2 opacity-80">
                        ❌ Neden mesaj almıyor: Durum "{order.status}" (Olması gereken: "Sürücü Onayladı")
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tamamlanan/Problem Siparişler */}
        {(completedOrders.length > 0 || problemOrders.length > 0 || rejectedOrders.length > 0) && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-600" />
              Kapanmış Siparişler ({completedOrders.length + problemOrders.length + rejectedOrders.length})
              <span className="text-xs font-normal text-slate-500">
                (Bu siparişler zaten tamamlandı veya problem oldu, mesaj gerekmez)
              </span>
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {[...completedOrders, ...problemOrders, ...rejectedOrders].map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-3 ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(order.status)}
                        <span className="font-semibold">
                          {order.ezcater_order_id}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.driver_name || 'Atanmadı'}
                        </div>
                        {order.pickup_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {order.pickup_time}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Açıklama */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-2 text-sm">📊 Nasıl Çalışır?</h4>
          <div className="space-y-2 text-xs text-slate-600">
            <p>
              <strong className="text-green-600">✅ Mesaj Alacak:</strong> Durumu "Sürücü Onayladı" olan ve pickup time bilgisi olan siparişler
            </p>
            <p>
              <strong className="text-yellow-600">⏳ Beklemede:</strong> "Atandı" durumunda. Onaylandıktan sonra mesaj alacaklar.
            </p>
            <p>
              <strong className="text-red-600">⚠️ Mesaj Almayacak:</strong> Başka durumda olanlar (Çekildi, vb.)
            </p>
            <p>
              <strong className="text-slate-600">🏁 Tamamlandı:</strong> Zaten teslim edilmiş siparişler
            </p>
            <p>
              <strong className="text-red-600">❌ Problem/Reddedildi:</strong> Problem yaşanan veya sürücü tarafından reddedilen siparişler
            </p>
            <p className="pt-2 border-t border-slate-200 mt-3">
              💡 <strong>Önemli:</strong> Otomatik mesaj sistemi sadece "Sürücü Onayladı" durumundaki siparişlere mesaj gönderir!
            </p>
          </div>
        </div>

        {/* Son Yenileme */}
        <div className="text-center text-xs text-slate-500">
          <p>Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</p>
          <p className="mt-1">Otomatik yenileme: Her 30 saniye</p>
        </div>
      </CardContent>
    </Card>
  );
}