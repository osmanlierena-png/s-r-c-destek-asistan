import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Save, 
  Send, 
  Clock, 
  MapPin, 
  User,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TIME_SLOTS = {
  morning: { label: "Sabah", start: 4, end: 11, color: "bg-amber-50 border-amber-300" },
  noon: { label: "Öğle", start: 12, end: 15, color: "bg-blue-50 border-blue-300" },
  evening: { label: "Akşam", start: 16, end: 22, color: "bg-purple-50 border-purple-300" }
};

const parseTime = (timeString) => {
  if (!timeString) return null;
  const cleanTime = timeString.trim();
  const isPM = cleanTime.toLowerCase().includes('pm');
  const isAM = cleanTime.toLowerCase().includes('am');
  const timePart = cleanTime.replace(/\s*(am|pm)/gi, '').trim();
  const [hourStr] = timePart.split(':');
  let hours = parseInt(hourStr, 10);
  
  if (isPM && hours !== 12) hours += 12;
  else if (isAM && hours === 12) hours = 0;
  
  return hours;
};

const getTimeSlot = (pickupTime) => {
  const hour = parseTime(pickupTime);
  if (hour === null) return null;
  
  if (hour >= TIME_SLOTS.morning.start && hour <= TIME_SLOTS.morning.end) return 'morning';
  if (hour >= TIME_SLOTS.noon.start && hour <= TIME_SLOTS.noon.end) return 'noon';
  if (hour >= TIME_SLOTS.evening.start && hour <= TIME_SLOTS.evening.end) return 'evening';
  return null;
};

