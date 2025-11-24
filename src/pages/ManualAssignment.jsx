
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Users,
  Package,
  MapPin,
  Clock,
  Send,
  Save,
  Loader2,
  RefreshCw,
  Star,
  Calendar
} from 'lucide-react';

export default function ManualAssignmentPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [groups, setGroups] = useState([]);
  const [standalone, setStandalone] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const allDrivers = await base44.entities.Driver.list();
      const topDashers = allDrivers.filter(d => d.is_top_dasher && d.status === 'Aktif');
      setDrivers(topDashers);
    } catch (error) {
      console.error('Sürücü yükleme hatası:', error);
    }
  };

  const handleLoadGroups = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('createOrderGroups', { targetDate: selectedDate });
      
      if (response.data.success) {
        setGroups(response.data.groups || []);
        setStandalone(response.data.standalone || []);
        setAssignments({});
        
        const avgSize = response.data.stats?.avgGroupSize || 0;
        alert(`✅ ${response.data.stats.groupCount} grup oluşturuldu!\n\n` +
              `📊 ${response.data.stats.crossRegionGroups} bölge geçişli\n` +
              `📦 ${response.data.stats.standaloneCount} tek başına\n` +
              `🔗 Ortalama ${avgSize.toFixed(1)} sipariş/grup`);
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Hata: ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleScreenshotUpload = async (file) => {
    setUploadingFile(file);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const response = await base44.functions.invoke('parseOrderScreenshot', {
        file_url,
        target_date: selectedDate
      });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        setShowUpload(false);
        handleLoadGroups();
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Yükleme hatası: ${error.message}`);
    }
    setUploadingFile(null);
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId, type } = result;
    
    if (!destination) return;
    
    if (type === 'DRIVER') {
      const driverId = draggableId.replace('driver-', '');
      const groupId = destination.droppableId.replace('group-', '');
      
      setAssignments(prev => ({
        ...prev,
        [groupId]: driverId
      }));
      return;
    }
    
    if (type === 'ORDER') {
      const orderId = draggableId.replace('order-', '');
      const sourceGroupId = source.droppableId.replace('group-', '').replace('standalone', 'standalone');
      const destGroupId = destination.droppableId.replace('group-', '').replace('standalone', 'standalone');
      
      if (sourceGroupId === destGroupId) return;
      
      setGroups(prevGroups => {
        const newGroups = [...prevGroups];
        let sourceGroup = newGroups.find(g => g.id === sourceGroupId);
        let movedOrder = null;
        
        if (sourceGroupId === 'standalone') {
          const orderIndex = standalone.findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            [movedOrder] = standalone.splice(orderIndex, 1);
            setStandalone([...standalone]);
          }
        } else if (sourceGroup) {
          const orderIndex = sourceGroup.orders.findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            [movedOrder] = sourceGroup.orders.splice(orderIndex, 1);
          }
        }
        
        if (!movedOrder) return prevGroups;
        
        if (destGroupId === 'standalone') {
          setStandalone([...standalone, movedOrder]);
        } else {
          const destGroup = newGroups.find(g => g.id === destGroupId);
          if (destGroup) {
            destGroup.orders.push(movedOrder);
          }
        }
        
        return newGroups;
      });
    }
  };

  const handleSaveAssignments = async () => {
    const assignedCount = Object.keys(assignments).length;
    
    if (assignedCount === 0) {
      alert('Lütfen en az bir atama yapın!');
      return;
    }
    
    if (!window.confirm(`${assignedCount} grup atamasını kaydetmek istiyor musunuz?`)) {
      return;
    }
    
    setIsSaving(true);
    let successCount = 0;
    
    try {
      for (const [groupId, driverId] of Object.entries(assignments)) {
        const group = groups.find(g => g.id === groupId);
        const driver = drivers.find(d => d.id === driverId);
        
        if (!group || !driver) continue;
        
        for (const order of group.orders) {
          try {
            await base44.entities.DailyOrder.update(order.id, {
              driver_id: driver.id,
              driver_name: driver.name,
              driver_phone: driver.phone, // Added driver_phone
              status: 'Atandı'
            });
            successCount++;
          } catch (error) {
            console.error(`Order ${order.id} atama hatası:`, error);
          }
        }
      }
      
      alert(`✅ ${successCount} sipariş başarıyla atandı!`);
      handleLoadGroups();
      
    } catch (error) {
      alert(`❌ Kaydetme hatası: ${error.message}`);
    }
    
    setIsSaving(false);
  };

  const handleSendSMS = async () => {
    const assignedGroupCount = Object.keys(assignments).length;
    
    if (assignedGroupCount === 0) {
      alert('Lütfen önce atama yapın!');
      return;
    }
    
    if (!window.confirm(`${assignedGroupCount} sürücüye SMS göndermek istiyor musunuz?`)) {
      return;
    }
    
    try {
      const smsData = [];
      
      for (const [groupId, driverId] of Object.entries(assignments)) {
        const group = groups.find(g => g.id === groupId);
        const driver = drivers.find(d => d.id === driverId);
        
        if (!group || !driver) continue;
        
        smsData.push({
          driver_phone: driver.phone,
          driver_name: driver.name,
          orders: group.orders.map(o => ({
            pickup_address: o.pickup_address,
            dropoff_address: o.dropoff_address,
            pickup_time: o.pickup_time,
            dropoff_time: o.dropoff_time
          })),
          date: selectedDate
        });
      }
      
      const response = await base44.functions.invoke('sendGroupedSMS', { smsData });
      
      if (response.data.success) {
        alert(`✅ ${response.data.sentCount} SMS gönderildi!`);
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ SMS gönderimi hatası: ${error.message}`);
    }
  };

  const getDayAbbr = (day) => {
    const days = {
      'Monday': 'Pzt',
      'Tuesday': 'Sal',
      'Wednesday': 'Çar',
      'Thursday': 'Per',
      'Friday': 'Cum',
      'Saturday': 'Cmt',
      'Sunday': 'Paz'
    };
    return days[day] || day.slice(0, 3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header - Floating */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-light text-slate-800 mb-2">
              Manuel Sipariş Atama
            </h1>
            <p className="text-slate-500">Grupları oluştur • Sürükle • Kaydet</p>
          </div>
          <div className="flex gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44 bg-white shadow-sm border-slate-200 hover:shadow-md transition-shadow"
            />
            <Button
              onClick={() => setShowUpload(true)}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all border-slate-200 bg-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Screenshot
            </Button>
            <Button
              onClick={handleLoadGroups}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Grupları Oluştur
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats - Floating Cards */}
        {groups.length > 0 && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Toplam Grup</p>
                  <p className="text-4xl font-light text-slate-800">{groups.length}</p>
                </div>
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Atanan Grup</p>
                  <p className="text-4xl font-light text-green-600">{Object.keys(assignments).length}</p>
                </div>
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Tek Başına</p>
                  <p className="text-4xl font-light text-orange-600">{standalone.length}</p>
                </div>
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          
          {/* Drivers Section - Floating */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-slate-800">Top Dasher Sürücüler</h2>
                <p className="text-sm text-slate-500">{drivers.length} aktif sürücü</p>
              </div>
            </div>
            
            <Droppable droppableId="drivers" direction="horizontal" type="DRIVER">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-wrap gap-4"
                >
                  {drivers.map((driver, index) => {
                    const workingDays = driver.assignment_preferences?.working_days || [];
                    
                    return (
                      <Draggable
                        key={driver.id}
                        draggableId={`driver-${driver.id}`}
                        index={index}
                        type="DRIVER"
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`transition-all duration-200 ${
                              snapshot.isDragging
                                ? 'scale-110 rotate-3 shadow-2xl'
                                : 'hover:scale-105 hover:-translate-y-1'
                            }`}
                          >
                            <div className={`bg-white rounded-xl p-5 cursor-move border-2 transition-all ${
                              snapshot.isDragging
                                ? 'border-yellow-400 shadow-2xl'
                                : 'border-slate-200 shadow-md hover:shadow-lg hover:border-yellow-300'
                            }`}>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-md">
                                  {driver.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-800 text-base block">{driver.name}</span>
                                  <span className="text-xs text-slate-500">{driver.phone}</span>
                                </div>
                              </div>
                              
                              <div className="flex gap-1 flex-wrap">
                                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => {
                                  const fullDay = {
                                    'Pzt': 'Monday',
                                    'Sal': 'Tuesday',
                                    'Çar': 'Wednesday',
                                    'Per': 'Thursday',
                                    'Cum': 'Friday',
                                    'Cmt': 'Saturday',
                                    'Paz': 'Sunday'
                                  }[day];
                                  
                                  const isWorking = workingDays.includes(fullDay);
                                  
                                  return (
                                    <div
                                      key={day}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                                        isWorking
                                          ? 'bg-green-100 text-green-700 border border-green-300'
                                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                                      }`}
                                    >
                                      {day[0]}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Groups Section - Floating Grid */}
          {groups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group, groupIndex) => {
                const assignedDriver = assignments[group.id]
                  ? drivers.find(d => d.id === assignments[group.id])
                  : null;
                
                return (
                  <Droppable
                    key={group.id}
                    droppableId={`group-${group.id}`}
                    type="DRIVER"
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`bg-white rounded-2xl shadow-lg transition-all duration-300 ${
                          snapshot.isDraggingOver
                            ? 'scale-105 shadow-2xl border-2 border-yellow-400'
                            : 'hover:shadow-xl hover:-translate-y-1 border-2 border-slate-200'
                        }`}
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Package className="w-4 h-4 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800">
                                  Grup {groupIndex + 1}
                                </h3>
                                <Badge variant="outline" className="ml-auto border-slate-300 text-slate-600">
                                  {group.orders.length} sipariş
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                                <Clock className="w-3 h-3" />
                                <span>{group.startTime} → {group.endTime}</span>
                              </div>
                              
                              <div className="flex gap-2 flex-wrap">
                                {group.regions.map((region, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                                    {region}
                                  </Badge>
                                ))}
                                {group.isCrossRegion && (
                                  <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                    🔗 Bölge geçişli
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {assignedDriver ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-700 font-semibold">
                                  {assignedDriver.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-green-800">✅ {assignedDriver.name}</p>
                                  <p className="text-xs text-green-600">Atandı</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 mb-4 text-center">
                              <p className="text-sm text-slate-500">👆 Sürücü buraya sürükle</p>
                            </div>
                          )}
                          
                          <Droppable droppableId={`group-${group.id}`} type="ORDER">
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                                {group.orders.map((order, orderIndex) => (
                                  <Draggable
                                    key={order.id}
                                    draggableId={`order-${order.id}`}
                                    index={orderIndex}
                                    type="ORDER"
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`bg-slate-50 rounded-xl p-4 border-2 transition-all duration-200 ${
                                          snapshot.isDragging
                                            ? 'border-blue-400 shadow-2xl scale-105 rotate-2 bg-white'
                                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                                        }`}
                                      >
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                            <Clock className="w-3 h-3 text-blue-500" />
                                            {order.pickup_time} → {order.dropoff_time}
                                          </div>
                                          
                                          <div className="space-y-1">
                                            <div className="flex items-start gap-2">
                                              <MapPin className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                                              <span className="text-xs text-slate-600 leading-relaxed">{order.pickup_address}</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                              <MapPin className="w-3 h-3 mt-0.5 text-red-500 flex-shrink-0" />
                                              <span className="text-xs text-slate-600 leading-relaxed">{order.dropoff_address}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                        
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          )}

          {/* Standalone Orders - Floating */}
          {standalone.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-slate-800">Tek Başına Siparişler</h2>
                  <p className="text-sm text-slate-500">{standalone.length} sipariş</p>
                </div>
              </div>
              
              <Droppable droppableId="standalone" type="ORDER">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {standalone.map((order, index) => (
                      <Draggable
                        key={order.id}
                        draggableId={`order-${order.id}`}
                        index={index}
                        type="ORDER"
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-orange-50 rounded-xl p-4 border-2 cursor-move transition-all duration-200 ${
                              snapshot.isDragging
                                ? 'border-orange-400 shadow-2xl scale-110 bg-white'
                                : 'border-orange-200 hover:border-orange-300 hover:shadow-md'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                <Clock className="w-3 h-3 text-blue-500" />
                                {order.pickup_time} → {order.dropoff_time}
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                                  <span className="text-xs text-slate-600 leading-relaxed">{order.pickup_address}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-3 h-3 mt-0.5 text-red-500 flex-shrink-0" />
                                  <span className="text-xs text-slate-600 leading-relaxed">{order.dropoff_address}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}
        </DragDropContext>

        {/* Action Buttons - Floating */}
        {groups.length > 0 && (
          <div className="flex gap-4 justify-end">
            <Button
              onClick={handleSaveAssignments}
              disabled={isSaving || Object.keys(assignments).length === 0}
              className="bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all px-8"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Atamaları Kaydet ({Object.keys(assignments).length})
                </>
              )}
            </Button>
            
            <Button
              onClick={handleSendSMS}
              disabled={Object.keys(assignments).length === 0}
              className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all px-8"
            >
              <Send className="w-4 h-4 mr-2" />
              SMS Gönder
            </Button>
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6">
                <h3 className="text-xl font-medium text-slate-800 mb-4">Screenshot Yükle</h3>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      handleScreenshotUpload(e.target.files[0]);
                    }
                  }}
                  className="mb-4 text-slate-700"
                  disabled={uploadingFile}
                />
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-blue-600 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Yükleniyor...</span>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowUpload(false)}
                    disabled={uploadingFile}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
