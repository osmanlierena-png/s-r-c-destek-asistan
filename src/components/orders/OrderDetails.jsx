
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  X, 
  MapPin, 
  Clock, 
  User, 
  Package,
  DollarSign,
  Calendar,
  Truck
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function OrderDetails({ order, onClose }) {
  const getStatusColor = (status) => {
    const colors = {
      'Çekildi': 'bg-blue-100 text-blue-800',
      'Atandı': 'bg-yellow-100 text-yellow-800',
      'Yolda': 'bg-purple-100 text-purple-800',
      'Tamamlandı': 'bg-green-100 text-green-800',
      'Problem': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Sadece saati temizle - "10:30 AM" veya "10:30:00 AM" formatında
  const cleanTime = (timeStr) => {
    if (!timeStr) return 'Belirtilmemiş';
    // Sadece ilk kısmı al (saat kısmı), gerisi gereksiz
    return timeStr.split('Select')[0].trim();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl mb-1 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Sipariş #{order.ezcater_order_id}
              </CardTitle>
              <p className="text-blue-100 text-sm">
                {format(new Date(order.created_date), 'dd MMMM yyyy, HH:mm', { locale: tr })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Müşteri Bilgileri */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              Müşteri Bilgileri
            </h3>
            <div className="space-y-2">
              <InfoRow label="Müşteri Adı" value={order.customer_name || 'Belirtilmemiş'} />
              <InfoRow label="Sipariş Tarihi" value={order.order_date} icon={<Calendar className="w-4 h-4 text-green-500" />} />
            </div>
          </div>

          {/* Zaman Bilgileri */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              Zaman Çizelgesi
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">Pickup (Alış)</p>
                  <p className="text-lg font-bold text-green-900">{cleanTime(order.pickup_time)}</p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-slate-300 h-4 ml-1"></div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">Dropoff (Teslim)</p>
                  <p className="text-lg font-bold text-red-900">{cleanTime(order.dropoff_time)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Adres Bilgileri */}
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 mb-1">Pickup Address (Alış Adresi)</p>
                  <p className="text-slate-900">{order.pickup_address}</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 mb-1">Dropoff Address (Teslim Adresi)</p>
                  <p className="text-slate-900">{order.dropoff_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sürücü Bilgileri */}
          {order.driver_name && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-yellow-600" />
                Atanan Sürücü
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">
                  {order.driver_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{order.driver_name}</p>
                  <p className="text-sm text-slate-600">Sürücü ID: {order.driver_id}</p>
                </div>
              </div>
            </div>
          )}

          {/* EzCater Notları */}
          {order.ezcater_notes && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                Sipariş Notları
              </h3>
              <p className="text-sm text-slate-700">{order.ezcater_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const InfoRow = ({ label, value, icon }) => (
  <div className="flex items-center gap-2">
    {icon && icon}
    <span className="text-sm text-slate-600 font-medium">{label}:</span>
    <span className="text-sm text-slate-900 font-semibold">{value}</span>
  </div>
);
