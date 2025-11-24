import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Calendar, User, Package, MapPin, Clock, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

export default function AssignmentReport({ assignments, targetDate, onClose }) {
  const groupedByDriver = {};
  
  assignments.forEach(order => {
    if (!groupedByDriver[order.driver_name]) {
      groupedByDriver[order.driver_name] = [];
    }
    groupedByDriver[order.driver_name].push(order);
  });

  const sortByPickupTime = (orders) => {
    return [...orders].sort((a, b) => {
      const parsePickupTime = (timeStr) => {
        if (!timeStr) return 0;
        const cleanTime = String(timeStr).trim().toLowerCase();
        
        let hours = 0;
        let minutes = 0;
        let isPM = false;

        const timeParts = cleanTime.match(/(\d+)(:\d+)?\s*(am|pm)?/);
        if (timeParts) {
          hours = parseInt(timeParts[1], 10);
          if (timeParts[2]) {
            minutes = parseInt(timeParts[2].substring(1), 10);
          }
          if (timeParts[3] === 'pm') {
            isPM = true;
          }
        }

        if (isPM && hours !== 12) {
          hours += 12;
        } else if (!isPM && hours === 12) {
          hours = 0;
        }
        
        return hours * 60 + minutes;
      };
      
      return parsePickupTime(a.pickup_time) - parsePickupTime(b.pickup_time);
    });
  };

  Object.keys(groupedByDriver).forEach(driverName => {
    groupedByDriver[driverName] = sortByPickupTime(groupedByDriver[driverName]);
  });

  const handleExportXLSX = async () => {
    try {
      const response = await base44.functions.invoke('exportAssignmentsXLSX', {
        targetDate
      });
      
      // Binary data'yı blob'a çevir
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // İndir
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atama_raporu_${targetDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
    } catch (error) {
      console.error('XLSX export hatası:', error);
      alert(`❌ Excel oluşturma hatası: ${error.message}`);
    }
  };

  const handleExportCSV = () => {
    let csv = 'Sürücü,Sipariş No,Müşteri,Pickup Saati,Pickup Adresi,Dropoff Saati,Dropoff Adresi\n';
    
    Object.entries(groupedByDriver).forEach(([driverName, orders]) => {
      const sortedOrders = sortByPickupTime(orders);
      
      sortedOrders.forEach(order => {
        const row = [
          driverName,
          order.ezcater_order_id,
          order.customer_name,
          order.pickup_time,
          order.pickup_address,
          order.dropoff_time,
          order.dropoff_address
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atama_raporu_${targetDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `ATAMA RAPORU - ${format(new Date(targetDate), 'dd MMMM yyyy', { locale: tr })}\n`;
    text += `Oluşturulma: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}\n`;
    text += `Toplam Atama: ${assignments.length}\n`;
    text += `Toplam Sürücü: ${Object.keys(groupedByDriver).length}\n\n`;
    text += '='.repeat(80) + '\n\n';

    Object.entries(groupedByDriver).forEach(([driverName, orders]) => {
      text += `🚗 ${driverName} - ${orders.length} Sipariş\n`;
      text += '-'.repeat(80) + '\n';
      
      orders.forEach((order, index) => {
        text += `\n${index + 1}. Sipariş #${order.ezcater_order_id}\n`;
        text += `   Müşteri: ${order.customer_name}\n`;
        text += `   Pickup: ${order.pickup_time} - ${order.pickup_address}\n`;
        text += `   Dropoff: ${order.dropoff_time} - ${order.dropoff_address}\n`;
      });
      
      text += '\n' + '='.repeat(80) + '\n\n';
    });

    navigator.clipboard.writeText(text);
    alert('✅ Rapor panoya kopyalandı!');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            Atama Raporu - {format(new Date(targetDate), 'dd MMMM yyyy', { locale: tr })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4 text-center print:hidden">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Toplam Sipariş</p>
            <p className="text-2xl font-bold text-blue-700">{assignments.length}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Aktif Sürücü</p>
            <p className="text-2xl font-bold text-green-700">{Object.keys(groupedByDriver).length}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">Ort. Sipariş/Sürücü</p>
            <p className="text-2xl font-bold text-purple-700">
              {Object.keys(groupedByDriver).length > 0 ? (assignments.length / Object.keys(groupedByDriver).length).toFixed(1) : 0}
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {Object.entries(groupedByDriver).map(([driverName, orders]) => (
              <div key={driverName} className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50/30">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {driverName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{driverName}</h3>
                      <p className="text-sm text-slate-600">{orders.length} sipariş atandı</p>
                    </div>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>

                <div className="space-y-3">
                  {orders.map((order, index) => (
                    <div key={order.id} className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {index + 1}. Sipariş #{order.ezcater_order_id}
                          </h4>
                          <p className="text-sm text-slate-600">{order.customer_name}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <div>
                            <span className="font-medium">{order.pickup_time}</span>
                            <span className="text-slate-500 mx-2">→</span>
                            <span className="font-medium">{order.dropoff_time}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-slate-700"><span className="font-medium">Pickup:</span> {order.pickup_address}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-slate-700"><span className="font-medium">Dropoff:</span> {order.dropoff_address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-4 print:hidden">
          <Button variant="outline" onClick={handleExportXLSX}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel (Dropdown)
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={handleCopyText}>
            <Download className="w-4 h-4 mr-2" />
            Metni Kopyala
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Download className="w-4 h-4 mr-2" />
            Yazdır/PDF
          </Button>
          <Button onClick={onClose}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}