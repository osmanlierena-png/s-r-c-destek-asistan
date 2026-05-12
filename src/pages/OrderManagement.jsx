import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Clock,
  User,
  Search,
  Upload,
  Sparkles,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  AlertTriangle,
  Check,
  Phone,
  MessageSquare,
  BarChart3,
  Download,
  Calendar,
  FileJson
} from "lucide-react";
import OrderCard from "../components/orders/OrderCard";
import IntelligentAssignmentResults from "../components/orders/IntelligentAssignmentResults";
import OrderDetails from "../components/orders/OrderDetails";
import AssignmentReport from "../components/orders/AssignmentReport";
import ScreenshotUpload from "../components/orders/ScreenshotUpload";
import GroupPreviewModal from "../components/orders/GroupPreviewModal";
import ThreeLayerResultsModal from "../components/orders/ThreeLayerResultsModal";
import JsonImportModal from "../components/orders/JsonImportModal";
import { geocodeOrders } from "../utils/geocodeOrders";
import { threeLayerAssignment } from "@/functions/threeLayerAssignment";
import { intelligentOrderAssignment } from "@/functions/intelligentOrderAssignment";
import { gptAssignment } from "@/functions/gptAssignment";
import { cleanOldOrders } from "@/functions/cleanOldOrders";
import { resetAllAssignments } from "@/functions/resetAllAssignments";
import { exportOrdersToExcel } from "@/functions/exportOrdersToExcel";

import { parseAndUpdateDriverRules } from "@/functions/parseAndUpdateDriverRules";
import { sendOrderAssignmentSMS } from "@/functions/sendOrderAssignmentSMS";
import { sendOrdersToCanvas } from "@/functions/sendOrdersToCanvas";
import { fetchAssignmentsFromCanvas } from "@/functions/fetchAssignmentsFromCanvas";