export default function InteractiveAssignmentPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchDriver, setSearchDriver] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ordersData, driversData] = await Promise.all([
        base44.entities.DailyOrder.filter({ order_date: selectedDate }),
        base44.entities.Driver.filter({ status: 'Aktif' })
      ]);
      
      setOrders(ordersData);
      setDrivers(driversData);
      
      // Mevcut atamaları yükle
      const currentAssignments = {};
      ordersData.forEach(order => {
        if (order.driver_id) {
          if (!currentAssignments[order.driver_id]) {
            currentAssignments[order.driver_id] = [];
          }
          currentAssignments[order.driver_id].push(order.id);
        }
      });
      setAssignments(currentAssignments);
      
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veriler yüklenirken hata oluştu: ' + error.message);
    }
    setIsLoading(false);
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;
    
    const orderId = draggableId;
    const sourceDriverId = source.droppableId === 'unassigned' ? null : source.droppableId;
    const destDriverId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
    
    if (sourceDriverId === destDriverId) return;
    
    const newAssignments = { ...assignments };
    
    // Kaynaktan çıkar
    if (sourceDriverId) {
      newAssignments[sourceDriverId] = newAssignments[sourceDriverId].filter(id => id !== orderId);
      if (newAssignments[sourceDriverId].length === 0) {
        delete newAssignments[sourceDriverId];
      }
    }
    
    // Hedefe ekle
    if (destDriverId) {
      if (!newAssignments[destDriverId]) {
        newAssignments[destDriverId] = [];
      }
      newAssignments[destDriverId].push(orderId);
    }
    
    setAssignments(newAssignments);
  };

  const handleSave = () => {
    setShowConfirmDialog(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      // Tüm siparişleri güncelle
      for (const order of orders) {
        const assignedDriverId = Object.keys(assignments).find(driverId => 
          assignments[driverId].includes(order.id)
        );
        
        const driver = drivers.find(d => d.id === assignedDriverId);
        
        await base44.entities.DailyOrder.update(order.id, {
          driver_id: assignedDriverId || null,
          driver_name: driver?.name || null,
          driver_phone: driver?.phone || null,
          status: assignedDriverId ? 'Atandı' : 'Çekildi'
        });
        
        // API'yi yormamak için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setShowConfirmDialog(false);
      setShowSMSDialog(true);
      
    } catch (error) {
      console.error('Kayıt hatası:', error);
      alert('Atamalar kaydedilirken hata oluştu: ' + error.message);
    }
    setIsSaving(false);
  };

  const handleSendSMS = async () => {
    setIsSendingSMS(true);
    try {
      const assignedOrderIds = Object.values(assignments).flat();
      
      if (assignedOrderIds.length === 0) {
        alert('SMS göndermek için atanmış sipariş yok!');
        setIsSendingSMS(false);
        return;
      }
      
      const response = await base44.functions.invoke('sendOrderAssignmentSMS', {
        orderIds: assignedOrderIds
      });
      
      if (response.data.success) {
        alert(`✅ ${response.data.sent?.length || 0} siparişe SMS gönderildi!`);
        setShowSMSDialog(false);
        loadData();
      } else {
        alert(`❌ SMS gönderilirken hata: ${response.data.error || response.data.message}`);
      }
    } catch (error) {
      console.error('SMS gönderim hatası:', error);
      alert('SMS gönderilirken hata oluştu: ' + error.message);
    }
    setIsSendingSMS(false);
  };

  const groupOrdersByTimeSlot = (ordersList) => {
    const grouped = {
      morning: [],
      noon: [],
      evening: [],
      other: []
    };
    
    ordersList.forEach(order => {
      const slot = getTimeSlot(order.pickup_time);
      if (slot) {
        grouped[slot].push(order);
      } else {
        grouped.other.push(order);
      }
    });
    
    return grouped;
  };

  const getUnassignedOrders = () => {
    const assignedIds = new Set(Object.values(assignments).flat());
    return orders.filter(order => !assignedIds.has(order.id));
  };

  const getDriverOrders = (driverId) => {
    const orderIds = assignments[driverId] || [];
    return orders.filter(order => orderIds.includes(order.id))
      .sort((a, b) => {
        const timeA = parseTime(a.pickup_time) || 0;
        const timeB = parseTime(b.pickup_time) || 0;
        return timeA - timeB;
      });
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchDriver.toLowerCase()) ||
    d.phone?.includes(searchDriver)
  );

  const OrderCard = ({ order, index }) => (
    <Draggable draggableId={order.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 ${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <Card className={`border-2 hover:shadow-lg transition-all ${
            snapshot.isDragging ? 'border-blue-400 shadow-xl' : 'border-slate-300 bg-white'
          }`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header - Order ID ve Saatler */}
                <div className="flex justify-between items-start pb-3 border-b-2 border-slate-200">
                  <div>
                    <p className="font-mono text-sm font-extrabold text-slate-900 mb-1">
                      {order.ezcater_order_id}
                    </p>
                    {order.customer_name && (
                      <p className="text-xs text-slate-500">{order.customer_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-lg shadow-md">
                      {order.pickup_time}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">pickup time</div>
                  </div>
                </div>

                {/* Pickup Address */}
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-800 mb-1">PICKUP</p>
                      <p className="text-sm text-slate-700 font-medium">{order.pickup_address}</p>
                    </div>
                  </div>
                </div>

                {/* Dropoff Address */}
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-800 mb-1">DROPOFF</p>
                      <p className="text-sm text-slate-700 font-medium">{order.dropoff_address}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-4 h-4 text-red-600" />
                        <span className="text-base font-bold text-red-700">{order.dropoff_time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );

  const TimeSlotSection = ({ slot, orders, title }) => {
    const grouped = groupOrdersByTimeSlot(orders);
    const slotOrders = grouped[slot] || [];

    if (slotOrders.length === 0) return null;

    return (
      <div className={`rounded-xl border-3 p-5 shadow-lg ${TIME_SLOTS[slot].color}`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-current opacity-30">
          <h3 className="font-bold text-lg flex items-center gap-3">
            <div className="bg-white rounded-full p-2 shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            {title}
          </h3>
          <div className="bg-white rounded-full px-4 py-2 shadow-md">
            <span className="font-bold text-lg">{slotOrders.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {slotOrders.map((order, idx) => (
            <OrderCard key={order.id} order={order} index={idx} />
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manuel Atama</h1>
            <p className="text-sm text-slate-600">Siparişleri sürükleyerek sürücülere atayın</p>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded text-sm"
            />
            <Button 
              onClick={handleSave}
              disabled={Object.keys(assignments).length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Kaydet
            </Button>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-12 gap-4">
            
            {/* Sol Panel - Sürücüler */}
            <div className="col-span-3 space-y-3">
              <Card className="sticky top-4 shadow-xl border-2 border-slate-300">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
                  <CardTitle className="text-base flex items-center gap-2 font-bold">
                    <User className="w-5 h-5" />
                    Sürücüler ({filteredDrivers.length})
                  </CardTitle>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Sürücü ara..."
                      value={searchDriver}
                      onChange={(e) => setSearchDriver(e.target.value)}
                      className="pl-10 h-9 text-sm bg-white"
                    />
                  </div>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-3 p-4">
                  {filteredDrivers.map(driver => {
                    const driverOrders = getDriverOrders(driver.id);
                    return (
                      <Droppable key={driver.id} droppableId={driver.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`border-3 rounded-xl p-4 transition-all shadow-md ${
                              snapshot.isDraggingOver 
                                ? 'border-blue-500 bg-blue-100 shadow-2xl scale-105' 
                                : driverOrders.length > 0
                                ? 'border-green-400 bg-green-50'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <p className="font-bold text-base text-slate-900">{driver.name}</p>
                                <p className="text-xs text-slate-600 mt-1">{driver.phone}</p>
                              </div>
                              {driverOrders.length > 0 && (
                                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg">
                                  {driverOrders.length}
                                </div>
                              )}
                            </div>

                            {driverOrders.length > 0 && (
                              <div className="space-y-2 mt-3 pt-3 border-t-2 border-slate-200">
                                {driverOrders.map((order, idx) => (
                                  <OrderCard key={order.id} order={order} index={idx} />
                                ))}
                              </div>
                            )}

                            {driverOrders.length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-2 italic">
                                Sipariş yok - buraya sürükleyin
                              </p>
                            )}

                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Sağ Panel - Atanmamış Siparişler */}
            <div className="col-span-9">
              <Card className="shadow-xl border-2 border-slate-300">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                  <CardTitle className="text-lg font-bold">
                    📦 Atanmamış Siparişler ({getUnassignedOrders().length})
                  </CardTitle>
                  <p className="text-sm text-white/90 mt-1">Siparişleri sürücülere sürükleyin</p>
                </CardHeader>
                <CardContent className="p-6">
                  <Droppable droppableId="unassigned">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[500px] space-y-4 ${
                          snapshot.isDraggingOver ? 'bg-slate-100 rounded-lg' : ''
                        }`}
                      >
                        {getUnassignedOrders().length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <CheckCircle className="w-12 h-12 mb-2" />
                            <p>Tüm siparişler atandı!</p>
                          </div>
                        ) : (
                          <>
                            <TimeSlotSection 
                              slot="morning" 
                              orders={getUnassignedOrders()} 
                              title="Sabah (04:00 - 11:00)" 
                            />
                            <TimeSlotSection 
                              slot="noon" 
                              orders={getUnassignedOrders()} 
                              title="Öğle (12:00 - 15:00)" 
                            />
                            <TimeSlotSection 
                              slot="evening" 
                              orders={getUnassignedOrders()} 
                              title="Akşam (16:00 - 22:00)" 
                            />
                            
                            {groupOrdersByTimeSlot(getUnassignedOrders()).other.length > 0 && (
                              <div className="rounded-lg border-2 p-3 bg-slate-100 border-slate-300">
                                <h3 className="font-semibold text-sm mb-2">
                                  Diğer ({groupOrdersByTimeSlot(getUnassignedOrders()).other.length})
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                  {groupOrdersByTimeSlot(getUnassignedOrders()).other.map((order, idx) => (
                                    <OrderCard key={order.id} order={order} index={idx} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>

          </div>
        </DragDropContext>

      </div>

      {/* Kayıt Onay Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Atamaları Kaydet
            </DialogTitle>
            <DialogDescription>
              {Object.keys(assignments).length} sürücüye toplam {Object.values(assignments).flat().length} sipariş atadınız.
              <br />
              <br />
              Bu atamaları kaydetmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSaving}
            >
              İptal
            </Button>
            <Button 
              onClick={confirmSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Evet, Kaydet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Gönderim Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Atamalar Kaydedildi!
            </DialogTitle>
            <DialogDescription>
              Siparişler başarıyla kaydedildi.
              <br />
              <br />
              Şimdi sürücülere onay SMS'i göndermek ister misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSMSDialog(false);
                loadData();
              }}
              disabled={isSendingSMS}
            >
              Şimdi Değil
            </Button>
            <Button 
              onClick={handleSendSMS}
              disabled={isSendingSMS}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSendingSMS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  SMS Gönder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}