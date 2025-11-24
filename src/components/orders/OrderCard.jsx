import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, User, Trash2, Eye, CheckCircle, XCircle, AlertCircle, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function OrderCard({ order, onUpdate, onViewDetails }) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showManualAssign, setShowManualAssign] = React.useState(false);
  const [drivers, setDrivers] = React.useState([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = React.useState(false);
  const [searchDriver, setSearchDriver] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`${order.ezcater_order_id} numaralı siparişi silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await base44.entities.DailyOrder.delete(order.id);
      onUpdate();
    } catch (error) {
      console.error('Silme hatası:', error);
      alert('Sipariş silinemedi: ' + error.message);
    }
    setIsDeleting(false);
  };

  const loadDrivers = async () => {
    setIsLoadingDrivers(true);
    try {
      const allDrivers = await base44.entities.Driver.filter({ status: 'Aktif' });
      setDrivers(allDrivers);
    } catch (error) {
      console.error('Sürücüler yüklenirken hata:', error);
      alert('Sürücüler yüklenemedi: ' + error.message);
    }
    setIsLoadingDrivers(false);
  };

  const handleOpenManualAssign = () => {
    setShowManualAssign(true);
    loadDrivers();
  };

  const handleManualAssign = async (driver) => {
    if (!window.confirm(`${order.ezcater_order_id} siparişini ${driver.name} sürücüsüne atamak istediğinizden emin misiniz?`)) {
      return;
    }

    setIsAssigning(true);
    try {
      console.log('📝 Manuel atama yapılıyor:', {
        order_id: order.id,
        ezcater_order_id: order.ezcater_order_id,
        driver_id: driver.id,
        driver_name: driver.name,
        driver_phone: driver.phone
      });

      await base44.entities.DailyOrder.update(order.id, {
        driver_id: driver.id,
        driver_name: driver.name,
        driver_phone: driver.phone,
        status: 'Atandı'
      });
      
      console.log('✅ Manuel atama başarılı!');
      
      alert(`✅ Sipariş ${driver.name} sürücüsüne atandı!\n\n📲 Telefon: ${driver.phone}\n📋 Durum: Atandı\n\nŞimdi "Onay SMS Gönder" butonuna basabilirsiniz.`);
      
      setShowManualAssign(false);
      
      // ⚡ SAYFA YENİLENİYOR - Yeni atamayı görmesi için
      await onUpdate();
      
    } catch (error) {
      console.error('❌ Manuel atama hatası:', error);
      alert('Sipariş atanamadı: ' + error.message);
    }
    setIsAssigning(false);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Çekildi': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Atandı': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Sürücü Onayı Bekleniyor': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Sürücü Onayladı': return 'bg-green-100 text-green-800 border-green-300';
      case 'Sürücü Reddetti': return 'bg-red-100 text-red-800 border-red-300';
      case 'Sürücüye Gönderildi': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Yolda': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Tamamlandı': return 'bg-green-100 text-green-800 border-green-300';
      case 'Problem': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Sürücü Onayladı': return <CheckCircle className="w-4 h-4 mr-1" />;
      case 'Sürücü Reddetti': return <XCircle className="w-4 h-4 mr-1" />;
      case 'Sürücü Onayı Bekleniyor': return <AlertCircle className="w-4 h-4 mr-1" />;
      default: return null;
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchDriver.toLowerCase()) ||
    d.phone.includes(searchDriver)
  );

  return (
    <>
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer bg-white border-slate-200"
        onClick={() => onViewDetails(order)}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-sm font-mono text-slate-700">
                {order.ezcater_order_id}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">{order.customer_name}</p>
            </div>
            <Badge className={`${getStatusColor(order.status)} border flex items-center text-xs`}>
              {getStatusIcon(order.status)}
              {order.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-slate-600 line-clamp-2">{order.pickup_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-slate-600 line-clamp-2">{order.dropoff_address}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">{order.pickup_time} → {order.dropoff_time}</span>
          </div>
          {order.driver_name && (
            <div className="flex items-center gap-2 pt-1 border-t">
              <User className="w-4 h-4 text-purple-500" />
              <span className="text-slate-900 font-medium">{order.driver_name}</span>
            </div>
          )}
          {order.driver_response && (
            <div className="pt-1 border-t">
              <p className="text-xs text-slate-600">
                <span className="font-medium">Yanıt:</span> {order.driver_response}
              </p>
              {order.estimated_delay_minutes && (
                <p className="text-xs text-orange-600 mt-1">
                  ⏱️ {order.estimated_delay_minutes} dakika gecikme
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => onViewDetails(order)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Detay
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 hover:bg-blue-50 text-xs h-7"
              onClick={handleOpenManualAssign}
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Manuel Ata
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 text-xs h-7"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {isDeleting ? '...' : 'Sil'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showManualAssign} onOpenChange={setShowManualAssign}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manuel Sürücü Ata</DialogTitle>
            <DialogDescription>
              {order.ezcater_order_id} siparişi için sürücü seçin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm">
              <p className="font-medium text-slate-700">{order.ezcater_order_id}</p>
              <p className="text-slate-600 mt-1">
                🔵 {order.pickup_time} - {order.pickup_address}
              </p>
              <p className="text-slate-600 mt-1">
                🟢 {order.dropoff_time} - {order.dropoff_address}
              </p>
            </div>

            <Input
              placeholder="Sürücü ara (isim veya telefon)..."
              value={searchDriver}
              onChange={(e) => setSearchDriver(e.target.value)}
              className="w-full"
            />

            {isLoadingDrivers ? (
              <div className="text-center py-8 text-slate-500">
                Sürücüler yükleniyor...
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {searchDriver ? 'Sürücü bulunamadı' : 'Aktif sürücü yok'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredDrivers.map((driver) => (
                  <Card 
                    key={driver.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => !isAssigning && handleManualAssign(driver)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-900">{driver.name}</p>
                          <p className="text-xs text-slate-600 mt-1">{driver.phone}</p>
                          {driver.address && (
                            <p className="text-xs text-slate-500 mt-1">{driver.address}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {driver.is_top_dasher && (
                              <Badge variant="outline" className="text-xs">
                                ⭐ Top Dasher
                              </Badge>
                            )}
                            {driver.is_joker_driver && (
                              <Badge variant="outline" className="text-xs">
                                🃏 Joker
                              </Badge>
                            )}
                            {driver.early_morning_eligible && (
                              <Badge variant="outline" className="text-xs">
                                🌅 Erken Sabah
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={isAssigning}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManualAssign(driver);
                          }}
                        >
                          {isAssigning ? 'Atanıyor...' : 'Ata'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}