export default function OrderManagementPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentResults, setAssignmentResults] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAssignedOrders, setShowAssignedOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showScreenshotUpload, setShowScreenshotUpload] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCleaningOldOrders, setIsCleaningOldOrders] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isAssigningGPT, setIsAssigningGPT] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [isDebuggingCoords, setIsDebuggingCoords] = useState(false);
  const [isGeocodingOrders, setIsGeocodingOrders] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [isUpdatingRules, setIsUpdatingRules] = useState(false);
  const [ruleUpdateProgress, setRuleUpdateProgress] = useState(null);
  const [isAssigningThreeLayer, setIsAssigningThreeLayer] = useState(false);
  const [threeLayerResults, setThreeLayerResults] = useState(null);
  const [isSendingAssignmentSMS, setIsSendingAssignmentSMS] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [timeRangeFilter, setTimeRangeFilter] = useState(null); // 30, 120, null
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isCheckingPhones, setIsCheckingPhones] = useState(false);
  const [missingPhones, setMissingPhones] = useState(null);
  const [isPreviewingGroups, setIsPreviewingGroups] = useState(false);
  const [groupPreview, setGroupPreview] = useState(null);
  const [sendingToCanvas, setSendingToCanvas] = useState(false);
  const [fetchingFromCanvas, setFetchingFromCanvas] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [jsonImportResult, setJsonImportResult] = useState(null);

  const handleSendToCanvas = async () => {
    if (!selectedDate) {
      alert('Lütfen bir tarih seçin');
      return;
    }

    setSendingToCanvas(true);
    try {
      console.log('🚀 Canvas\'a gönderiliyor...', { date: selectedDate });
      const result = await sendOrdersToCanvas({ date: selectedDate });
      console.log('📦 Backend response:', result);

      if (result.data.success) {
        alert(`✅ ${result.data.ordersCount} sipariş Canvas'a gönderildi!\n\n📍 Canvas URL: ${result.data.canvasUrl}`);
        window.open(result.data.canvasUrl, '_blank');
      } else {
        console.error('❌ Backend error:', result.data);
        alert('❌ Hata: ' + (result.data.error || JSON.stringify(result.data)));
      }
    } catch (error) {
      console.error('❌ Full error:', error);
      console.error('❌ Error response:', error.response);
      alert('❌ Canvas\'a gönderilemedi: ' + error.message + '\n\nDetaylar için console\'u kontrol edin.');
    } finally {
      setSendingToCanvas(false);
    }
  };

  const handleFetchFromCanvas = async () => {
    if (!selectedDate) {
      alert('Lütfen bir tarih seçin');
      return;
    }

    setFetchingFromCanvas(true);
    try {
      const result = await fetchAssignmentsFromCanvas({ date: selectedDate });

      if (result.data.success) {
        const skippedMsg = result.data.skipped > 0 ? `\n\n⏭️ ${result.data.skipped} sipariş atlandı (zaten Onaylandı veya SMS gönderilmiş).` : '';
        const failedMsg = result.data.failed > 0 ? `\n\n❌ ${result.data.failed} sipariş güncellenemedi (ID eşleşmedi).` : '';
        alert(`✅ ${result.data.updated} sipariş Canvas'tan güncellendi!${skippedMsg}${failedMsg}\n\n📊 Toplam: ${result.data.total}`);
        
        await loadOrders();
        
        setTimeout(() => {
          const atandiOrders = orders.filter(o => o.status === 'Atandı');
          console.log(`\n🔍 CANVAS'TAN SONRA DURUM KONTROLÜ:`);
          console.log(`📦 "Atandı" durumunda ${atandiOrders.length} sipariş var\n`);
          
          atandiOrders.forEach(o => {
            console.log(`📋 ${o.ezcater_order_id}:`);
            console.log(`   ✅ driver_id: ${o.driver_id || '❌ EKSIK'}`);
            console.log(`   ✅ driver_name: ${o.driver_name || '❌ EKSIK'}`);
            console.log(`   ✅ driver_phone: ${o.driver_phone || '❌ EKSIK'}`);
            console.log(``);
          });
          
          const eksikBilgiler = atandiOrders.filter(o => !o.driver_id || !o.driver_phone);
          if (eksikBilgiler.length > 0) {
            console.error(`⚠️ ${eksikBilgiler.length} siparişte driver_id veya driver_phone EKSIK!`);
            console.error(`❌ Eksik siparişler:`, eksikBilgiler.map(o => o.ezcater_order_id));
          } else {
            console.log(`✅ Tüm siparişlerde driver_id ve driver_phone DOLU!`);
          }
        }, 1000);
      } else {
        alert('❌ Hata: ' + result.data.error);
      }
    } catch (error) {
      alert('❌ Canvas\'tan çekilemedi: ' + error.message);
    } finally {
      setFetchingFromCanvas(false);
    }
  };

  const handleExportToExcel = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Lütfen başlangıç ve bitiş tarihlerini seçin');
      return;
    }

    if (exportStartDate > exportEndDate) {
      alert('Başlangıç tarihi bitiş tarihinden sonra olamaz');
      return;
    }

    setIsExporting(true);
    try {
      const startDateStr = exportStartDate;
      const endDateStr = exportEndDate;

      console.log(`📊 Excel export: ${startDateStr} - ${endDateStr}`);

      // Backend function'ı import ile çağır
      const response = await exportOrdersToExcel({
        startDate: startDateStr,
        endDate: endDateStr
      });

      // CSV data olarak gel
      const blob = new Blob([response.data], { 
        type: 'text/csv; charset=utf-8' 
      });

      console.log(`📦 CSV Blob oluşturuldu: ${blob.size} bytes`);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Siparisler_${startDateStr}_${endDateStr}.csv`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 100);

      setShowExportModal(false);
      alert(`✅ CSV dosyası başarıyla indirildi!\n\n📅 ${startDateStr} - ${endDateStr}\n📦 Sadece "Sürücü Onayladı" durumundaki siparişler\n\n💡 Excel ile açabilirsiniz`);
    } catch (error) {
      console.error('❌ Excel export hatası:', error);
      alert(`❌ Excel export hatası: ${error.message}`);
    }
    setIsExporting(false);
  };

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`📅 ${selectedDate} tarihi için siparişler yükleniyor...`);
      
      const data = await base44.entities.DailyOrder.filter({ 
        order_date: selectedDate 
      }, '-created_date', 200); 
      
      console.log(`✅ ${data.length} sipariş yüklendi`);
      setOrders(data);
      setSelectedOrderIds([]);
    } catch (error) {
      console.error('❌ Siparişler yüklenirken hata:', error);
      setError('Siparişler yüklenirken hata: ' + error.message);
      setOrders([]);
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCheckMissingPhones = async () => {
    setIsCheckingPhones(true);
    try {
      const approvedOrders = orders.filter(o => o.status === 'Sürücü Onayladı');
      
      if (approvedOrders.length === 0) {
        alert('❌ "Sürücü Onayladı" statusünde sipariş yok!');
        setIsCheckingPhones(false);
        return;
      }

      const missingPhoneOrders = approvedOrders.filter(o => 
        !o.driver_phone || o.driver_phone.trim() === ''
      );

      const missingDriverOrders = approvedOrders.filter(o => 
        !o.driver_id || !o.driver_name
      );

      const result = {
        total: approvedOrders.length,
        missingPhone: missingPhoneOrders,
        missingDriver: missingDriverOrders,
        allGood: missingPhoneOrders.length === 0 && missingDriverOrders.length === 0
      };

      setMissingPhones(result);

      if (result.allGood) {
        alert(`✅ MÜKEMMEL!\n\nTüm ${result.total} onaylanmış sipariş için sürücü bilgileri tam!\n\n📞 Telefon numarası: ✅\n👤 Sürücü ID/İsim: ✅\n\nHiçbir mesaj kaçırılmayacak! 🎉`);
      }

    } catch (error) {
      console.error('Telefon kontrolü hatası:', error);
      alert(`❌ Hata: ${error.message}`);
    }
    setIsCheckingPhones(false);
  };

  const handlePreviewGroupedMessages = async () => {
    setIsPreviewingGroups(true);
    try {
      const approvedOrders = orders.filter(o => o.status === 'Sürücü Onayladı');
      
      if (approvedOrders.length === 0) {
        alert('❌ "Sürücü Onayladı" statusünde sipariş yok!');
        setIsPreviewingGroups(false);
        return;
      }

      const ordersByDriver = {};
      
      for (const order of approvedOrders) {
        if (!order.driver_id) continue;
        
        if (!ordersByDriver[order.driver_id]) {
          ordersByDriver[order.driver_id] = {
            driverName: order.driver_name,
            driverPhone: order.driver_phone,
            orders: []
          };
        }
        ordersByDriver[order.driver_id].orders.push(order);
      }

      const groupingResults = [];
      
      // 🔥 FIX: Saat parse fonksiyonu - AM/PM desteği
      const parseTime = (timeString) => {
        if (!timeString) return { hours: 0, minutes: 0 };
        
        // "10:30 AM" veya "10:30" formatını destekle
        const cleanTime = timeString.trim();
        
        // AM/PM var mı kontrol et
        const isPM = cleanTime.toLowerCase().includes('pm');
        const isAM = cleanTime.toLowerCase().includes('am');
        
        // Sadece saat:dakika kısmını al
        const timePart = cleanTime.replace(/\s*(am|pm)/gi, '').trim();
        const [hourStr, minStr] = timePart.split(':');
        
        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minStr, 10) || 0;
        
        // AM/PM dönüşümü
        if (isPM && hours !== 12) {
          hours += 12;
        } else if (isAM && hours === 12) {
          hours = 0;
        }
        
        return { hours, minutes };
      };
      
      for (const [driverId, driverData] of Object.entries(ordersByDriver)) {
        const sortedOrders = driverData.orders.sort((a, b) => {
          const timeA = parseTime(a.pickup_time || '00:00');
          const timeB = parseTime(b.pickup_time || '00:00');
          const totalA = timeA.hours * 60 + timeA.minutes;
          const totalB = timeB.hours * 60 + timeB.minutes;
          return totalA - totalB;
        });

        const orderGroups = [];
        let currentGroup = [];
        
        for (let i = 0; i < sortedOrders.length; i++) {
          const order = sortedOrders[i];
          
          if (!order.pickup_time) continue;
          
          if (currentGroup.length === 0) {
            currentGroup.push(order);
          } else {
            const lastOrder = currentGroup[currentGroup.length - 1];
            
            const lastTime = parseTime(lastOrder.pickup_time);
            const currTime = parseTime(order.pickup_time);
            
            const lastTimeInMinutes = lastTime.hours * 60 + lastTime.minutes;
            const currTimeInMinutes = currTime.hours * 60 + currTime.minutes;
            const diffInMinutes = currTimeInMinutes - lastTimeInMinutes;
            
            console.log(`⏰ Zaman farkı: ${lastOrder.pickup_time} → ${order.pickup_time} = ${diffInMinutes} dakika`);
            
            if (diffInMinutes <= 150) {
              currentGroup.push(order);
              console.log(`✅ Gruba eklendi (${diffInMinutes} ≤ 150)`);
            } else {
              orderGroups.push([...currentGroup]);
              currentGroup = [order];
              console.log(`❌ Yeni grup başlatıldı (${diffInMinutes} > 150)`);
            }
          }
        }
        
        if (currentGroup.length > 0) {
          orderGroups.push(currentGroup);
        }

        groupingResults.push({
          driverName: driverData.driverName,
          driverPhone: driverData.driverPhone,
          groups: orderGroups
        });
      }

      console.log('📊 Gruplandırma sonuçları:', groupingResults);
      setGroupPreview(groupingResults);
      
    } catch (error) {
      console.error('Grup önizleme hatası:', error);
      alert(`❌ Hata: ${error.message}`);
    }
    setIsPreviewingGroups(false);
  };

  const handleBulkApprove = async () => {
    const assignedOrders = orders.filter(o => o.status === 'Atandı');
    
    if (assignedOrders.length === 0) {
      alert('❌ "Atandı" durumunda sipariş yok!');
      return;
    }

    const confirmMessage = `🚨 TOPLU ONAYLAMA\n\n${assignedOrders.length} siparişi "Sürücü Onayladı" durumuna geçireceksiniz.\n\nBu siparişler için otomatik hatırlatma mesajları çalışmaya başlayacak!\n\nEmin misiniz?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsBulkApproving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      console.log(`🔄 ${assignedOrders.length} sipariş toplu onaylanıyor...`);
      
      for (let i = 0; i < assignedOrders.length; i++) {
        const order = assignedOrders[i];
        
        try {
          await base44.entities.DailyOrder.update(order.id, {
            status: 'Sürücü Onayladı',
            driver_response: 'Evet (Toplu Onay)',
            driver_response_at: new Date().toISOString()
          });
          
          successCount++;
          console.log(`✅ ${order.ezcater_order_id} onaylandı (${i+1}/${assignedOrders.length})`);
          
          if ((i + 1) % 3 === 0 && i < assignedOrders.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
        } catch (error) {
          failCount++;
          console.error(`❌ ${order.ezcater_order_id} onaylanamadı:`, error.message);
        }
      }
      
      if (failCount > 0) {
        alert(`⚠️ ${successCount} sipariş onaylandı, ${failCount} sipariş onaylanamadı.\n\nSayfa yenileniyor...`);
      } else {
        alert(`✅ TAMAMLANDI!\n\n${successCount} sipariş "Sürücü Onayladı" durumuna geçirildi!\n\n⏰ Artık otomatik hatırlatma mesajları gönderilecek (pickup time'dan 60 dk önce).`);
      }
      
      loadOrders();
      
    } catch (error) {
      console.error('Toplu onaylama hatası:', error);
      alert(`❌ Hata: ${error.message}\n\n${successCount} sipariş başarılı, ${failCount} başarısız.`);
    }
    
    setIsBulkApproving(false);
  };

  const handleIntelligentAssignment = async () => {
    setIsAssigning(true);
    try {
      const response = await intelligentOrderAssignment({ targetDate: selectedDate });
      
      if (response.data.success) {
        let chainCount = 0;
        if (response.data.assignments && response.data.assignments.length > 0) {
          for (let i = 1; i < response.data.assignments.length; i++) {
            if (response.data.assignments[i - 1].driverName === response.data.assignments[i].driverName) {
              chainCount++;
            }
          }
        }
        
        setAssignmentResults(response.data);
        
        alert(`✅ ${response.data.assignedCount} sipariş atandı!\n\n` +
              `📊 ${response.data.available_drivers} sürücü çalışıyor\n` +
              `🔗 ${chainCount} zincirleme atama yapıldı\n` +
              `🎯 Hybrid sistem kullanıldı`);
        
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Akıllı atama hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsAssigning(false);
  };

  const handleThreeLayerAssignment = async () => {
    if (!window.confirm(`🤖 3 KATMANLI AKILLI ATAMA\n\nBu sistem:\n\n1️⃣ HTML kurallarını LLM ile parse eder\n2️⃣ LLM ile optimal atamaları yapar\n3️⃣ Supervisor LLM ile denetler\n\n${selectedDate} tarihindeki siparişler için devam edilsin mi?`)) {
      return;
    }

    setIsAssigningThreeLayer(true);
    try {
      console.log('🚀 3 Katmanlı atama başlatılıyor...', { targetDate: selectedDate });
      const response = await threeLayerAssignment({ targetDate: selectedDate });
      console.log('📦 Backend response:', response);
      
      if (response.data.success) {
        setThreeLayerResults(response.data);
        
        const criticalViolations = response.data.violations?.filter(v => v.severity === 'critical').length || 0;
        const highViolations = response.data.violations?.filter(v => v.severity === 'high').length || 0;
        
        let alertMessage = `✅ ${response.data.assignedCount} sipariş atandı!\n\n`;
        alertMessage += `📊 3 KATMANLI SİSTEM:\n`;
        alertMessage += `1️⃣ ${response.data.layer1_summary}\n`;
        alertMessage += `2️⃣ ${response.data.layer2_summary}\n`;
        alertMessage += `3️⃣ ${response.data.layer3_summary}\n\n`;
        alertMessage += `🎯 Kalite Skoru: ${response.data.quality_score}/100\n\n`;
        
        if (criticalViolations > 0) {
          alertMessage += `⚠️ ${criticalViolations} kritik ihlal tespit edildi!\n`;
        }
        if (highViolations > 0) {
          alertMessage += `⚠️ ${highViolations} yüksek seviye ihlal tespit edildi!\n`;
        }
        
        if (response.data.violations && response.data.violations.length > 0) {
          alertMessage += `\nDetaylar için sonuçlar penceresini inceleyin.`;
        }
        
        alert(alertMessage);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('❌ 3 Katmanlı Atama hatası:', error);
      console.error('Error stack:', error.stack);
      console.error('Error response:', error.response?.data);
      alert(`❌ Bağlantı hatası: ${error.message}\n\nDetaylar için console'u kontrol edin.`);
    }
    setIsAssigningThreeLayer(false);
  };



  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) {
      alert('Lütfen silmek için sipariş seçin!');
      return;
    }

    if (!window.confirm(`${selectedOrderIds.length} siparişi silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setIsDeletingBulk(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedOrderIds.length; i++) {
        const orderId = selectedOrderIds[i];
        try {
          await base44.entities.DailyOrder.delete(orderId);
          successCount++;
          
          if ((i + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Sipariş silme hatası (${orderId}):`, error);
          failCount++;
        }
      }

      if (failCount > 0) {
        alert(`⚠️ ${successCount} sipariş silindi, ${failCount} sipariş silinemedi.`);
      } else {
        alert(`✅ ${successCount} sipariş başarıyla silindi!`);
      }
      
      loadOrders();
    } catch (error) {
      alert(`❌ Toplu silme hatası: ${error.message}`);
    }
    setIsDeletingBulk(false);
  };

  const handleResetAssignments = async () => {
    const assignedCount = orders.filter(o => o.status === 'Atandı').length;
    
    if (assignedCount === 0) {
      alert('Bu tarihte atanmış sipariş yok!');
      return;
    }

    const confirmMessage = `${selectedDate} tarihindeki ${assignedCount} sipariş atamasını geri almak istediğinizden emin misiniz?\n\nTüm siparişler "Çekildi" durumuna dönecek.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsResetting(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      const assignedOrders = orders.filter(o => o.status === 'Atandı');
      
      console.log(`🔄 ${assignedOrders.length} sipariş ataması geri alınıyor...`);
      
      for (let i = 0; i < assignedOrders.length; i++) {
        const order = assignedOrders[i];
        
        try {
          await base44.entities.DailyOrder.update(order.id, {
            driver_id: null,
            driver_name: null,
            status: 'Çekildi'
          });
          
          successCount++;
          
          if ((i + 1) % 3 === 0 && i < assignedOrders.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (error) {
          failCount++;
          console.error(`❌ ${order.ezcater_order_id} geri alınamadı:`, error.message);
        }
      }
      
      if (failCount > 0) {
        alert(`⚠️ ${successCount} sipariş geri alındı, ${failCount} sipariş geri alınamadı.\n\nSayfa yenileniyor...`);
      } else {
        alert(`✅ ${successCount} sipariş ataması başarıyla geri alındı!`);
      }
      
      loadOrders();
      
    } catch (error) {
      console.error('Toplu geri alma hatası:', error);
      alert(`❌ Hata: ${error.message}\n\n${successCount} sipariş başarılı, ${failCount} başarısız.`);
    }
    
    setIsResetting(false);
  };

  const handleCleanOldOrders = async () => {
    const confirmMessage = `30 günden eski siparişleri silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`;
    
    if (!window.confirm(confirmMessage)) return;

    setIsCleaningOldOrders(true);
    
    try {
      const response = await cleanOldOrders();
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Silinen: ${response.data.deletedCount}\nHata: ${response.data.errorCount || 0}`);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Temizlik hatası: ${error.message}`);
      console.error('Temizlik hatası:', error);
    }
    
    setIsCleaningOldOrders(false);
  };

  const handleResetAllAssignments = async () => {
    const confirmMessage = `${selectedDate} tarihindeki TÜM atamaları sıfırlamak istediğinizden emin misiniz?\n\nBu işlem:\n- Tüm "Atandı" siparişlerini "Çekildi" yapar\n- Sürücü bilgilerini temizler\n\nSonra "Akıllı Ata" ile yeniden atama yapabilirsiniz.`;
    
    if (!window.confirm(confirmMessage)) return;

    setIsResettingAll(true);
    
    try {
      const response = await resetAllAssignments({ targetDate: selectedDate });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\nŞimdi "Akıllı Ata" butonuna basabilirsiniz!`);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Bağlantı hatası: ${error.message}`);
      console.error('Sıfırlama hatası:', error);
    }
    
    setIsResettingAll(false);
  };

  const handleGPTAssignment = async () => {
    if (!window.confirm(`GPT-4 kullanarak ${selectedDate} tarihindeki siparişleri atamak istiyor musunuz?\n\nBu, manuel atama örneklerinizi ve sürücü profillerini analiz ederek en iyi atamaları yapacak.`)) {
      return;
    }

    setIsAssigningGPT(true);
    try {
      const response = await gptAssignment({ targetDate: selectedDate });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 ${response.data.assignedCount}/${response.data.totalOrders} sipariş atandı\n🤖 ${response.data.manualExamplesUsed} manuel örnek kullanıldı`);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('GPT atama hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsAssigningGPT(false);
  };

  const handleDebugAssignments = async () => {
    setIsDebugging(true);
    try {
      const response = await base44.functions.invoke('debugDriverAssignments', { 
        targetDate: selectedDate 
      });
      
      if (response.data.success) {
        const { summary, exceededDrivers } = response.data;
        
        let message = `🔍 DEBUG RAPORU (${selectedDate})\n\n`;
        message += `📊 Özet:\n`;
        message += `  • Toplam Aktif: ${summary.totalActiveDrivers}\n`;
        message += `  • Bugün Çalışan: ${summary.workingToday}\n`;
        message += `  • Atanan Sipariş: ${summary.totalAssignedOrders}\n`;
        message += `  • Max Aşan: ${summary.driversExceedingMax}\n\n`;
        
        if (exceededDrivers.length > 0) {
          message += `⚠️ MAX ORDER AŞAN SÜRÜCÜLER:\n`;
          exceededDrivers.forEach(d => {
            message += `  • ${d.name}: ${d.assignedCount}/${d.maxOrders} sipariş\n`;
          });
        } else {
          message += `✅ Hiçbir sürücü max order'ı aşmadı!\n`;
        }
        
        alert(message);
        console.log("Detaylı Debug:", response.data);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Debug hatası: ${error.message}`);
      console.error('Debug hatası:', error);
    }
    setIsDebugging(false);
  };

  const handleDebugUnassigned = async () => {
    const unassignedCount = orders.filter(o => o.status === 'Çekildi').length;
    
    if (unassignedCount === 0) {
      alert('✅ Tüm siparişler atandı!');
      return;
    }

    setIsDebugging(true);
    
    try {
      const unassignedOrders = orders.filter(o => o.status === 'Çekildi');
      const allDrivers = await base44.entities.Driver.filter({ status: 'Aktif' });
      const activeTopDashers = allDrivers.filter(d => d.is_top_dasher === true);
      
      const dayOfWeek = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      
      const workingDrivers = activeTopDashers.filter(d => {
        const workingDays = d.assignment_preferences?.working_days || [];
        return workingDays.length === 0 || workingDays.includes(dayOfWeek);
      });
      
      const assignedOrders = orders.filter(o => o.status === 'Atandı');
      const driverOrderCounts = {};
      assignedOrders.forEach(o => {
        if (o.driver_id) {
          driverOrderCounts[o.driver_id] = (driverOrderCounts[o.driver_id] || 0) + 1;
        }
      });
      
      const driversAtMax = workingDrivers.filter(d => {
        const maxOrders = d.assignment_preferences?.max_orders_per_day || 5;
        const currentCount = driverOrderCounts[d.id] || 0;
        return currentCount >= maxOrders;
      }).length;
      
      let message = `🔍 ATANAMAYAN SİPARİŞLER RAPORU (${selectedDate})\n\n`;
      message += `📊 Özet:\n`;
      message += `  • Toplam Sipariş: ${orders.length}\n`;
      message += `  • Atanan: ${assignedOrders.length}\n`;
      message += `  • Atanmamış: ${unassignedCount}\n`;
      message += `  • Çalışan Sürücü: ${workingDrivers.length}\n`;
      message += `  • Max Doldu: ${driversAtMax}\n\n`;
      
      message += `❌ ATANAMAYAN SİPARİŞLER:\n\n`;
      
      unassignedOrders.slice(0, 10).forEach((o, i) => {
        message += `${i+1}. ${o.ezcater_order_id} (${o.pickup_time})\n`;
        message += `   Pickup: ${o.pickup_address}\n`;
        message += `   Dropoff: ${o.dropoff_address}\n`;
        
        if (!o.pickup_coords) {
          message += `   ⚠️ Pickup koordinatı eksik!\n`;
        }
        if (!o.dropoff_coords) {
          message += `   ⚠️ Dropoff koordinatı eksik!\n`;
        }
        
        message += `\n`;
      });
      
      if (unassignedOrders.length > 10) {
        message += `... ve ${unassignedOrders.length - 10} sipariş daha\n\n`;
      }
      
      message += `💡 OLASI SEBEPLER:\n`;
      
      const noPickupCoords = unassignedOrders.filter(o => !o.pickup_coords).length;
      const noDropoffCoords = unassignedOrders.filter(o => !o.dropoff_coords).length;
      
      if (noPickupCoords > 0 || noDropoffCoords > 0) {
        message += `  🔴 ${noPickupCoords} sipariş pickup koordinatı eksik\n`;
        message += `  🔴 ${noDropoffCoords} sipariş dropoff koordinatı eksik\n`;
        message += `     → "Koordinat Bul" butonuna basın!\n\n`;
      }
      
      if (driversAtMax >= workingDrivers.length * 0.7) {
        message += `  🔴 Sürücülerin %70+ max order'da\n`;
        message += `     → Daha fazla sürücü aktive edin\n\n`;
      }
      
      if (workingDrivers.length < 15) {
        message += `  ⚠️ Çalışan sürücü sayısı az (${workingDrivers.length})\n`;
        message += `     → Daha fazla sürücü aktive edin\n\n`;
      }
      
      message += `  ℹ️ Min score threshold altında (Round 1: 0.28, Round 2: 0.15)\n`;
      message += `     → Çok uzak veya uygun zaman bulunamadı\n\n`;
      
      message += `\n📋 DETAYLI ANALİZ:\n`;
      message += `"Akıllı Ata" butonuna basıp sonuçlar ekranında\n`;
      message += `"Debug Raporu İndir" butonunu kullanın.`;
      
      alert(message);
      
    } catch (error) {
      alert(`❌ Debug hatası: ${error.message}`);
      console.error('Debug hatası:', error);
    }
    
    setIsDebugging(false);
  };

  const handleDebugCoordinates = async () => {
    setIsDebuggingCoords(true);
    try {
      const response = await base44.functions.invoke('debugCoordinates', { 
        targetDate: selectedDate 
      });
      
      if (response.data.success) {
        const { drivers, orders, date, dayOfWeek } = response.data;
        
        let message = `🔍 KOORDİNAT RAPORU\n`;
        message += `📅 Tarih: ${date} (${dayOfWeek})\n\n`;
        
        message += `👥 SÜRÜCÜLER:\n`;
        message += `   Toplam: ${drivers.total}\n`;
        message += `   Aktif Top Dasher: ${drivers.activeTopDashers}\n`;
        message += `   Bugün Çalışan: ${drivers.workingToday}\n`;
        message += `   ✅ Koordinatlı: ${drivers.withCoords}\n`;
        message += `   ❌ Koordinatsız: ${drivers.withoutCoords}\n\n`;
        
        if (drivers.missing.length > 0) {
          message += `⚠️ Koordinatsız Sürücüler:\n`;
          drivers.missing.slice(0, 5).forEach(d => {
            message += `   • ${d.name}: ${d.address}\n`;
          });
          if (drivers.missing.length > 5) {
            message += `   ... ve ${drivers.missing.length - 5} sürücü daha\n`;
          }
          message += `\n`;
        }
        
        message += `📦 SİPARİŞLER:\n`;
        message += `   Toplam: ${orders.total}\n`;
        message += `   ├─ Çekildi: ${orders.byStatus.cekildi}\n`;
        message += `   ├─ Atandı: ${orders.byStatus.atandi}\n`;
        message += `   └─ Tamamlandı: ${orders.byStatus.tamamlandi}\n\n`;
        
        message += `   ✅ Her iki nokta: ${orders.withBothCoords}\n`;
        message += `   ⚠️ Sadece pickup: ${orders.withPickupOnly}\n`;
        message += `   ⚠️ Sadece dropoff: ${orders.withDropoffOnly}\n`;
        message += `   ❌ Hiçbiri yok: ${orders.withNoCoords}\n`;
        message += `   📊 TOPLAM EKSİK: ${orders.totalMissing}\n\n`;
        
        if (orders.missing.length > 0) {
          message += `⚠️ Eksik Koordinatlı Siparişler (ilk 10):\n`;
          orders.missing.slice(0, 10).forEach(o => {
            message += `   • ${o.order_id} (${o.status}): ${o.missing === 'both' ? 'HER İKİSİ' : o.missing.toUpperCase()} eksik\n`;
          });
          if (orders.missing.length > 10) {
            message += `   ... ve ${orders.missing.length - 10} sipariş daha\n`;
          }
        }
        
        alert(message);
        console.log("Detaylı Debug:", response.data);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Debug hatası: ${error.message}`);
      console.error('Debug hatası:', error);
    }
    setIsDebuggingCoords(false);
  };

  const handleShowAddresses = async () => {
    try {
      const response = await base44.functions.invoke('showOrderAddresses', { 
        targetDate: selectedDate 
      });
      
      if (response.data.success) {
        let message = '📍 İLK 5 SİPARİŞ:\n\n';
        
        response.data.samples.forEach((s, i) => {
          message += `${i+1}. ${s.order_id}\n`;
          message += `   Pickup: ${s.pickup_address}\n`;
          message += `   Dropoff: ${s.dropoff_address}\n`;
          message += `   Coords: ${s.pickup_coords ? '✅' : '❌'} pickup, ${s.dropoff_coords ? '✅' : '❌'} dropoff\n\n`;
        });
        
        alert(message);
        console.log('Detaylı adresler:', response.data.samples);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Hata: ${error.message}`);
      console.error('showOrderAddresses hatası:', error);
    }
  };

  const handleFrontendGeocode = async () => {
    const needsGeocode = orders.filter(o => !o.pickup_coords || !o.dropoff_coords);
    if (needsGeocode.length === 0) { alert('✅ Tüm siparişler zaten koordinatlı!'); return; }
    if (!window.confirm(`${needsGeocode.length} sipariş için koordinat bulunacak (~${Math.ceil(needsGeocode.length * 2.5 / 60)} dk).`)) return;
    setIsGeocodingOrders(true);
    setGeocodingProgress(0);
    try {
      const { total, successCount, failCount } = await geocodeOrders(orders, {
        onProgress: setGeocodingProgress,
        updateOrder: (id, data) => base44.entities.DailyOrder.update(id, data)
      });
      alert(`✅ Geocoding tamamlandı!\n\n📊 İşlenen: ${total}\n✅ Başarılı: ${successCount}\n❌ Başarısız: ${failCount}`);
      loadOrders();
    } catch (error) {
      alert(`❌ Geocoding hatası: ${error.message}`);
    }
    setIsGeocodingOrders(false);
    setGeocodingProgress(0);
  };

  const handleUpdateDriverRules = async () => {
    if (!window.confirm('📋 HTML\'den sürücü kurallarını güncellemek ister misiniz?\n\nBu işlem:\n✅ avoid_dc, avoid_long_distance kurallarını\n✅ is_joker_driver, priority_level bilgilerini\n✅ Çalışma günleri ve vardiya tercihlerini\n✅ Tercih edilen bölgeleri\n\nDatabase\'e kaydedecek.\n\nSüre: ~2-3 dakika')) {
      return;
    }

    setIsUpdatingRules(true);
    setRuleUpdateProgress({ current: 0, total: 0, updated: 0, created: 0 });

    try {
      let batchStart = 0;
      let totalUpdated = 0;
      let totalCreated = 0;
      let totalDrivers = 0;
      
      while (true) {
        const response = await parseAndUpdateDriverRules({
          batchStart,
          batchSize: 1
        });
        
        if (!response.data.success) {
          throw new Error(response.data.error || 'Batch işleme hatası');
        }
        
        totalUpdated += response.data.updatedCount;
        totalCreated += response.data.createdCount;
        totalDrivers = response.data.totalDrivers;
        
        setRuleUpdateProgress({
          current: response.data.processedSoFar,
          total: totalDrivers,
          updated: totalUpdated,
          created: totalCreated
        });
        
        console.log(`✅ Batch tamamlandı: ${response.data.processedSoFar}/${totalDrivers}`);
        
        if (response.data.batchComplete) {
          break;
        }
        
        batchStart = response.data.nextBatchStart;
        
        await new Promise(r => setTimeout(r, 3000));
      }
      
      alert(`✅ Sürücü kuralları başarıyla güncellendi!\n\n` +
            `📊 Toplam: ${totalDrivers} sürücü\n` +
            `🔄 Güncellenen: ${totalUpdated}\n` +
            `🆕 Yeni: ${totalCreated}\n\n` +
            `Şimdi "Akıllı Ata" butonuna basarak test edebilirsiniz!`);
      
    } catch (error) {
      console.error('Kural güncelleme hatası:', error);
      alert(`❌ Hata: ${error.message}\n\nGüncellenen: ${ruleUpdateProgress?.updated || 0}\nYeni: ${ruleUpdateProgress?.created || 0}`);
    }
    
    setIsUpdatingRules(false);
    setRuleUpdateProgress(null);
  };

  const handleTestSingleGeocode = async () => {
    const orderId = prompt('Test edilecek sipariş ID\'sini girin (örn: EzQMTZ5W):');
    
    if (!orderId) return;
    
    try {
      const response = await base44.functions.invoke('testSingleGeocode', { orderId });
      
      if (response.data.success) {
        alert(`✅ Test başarılı!\n\nÖNCE:\nPickup: ${response.data.before.pickup_coords ? 'VAR' : 'YOK'}\nDropoff: ${response.data.before.dropoff_coords ? 'VAR' : 'YOK'}\n\nSONRA:\nPickup: ${response.data.after.pickup_coords ? 'VAR' : 'YOK'}\nDropoff: ${response.data.after.dropoff_coords ? 'VAR' : 'YOK'}`);
        loadOrders();
      } else {
        alert(`❌ Test başarısız: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Hata: ${error.message}`);
    }
  };

  const handleSendAssignmentSMS = async () => {
    setIsSendingAssignmentSMS(true);
    
    try {
      // 🔥 FRESH DATA ÇEK - State'deki eski veri değil, database'deki güncel veriyi kullan
      console.log('🔄 Fresh data çekiliyor...');
      const freshOrders = await base44.entities.DailyOrder.filter({ 
        order_date: selectedDate 
      }, '-created_date', 200);
      
      const atandiOrders = freshOrders.filter(o => o.status === 'Atandı');
      
      console.log('🔍 SMS GÖNDERİM KONTROLÜ (FRESH DATA):');
      console.log(`📦 Toplam "Atandı" sipariş: ${atandiOrders.length}`);
      
      atandiOrders.forEach(o => {
        console.log(`\n📋 ${o.ezcater_order_id}:`);
        console.log(`   - driver_id: ${o.driver_id || '❌ EKSIK'}`);
        console.log(`   - driver_name: ${o.driver_name || '❌ EKSIK'}`);
        console.log(`   - driver_phone: ${o.driver_phone || '❌ EKSIK'}`);
      });
      
      const assignedOrders = atandiOrders.filter(o => 
        o.driver_id && 
        o.driver_phone
      );
      
      console.log(`\n✅ SMS için uygun sipariş: ${assignedOrders.length}`);
      
      if (assignedOrders.length === 0) {
        alert('❌ "Atandı" durumunda sipariş yok veya sürücü bilgileri eksik!\n\nKontrol edin:\n- Siparişler "Atandı" durumunda mı?\n- driver_id ve driver_phone dolu mu?\n\nDetaylar için Console\'u (F12) kontrol edin.');
        setIsSendingAssignmentSMS(false);
        return;
      }

      const confirmMessage = `${assignedOrders.length} atanmış siparişi sürücülere onay için SMS göndermek istiyor musunuz?\n\nSürücüler EVET/HAYIR veya gecikme süresi ile yanıt verebilecek.`;
      
      if (!window.confirm(confirmMessage)) {
        setIsSendingAssignmentSMS(false);
        return;
      }

      const response = await sendOrderAssignmentSMS({ 
        orderIds: assignedOrders.map(o => o.id)
      });
      
      if (response.data.success) {
        const { sent, failed } = response.data;
        let message = `✅ ${sent.length} siparişe SMS gönderildi!\n\n`;
        
        if (failed.length > 0) {
          message += `⚠️ ${failed.length} sipariş gönderilemedi:\n`;
          failed.slice(0, 3).forEach(f => {
            message += `- ${f.orderId}: ${f.reason}\n`;
          });
        }
        
        alert(message);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.error || response.data.message}`);
        setIsSendingAssignmentSMS(false);
      }
    } catch (error) {
      console.error('SMS gönderim hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
      setIsSendingAssignmentSMS(false);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === sortedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(sortedOrders.map(o => o.id));
    }
  };

  const stats = {
    total: orders.length,
    assigned: orders.filter(o => o.status === 'Atandı').length,
    pending: orders.filter(o => o.status === 'Çekildi').length,
    completed: orders.filter(o => o.status === 'Tamamlandı').length,
    driverApproved: orders.filter(o => o.status === 'Sürücü Onayladı').length,
    waitingApproval: orders.filter(o => o.status === 'Sürücü Onayı Bekleniyor').length,
    driverRejected: orders.filter(o => o.status === 'Sürücü Reddetti').length,
    delayed: orders.filter(o => o.estimated_delay_minutes && o.estimated_delay_minutes > 0).length,
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus) {
      if (order.status !== filterStatus) {
        return false;
      }
    }

    // Zaman aralığı filtresi - driver_response_at'e göre en son onaylanmış siparişleri göster
    if (timeRangeFilter) {
      // Sadece "Sürücü Onayladı" durumundaki siparişler için çalış
      if (order.status !== 'Sürücü Onayladı') {
        return false;
      }

      // driver_response_at yoksa filtrele
      if (!order.driver_response_at) {
        return false;
      }

      // Seçili tarihteki TÜM onaylı siparişleri bul
      const approvedOrdersOnDate = orders.filter(o => 
        o.status === 'Sürücü Onayladı' &&
        o.order_date === selectedDate &&
        o.driver_response_at
      );

      if (approvedOrdersOnDate.length === 0) return false;

      // En yüksek (en son) driver_response_at zamanını bul
      const latestResponseTime = Math.max(...approvedOrdersOnDate.map(o => 
        new Date(o.driver_response_at).getTime()
      ));

      // Bu siparişin driver_response_at'i ile en son zaman arasındaki farkı hesapla
      const orderResponseTime = new Date(order.driver_response_at).getTime();
      const diffMinutes = (latestResponseTime - orderResponseTime) / (1000 * 60);

      // timeRangeFilter dakika içinde değilse false döndür
      if (diffMinutes > timeRangeFilter) {
        return false;
      }
    }

    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      order.driver_name?.toLowerCase().includes(search) ||
      order.ezcater_order_id?.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.pickup_address?.toLowerCase().includes(search) ||
      order.dropoff_address?.toLowerCase().includes(search)
    );
  });

  // "Sürücü Onayladı" durumunda en yeni onaydan eskiye sırala
  const sortedOrders = filterStatus === 'Sürücü Onayladı' 
    ? [...filteredOrders].sort((a, b) => {
        const timeA = a.driver_response_at ? new Date(a.driver_response_at).getTime() : 0;
        const timeB = b.driver_response_at ? new Date(b.driver_response_at).getTime() : 0;
        return timeB - timeA; // En yeni başta
      })
    : filteredOrders;

  const getStatusLabel = (status) => {
    switch(status) {
      case 'Çekildi': return '🕐 Bekleyen';
      case 'Atandı': return '👤 Atandı';
      case 'Sürücü Onayı Bekleniyor': return '⚠️ Onay Bekliyor';
      case 'Sürücü Onayladı': return '✅ Onaylandı';
      case 'Sürücü Reddetti': return '❌ Reddedildi';
      case 'Tamamlandı': return '✅ Tamamlandı';
      case 'İptal Edildi': return '🚫 İptal Edildi';
      default: return status;
    }
  };

  if (showAssignedOrders) {
    return (
      <AssignmentReport
        assignments={orders.filter(o => o.status === 'Atandı')}
        targetDate={selectedDate}
        onClose={() => setShowAssignedOrders(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sipariş Yönetimi</h1>
            <p className="text-slate-600 text-sm">Siparişleri yönetin ve sürücülere atayın</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            
            {orders.filter(o => o.status === 'Sürücü Onayladı').length > 0 && (
              <>
                <Button 
                  onClick={handlePreviewGroupedMessages}
                  disabled={isPreviewingGroups}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 ring-2 ring-purple-300 shadow-lg"
                  title="Hangi sürücüye kaç sipariş gruplanmış olacağını göster"
                >
                  {isPreviewingGroups ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analiz Ediliyor...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      🔗 Toplu Mesaj Önizleme ({orders.filter(o => o.status === 'Sürücü Onayladı').length})
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleCheckMissingPhones}
                  disabled={isCheckingPhones}
                  size="sm"
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 ring-2 ring-orange-300 shadow-lg"
                  title="Onaylanmış siparişlerde eksik telefon numaralarını kontrol et"
                >
                  {isCheckingPhones ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Kontrol Ediliyor...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 mr-2" />
                      📞 Telefon Eksiklerini Kontrol Et ({orders.filter(o => o.status === 'Sürücü Onayladı').length})
                    </>
                  )}
                </Button>
              </>
            )}
            
            {orders.filter(o => o.status === 'Atandı').length > 0 && (
              <Button 
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                size="sm"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 ring-2 ring-green-300 shadow-lg"
                title="Tüm 'Atandı' siparişlerini toplu onayla"
              >
                {isBulkApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Onaylanıyor...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Atamaları Onayla ({orders.filter(o => o.status === 'Atandı').length})
                  </>
                )}
              </Button>
            )}

            <Button 
              onClick={handleUpdateDriverRules}
              disabled={isUpdatingRules}
              size="sm"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              title="HTML'den sürücü kurallarını oku ve güncelle"
            >
              {isUpdatingRules ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kurallar Güncelleniyor... {ruleUpdateProgress ? `${ruleUpdateProgress.current}/${ruleUpdateProgress.total}` : ''}
                </>
              ) : (
                <>
                  📋 Sürücü Kurallarını Güncelle (HTML)
                </>
              )}
            </Button>

            {orders.filter(o => !o.pickup_coords || !o.dropoff_coords).length > 0 && (
              <Button 
                onClick={handleFrontendGeocode}
                disabled={isGeocodingOrders}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {isGeocodingOrders ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Geocoding... {geocodingProgress}%
                  </>
                ) : (
                  `🗺️ Koordinat Bul (${orders.filter(o => !o.pickup_coords || !o.dropoff_coords).length})`
                )}
              </Button>
            )}

            <Button 
              onClick={handleCleanOldOrders}
              disabled={isCleaningOldOrders}
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              title="30 günden eski siparişleri sil (performans iyileştirme)"
            >
              {isCleaningOldOrders ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Temizleniyor...
                </>
              ) : (
                '🗑️ Eski Siparişleri Temizle'
              )}
            </Button>

            {orders.filter(o => o.status === 'Atandı').length > 0 && (
              <Button 
                onClick={handleResetAllAssignments}
                disabled={isResettingAll}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                title="Tüm atamaları temizle ve yeniden başla"
              >
                {isResettingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sıfırlanıyor...
                  </>
                ) : (
                  `🔄 Tüm Atamaları Sıfırla (${orders.filter(o => o.status === 'Atandı').length})`
                )}
              </Button>
            )}

            {orders.filter(o => o.status === 'Atandı').length > 0 && (
              <Button 
                onClick={handleResetAssignments}
                disabled={isResetting}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                title="Atanmış tüm siparişlerin atamasını geri alır"
            >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Geri Alınıyor...
                  </>
                ) : (
                  `Atamaları Geri Al (${orders.filter(o => o.status === 'Atandı').length})`
                )}
              </Button>
            )}

            <Button 
              onClick={handleThreeLayerAssignment}
              disabled={isAssigningThreeLayer || orders.filter(o => o.status === 'Çekildi').length === 0}
              size="sm"
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 ring-2 ring-blue-300 shadow-lg"
              title="3 Katmanlı LLM Sistemi: Parse → Ata → Denetle"
            >
              {isAssigningThreeLayer ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  3 Katman Çalışıyor...
                </>
              ) : (
                <>
                  🎯 3 Seviyeli Akıllı Ata
                </>
              )}
            </Button>

            <Button 
              onClick={handleGPTAssignment}
              disabled={isAssigningGPT || orders.filter(o => o.status === 'Çekildi').length === 0}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              title="GPT-4 ile manuel örneklerden öğrenerek ata"
            >
              {isAssigningGPT ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  GPT Çalışıyor...
                </>
              ) : (
                <>
                  🤖 AI ile Ata (GPT)
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleIntelligentAssignment}
              disabled={isAssigning || orders.filter(o => o.status === 'Çekildi').length === 0}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isAssigning ? 'Atanıyor...' : 'Akıllı Ata'}
            </Button>
            
            {orders.filter(o => o.status === 'Atandı').length > 0 && (
              <Button 
                onClick={handleSendAssignmentSMS}
                disabled={isSendingAssignmentSMS}
                size="sm"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                title="Atanmış siparişler için onay SMS'i gönder"
              >
                {isSendingAssignmentSMS ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    SMS Gönderiliyor...
                  </>
                ) : (
                  `📲 Onay SMS Gönder (${orders.filter(o => o.status === 'Atandı').length})`
                )}
              </Button>
            )}

            <button
              onClick={handleSendToCanvas}
              disabled={sendingToCanvas || !selectedDate}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sendingToCanvas ? '⏳ Gönderiliyor...' : '📤 Canvas\'a Gönder'}
            </button>

            <button
              onClick={handleFetchFromCanvas}
              disabled={fetchingFromCanvas || !selectedDate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {fetchingFromCanvas ? '⏳ Çekiliyor...' : '📥 Canvas\'tan Atamaları Getir'}
            </button>

            <Button
              onClick={() => setShowExportModal(true)}
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV İndir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
          {stats.driverApproved > 0 && (
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 shadow-xl col-span-2 md:col-span-8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white">
                    <p className="text-sm font-bold mb-1 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      ⚡ ONAYLANMIŞ SİPARİŞLER
                    </p>
                    <p className="text-3xl font-black">{stats.driverApproved}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => {
                      setFilterStatus('Sürücü Onayladı');
                      setTimeRangeFilter(30);
                    }}
                    size="sm"
                    className="bg-white text-green-700 hover:bg-green-50 font-bold shadow-lg"
                  >
                    🔥 Son 30 dk
                  </Button>
                  <Button
                    onClick={() => {
                      setFilterStatus('Sürücü Onayladı');
                      setTimeRangeFilter(120);
                    }}
                    size="sm"
                    className="bg-white text-green-700 hover:bg-green-50 font-bold shadow-lg"
                  >
                    ⏰ Son 2 saat
                  </Button>
                  <Button
                    onClick={() => {
                      setFilterStatus(null);
                      setTimeRangeFilter(null);
                    }}
                    size="sm"
                    className="bg-white text-green-700 hover:bg-green-50 font-bold shadow-lg"
                  >
                    📋 Tüm Siparişler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="bg-white border-slate-200">
            <CardContent className="p-3">
              <label className="text-xs text-slate-600 block mb-2">Tarih</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-1.5 border rounded text-sm"
              />
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Toplam</p>
                  <p className="text-xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'Çekildi' ? null : 'Çekildi')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Bekleyen</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => stats.assigned > 0 && setShowAssignedOrders(true)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Atandı</p>
                  <p className="text-xl font-bold text-blue-600">{stats.assigned}</p>
                </div>
                <User className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'Sürücü Onayı Bekleniyor' ? null : 'Sürücü Onayı Bekleniyor')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Onay Bekliyor</p>
                  <p className="text-xl font-bold text-orange-600">{stats.waitingApproval}</p>
                </div>
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-green-50 border-2 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'Sürücü Onayladı' ? null : 'Sürücü Onayladı')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">✅ Onaylandı</p>
                  <p className="text-xl font-bold text-green-600">{stats.driverApproved}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-slate-200 border-2 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'İptal Edildi' ? null : 'İptal Edildi')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">🚫 İptal</p>
                  <p className="text-xl font-bold text-slate-500">{orders.filter(o => o.status === 'İptal Edildi').length}</p>
                </div>
                <XCircle className="w-5 h-5 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-white border-red-50 border-2 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'Sürücü Reddetti' ? null : 'Sürücü Reddetti')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">❌ Reddedildi</p>
                  <p className="text-xl font-bold text-red-600">{stats.driverRejected}</p>
                </div>
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Tamamlandı</p>
                  <p className="text-xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <Package className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {(filterStatus || timeRangeFilter) && (
          <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {filterStatus && (
                    <span className="text-lg font-bold text-white">
                      {getStatusLabel(filterStatus)}
                    </span>
                  )}
                  {timeRangeFilter && (
                    <Badge className="bg-white text-indigo-700 text-sm font-bold px-3 py-1">
                      {timeRangeFilter === 30 ? '🔥 Son 30 dakika' : '⏰ Son 2 saat'}
                    </Badge>
                  )}
                  <span className="text-lg font-bold text-white">
                    → {sortedOrders.length} sipariş gösteriliyor
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFilterStatus(null);
                    setTimeRangeFilter(null);
                  }}
                  className="h-9 text-white hover:bg-white/20 font-bold"
                >
                  <X className="w-5 h-5 mr-1" />
                  Filtreyi Temizle
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center gap-3">
              <CardTitle className="text-base">
                {selectedDate} Siparişleri ({filteredOrders.length}/{orders.length})
              </CardTitle>
              <div className="flex gap-2">
                {selectedOrderIds.length > 0 && (
                  <Button 
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeletingBulk ? 'Siliniyor...' : `Seçilenleri Sil (${selectedOrderIds.length})`}
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px] h-9"
                  />
                </div>
                <Button 
                  onClick={() => setShowScreenshotUpload(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Screenshot Yükle
                </Button>
                <Button 
                  onClick={() => setShowJsonImport(true)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  JSON Import
                </Button>
              </div>
            </div>
            {sortedOrders.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Checkbox 
                  checked={selectedOrderIds.length === sortedOrders.length}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm text-slate-600 cursor-pointer">
                  Tümünü Seç
                </label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">Yükleniyor...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 text-sm">
                <p>{error}</p>
                <Button 
                  onClick={loadOrders}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Yeniden Dene
                </Button>
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {filterStatus ? `${getStatusLabel(filterStatus)} durumunda sipariş yok` : 
                 searchTerm ? 'Arama sonucu bulunamadı' : 'Bu tarihe ait sipariş bulunamadı'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedOrders.map((order) => (
                  <div key={order.id} className="relative">
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedOrderIds.includes(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        className="bg-white"
                      />
                    </div>
                    <OrderCard 
                      order={order} 
                      onUpdate={loadOrders}
                      onViewDetails={setSelectedOrder} 
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {assignmentResults && (
        <IntelligentAssignmentResults
          results={assignmentResults}
          onClose={() => setAssignmentResults(null)}
        />
      )}

      <ThreeLayerResultsModal results={threeLayerResults} onClose={() => setThreeLayerResults(null)} />

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {showScreenshotUpload && (
        <ScreenshotUpload
          selectedDate={selectedDate}
          onClose={() => {
            setShowScreenshotUpload(false);
            loadOrders();
          }}
          onSuccess={() => {
            setShowScreenshotUpload(false);
            loadOrders();
          }}
        />
      )}

      <JsonImportModal
        show={showJsonImport}
        onClose={() => setShowJsonImport(false)}
        onSuccess={() => { setShowJsonImport(false); loadOrders(); }}
      />

      {missingPhones && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{missingPhones.allGood ? '✅ Telefon Kontrolü' : '⚠️ Eksik Telefon Numaraları'}</h2>
              <button onClick={() => setMissingPhones(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            {missingPhones.allGood ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900 mb-2">MÜKEMMEL!</h3>
                <p className="text-green-800">Tüm <strong>{missingPhones.total}</strong> sipariş için sürücü bilgileri tam!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <p className="font-semibold text-yellow-900">⚠️ Eksik Bilgiler: Telefon: {missingPhones.missingPhone.length}, Sürücü: {missingPhones.missingDriver.length}</p>
                </div>
                {missingPhones.missingPhone.map((order, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-semibold text-red-900">{order.ezcater_order_id} — {order.driver_name || '?'} — 📞 EKSİK</p>
                  </div>
                ))}
                {missingPhones.missingDriver.map((order, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="font-semibold text-orange-900">{order.ezcater_order_id} — Sürücü bilgisi eksik</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📊 CSV Export</h2>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Başlangıç Tarihi</label>
                  <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bitiş Tarihi</label>
                  <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowExportModal(false)} variant="outline" className="flex-1">İptal</Button>
                <Button onClick={handleExportToExcel} disabled={isExporting} className="flex-1 bg-green-600 hover:bg-green-700">
                  {isExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />İndiriliyor...</> : <><Download className="w-4 h-4 mr-2" />CSV İndir</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GroupPreviewModal groupPreview={groupPreview} onClose={() => setGroupPreview(null)} />
    </div>
  );
}