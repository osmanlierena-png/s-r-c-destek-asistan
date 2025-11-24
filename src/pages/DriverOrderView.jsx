import React, { useState, useEffect } from "react";
import { DailyOrder } from "@/entities/DailyOrder";
import { Driver } from "@/entities/Driver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Calendar, Package } from "lucide-react";

export default function DriverOrderViewPage() {
  const [orders, setOrders] = useState([]);
  const [driver, setDriver] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      // URL'den parametreleri al
      const urlParams = new URLSearchParams(window.location.search);
      const driverId = urlParams.get('driver_id');
      const orderDate = urlParams.get('date');

      if (!driverId || !orderDate) {
        setError('Geçersiz link');
        setIsLoading(false);
        return;
      }

      // Sürücü bilgisini al
      const drivers = await Driver.filter({ id: driverId });
      if (drivers.length === 0) {
        setError('Sürücü bulunamadı');
        setIsLoading(false);
        return;
      }
      setDriver(drivers[0]);

      // Siparişleri al
      const ordersList = await DailyOrder.filter({
        driver_id: driverId,
        order_date: orderDate
      }, 'pickup_time');

      setOrders(ordersList);
      setIsLoading(false);
    } catch (error) {
      console.error('Yükleme hatası:', error);
      setError('Siparişler yüklenirken hata oluştu');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Siparişler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {driver?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Merhaba {driver?.name || 'Sürücü'}!
              </h1>
              <p className="text-slate-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Bugünkü Siparişleriniz ({orders.length})
              </p>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-slate-500">
              Bugün için sipariş bulunamadı.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <Card key={order.id} className="overflow-hidden shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Sipariş #{order.ezcater_order_id}
                    </span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                      {index + 1}. Sipariş
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    
                    {/* Pickup Address */}
                    <div className="p-4 bg-green-50">
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-green-700 uppercase mb-1">
                            Pickup Address
                          </p>
                          <p className="text-sm text-slate-900 font-medium leading-tight">
                            {order.pickup_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="p-4 bg-red-50">
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-700 uppercase mb-1">
                            Delivery Address
                          </p>
                          <p className="text-sm text-slate-900 font-medium leading-tight">
                            {order.dropoff_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pickup Time */}
                    <div className="p-4 bg-blue-50">
                      <div className="flex items-start gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                            Pickup Time
                          </p>
                          <p className="text-2xl text-slate-900 font-bold">
                            {order.pickup_time}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Time */}
                    <div className="p-4 bg-purple-50">
                      <div className="flex items-start gap-2 mb-2">
                        <Clock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-purple-700 uppercase mb-1">
                            Delivery Time
                          </p>
                          <p className="text-lg text-slate-900 font-bold">
                            {order.order_date}
                          </p>
                          <p className="text-2xl text-slate-900 font-bold">
                            {order.dropoff_time}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Customer Info */}
                  {order.customer_name && (
                    <div className="p-4 bg-slate-50 border-t">
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Müşteri:</span> {order.customer_name}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {order.ezcater_notes && (
                    <div className="p-4 bg-yellow-50 border-t">
                      <p className="text-xs font-semibold text-yellow-800 uppercase mb-1">Notlar:</p>
                      <p className="text-sm text-slate-700">{order.ezcater_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">
            Toplam {orders.length} Sipariş
          </p>
          <p className="text-slate-600">
            İyi çalışmalar! 🚚
          </p>
        </div>
      </div>
    </div>
  );
}