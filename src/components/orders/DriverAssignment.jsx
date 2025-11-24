
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Truck, Clock, MapPin } from "lucide-react";
import { Driver, DailyOrder } from "@/entities/all";

export default function DriverAssignment({ orders, onClose, onAssigned }) {
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const driversData = await Driver.filter({ status: 'Aktif' });
      setDrivers(driversData);
    } catch (error) {
      console.error('Sürücüler yüklenirken hata:', error);
    }
    setIsLoading(false);
  };

  const handleAssignment = (orderId, driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    setAssignments(prev => ({
      ...prev,
      [orderId]: {
        driverId: driverId,
        driverName: driver?.name || ''
      }
    }));
  };

  const handleSaveAssignments = async () => {
    try {
      const promises = Object.entries(assignments).map(async ([orderId, assignment]) => {
        await DailyOrder.update(orderId, {
          driver_id: assignment.driverId,
          driver_name: assignment.driverName,
          status: "Atandı"
        });
      });
      
      await Promise.all(promises);
      alert(`✅ ${Object.keys(assignments).length} sipariş atandı!`);
      onAssigned();
      onClose();
    } catch (error) {
      console.error('Atama kaydedilirken hata:', error);
      alert('❌ Atama kaydedilirken hata oluştu.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl bg-white max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="bg-green-500 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Manuel Sürücü Atama ({orders.length} Sipariş)
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-2">
                        #{order.ezcater_order_id} - {order.customer_name}
                      </h3>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {order.pickup_time} → {order.dropoff_time}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {order.dropoff_address}
                        </div>
                      </div>
                    </div>
                    <div className="w-64">
                      <Select
                        value={assignments[order.id]?.driverId || ""}
                        onValueChange={(value) => handleAssignment(order.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sürücü seç..." />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map(driver => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              {Object.keys(assignments).length} sipariş atandı
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                İptal
              </Button>
              <Button 
                onClick={handleSaveAssignments}
                disabled={Object.keys(assignments).length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Atamaları Kaydet
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
