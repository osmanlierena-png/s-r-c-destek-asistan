import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  BarChart3
} from "lucide-react";
import OrderCard from "../components/orders/OrderCard";
import IntelligentAssignmentResults from "../components/orders/IntelligentAssignmentResults";
import OrderDetails from "../components/orders/OrderDetails";
import AssignmentReport from "../components/orders/AssignmentReport";
import ScreenshotUpload from "../components/orders/ScreenshotUpload";

export default function OrderManagementPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentResults, setAssignmentResults] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSendingOrders, setIsSendingOrders] = useState(false);
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
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isCheckingPhones, setIsCheckingPhones] = useState(false);
  const [missingPhones, setMissingPhones] = useState(null);
  const [isPreviewingGroups, setIsPreviewingGroups] = useState(false);
  const [groupPreview, setGroupPreview] = useState(null);

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
      const { intelligentOrderAssignment } = await import("@/functions/intelligentOrderAssignment");
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
      const { threeLayerAssignment } = await import("@/functions/threeLayerAssignment");
      const response = await threeLayerAssignment({ targetDate: selectedDate });
      
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
      console.error('3 Katmanlı Atama hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsAssigningThreeLayer(false);
  };

  const handleSendOrdersToDrivers = async () => {
    const assignedCount = orders.filter(o => o.status === 'Atandı').length;
    
    if (assignedCount === 0) {
      alert('Bu tarihte atanmış sipariş bulunamadı!');
      return;
    }

    const confirmMessage = `${selectedDate} tarihindeki ${assignedCount} siparişi sürücülere SMS'le göndermek istediğinizden emin misiniz?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSendingOrders(true);
    try {
      const { sendOrdersToDrivers } = await import("@/functions/sendOrdersToDrivers");
      const response = await sendOrdersToDrivers({ targetDate: selectedDate });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        loadOrders();
      } else {
        alert(`❌ Hata: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Sipariş gönderim hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsSendingOrders(false);
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
      const { cleanOldOrders } = await import("@/functions/cleanOldOrders");
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
      const { resetAllAssignments } = await import("@/functions/resetAllAssignments");
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
      const { gptAssignment } = await import("@/functions/gptAssignment");
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
    
    if (needsGeocode.length === 0) {
      alert('✅ Tüm siparişler zaten koordinatlı!');
      return;
    }

    if (!window.confirm(`${needsGeocode.length} sipariş için koordinat bulunacak.\n\nBu işlem yaklaşık ${Math.ceil(needsGeocode.length * 2.5 / 60)} dakika sürebilir (Nominatim API'si nedeniyle, istekler arası bekleme süresi var).`)) {
      return;
    }

    setIsGeocodingOrders(true);
    setGeocodingProgress(0);
    
    let successCount = 0;
    let failCount = 0;

    const cleanAddress = (address) => {
      if (!address) return address;
      
      let cleaned = address
        .replace(/\b(door|suite|building|unit|apt|apartment|floor|room|ste|bldg|fl)\s*#?\s*[\w\-]+/gi, '')
        .replace(/\d{4,}\s+[A-Za-z\s]+(?=,)/g, '')
        .replace(/\d+(st|nd|rd|th)\s+floor/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return cleaned;
    };

    const extractBasicAddress = (address) => {
      if (!address) return null;
      
      const zipMatch = address.match(/\b(\d{5})\b/);
      const zip = zipMatch ? zipMatch[1] : '';
      
      const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
      const state = stateMatch ? stateMatch[1] : '';
      
      const cityMatch = address.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
      const city = cityMatch ? cityMatch[1].trim() : '';
      
      const streetMatch = address.match(/^([\d\s]+[A-Za-z\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pkwy)?)/i);
      const street = streetMatch ? streetMatch[1].trim() : '';
      
      if (street && city && state) {
        return `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}`;
      } else if (city && state && zip) {
        return `${city}, ${state} ${zip}`;
      }
      
      return null;
    };

    const extractZipFallback = (address) => {
      if (!address) return null;
      
      const zipMatch = address.match(/\b(\d{5})\b/);
      const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
      const cityMatch = address.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
      
      if (cityMatch && stateMatch && zipMatch) {
        return `${cityMatch[1].trim()}, ${stateMatch[1]} ${zipMatch[1]}`;
      } else if (zipMatch && stateMatch) {
        return `${stateMatch[1]} ${zipMatch[1]}`;
      } else if (zipMatch) {
        return zipMatch[1];
      }
      
      return null;
    };

    try {
      for (let i = 0; i < needsGeocode.length; i++) {
        const order = needsGeocode[i];
        
        console.log(`\n[${i+1}/${needsGeocode.length}] ${order.ezcater_order_id}`);
        
        let pickupCoords = order.pickup_coords;
        let dropoffCoords = order.dropoff_coords;
        
        if (!pickupCoords && order.pickup_address) {
          try {
            const cleanPickup = cleanAddress(order.pickup_address);
            console.log(`  🔍 Pickup (clean): ${cleanPickup}`);
            
            let pickupResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanPickup + ', USA')}&limit=1&countrycodes=us`,
              { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
            );
            
            if (pickupResponse.ok) {
              const pickupData = await pickupResponse.json();
              
              if (pickupData && pickupData.length > 0) {
                pickupCoords = {
                  lat: parseFloat(pickupData[0].lat),
                  lng: parseFloat(pickupData[0].lon)
                };
                console.log(`  ✅ Pickup (clean): ${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`);
              }
            }
            
            if (!pickupCoords) {
              await new Promise(r => setTimeout(r, 1100));
              
              const basicAddress = extractBasicAddress(order.pickup_address);
              if (basicAddress) {
                console.log(`  🔄 Pickup (basic): ${basicAddress}`);
                
                pickupResponse = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(basicAddress + ', USA')}&limit=1&countrycodes=us`,
                  { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
                );
                
                if (pickupResponse.ok) {
                  const pickupData = await pickupResponse.json();
                  if (pickupData && pickupData.length > 0) {
                    pickupCoords = {
                      lat: parseFloat(pickupData[0].lat),
                      lng: parseFloat(pickupData[0].lon)
                    };
                    console.log(`  ✅ Pickup (basic): ${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`);
                  }
                }
              }
            }
            
            if (!pickupCoords) {
              await new Promise(r => setTimeout(r, 1100));
              
              const zipFallback = extractZipFallback(order.pickup_address);
              if (zipFallback) {
                console.log(`  🏙️ Pickup (zip fallback): ${zipFallback}`);
                
                pickupResponse = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipFallback + ', USA')}&limit=1&countrycodes=us`,
                  { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
                );
                
                if (pickupResponse.ok) {
                  const pickupData = await pickupResponse.json();
                  if (pickupData && pickupData.length > 0) {
                    pickupCoords = {
                      lat: parseFloat(pickupData[0].lat),
                      lng: parseFloat(pickupData[0].lon)
                    };
                    console.log(`  ✅ Pickup (zip center): ${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)} [YAKLAŞIK]`);
                  }
                }
              }
            }
            
            if (!pickupCoords) {
              console.log(`  ❌ Pickup bulunamadı (3 deneme)`);
            }
            
            await new Promise(r => setTimeout(r, 1100));
          } catch (error) {
            console.error(`  ❌ Pickup error:`, error.message);
          }
        }
        
        if (!dropoffCoords && order.dropoff_address) {
          try {
            const cleanDropoff = cleanAddress(order.dropoff_address);
            console.log(`  🔍 Dropoff (clean): ${cleanDropoff}`);
            
            let dropoffResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanDropoff + ', USA')}&limit=1&countrycodes=us`,
              { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
            );
            
            if (dropoffResponse.ok) {
              const dropoffData = await dropoffResponse.json();
              
              if (dropoffData && dropoffData.length > 0) {
                dropoffCoords = {
                  lat: parseFloat(dropoffData[0].lat),
                  lng: parseFloat(dropoffData[0].lon)
                };
                console.log(`  ✅ Dropoff (clean): ${dropoffCoords.lat.toFixed(4)}, ${dropoffCoords.lng.toFixed(4)}`);
              }
            }
            
            if (!dropoffCoords) {
              await new Promise(r => setTimeout(r, 1100));
              
              const basicAddress = extractBasicAddress(order.dropoff_address);
              if (basicAddress) {
                console.log(`  🔄 Dropoff (basic): ${basicAddress}`);
                
                dropoffResponse = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(basicAddress + ', USA')}&limit=1&countrycodes=us`,
                  { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
                );
                
                if (dropoffResponse.ok) {
                  const dropoffData = await dropoffResponse.json();
                  if (dropoffData && dropoffData.length > 0) {
                    dropoffCoords = {
                      lat: parseFloat(dropoffData[0].lat),
                      lng: parseFloat(dropoffData[0].lon)
                    };
                    console.log(`  ✅ Dropoff (basic): ${dropoffCoords.lat.toFixed(4)}, ${dropoffCoords.lng.toFixed(4)}`);
                  }
                }
              }
            }
            
            if (!dropoffCoords) {
              await new Promise(r => setTimeout(r, 1100));
              
              const zipFallback = extractZipFallback(order.dropoff_address);
              if (zipFallback) {
                console.log(`  🏙️ Dropoff (zip fallback): ${zipFallback}`);
                
                dropoffResponse = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipFallback + ', USA')}&limit=1&countrycodes=us`,
                  { headers: { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' } }
                );
                
                if (dropoffResponse.ok) {
                  const dropoffData = await dropoffResponse.json();
                  if (dropoffData && dropoffData.length > 0) {
                    dropoffCoords = {
                      lat: parseFloat(dropoffData[0].lat),
                      lng: parseFloat(dropoffData[0].lon)
                    };
                    console.log(`  ✅ Dropoff (zip center): ${dropoffCoords.lat.toFixed(4)}, ${dropoffCoords.lng.toFixed(4)} [YAKLAŞIK]`);
                  }
                }
              }
            }
            
            if (!dropoffCoords) {
              console.log(`  ❌ Dropoff bulunamadı (3 deneme)`);
            }
            
            await new Promise(r => setTimeout(r, 1100));
          } catch (error) {
            console.error(`  ❌ Dropoff error:`, error.message);
          }
        }
        
        if (pickupCoords || dropoffCoords) {
          try {
            const updateData = {};
            if (pickupCoords && (!order.pickup_coords || (order.pickup_coords.lat !== pickupCoords.lat || order.pickup_coords.lng !== pickupCoords.lng))) {
              updateData.pickup_coords = pickupCoords;
            }
            if (dropoffCoords && (!order.dropoff_coords || (order.dropoff_coords.lat !== dropoffCoords.lat || order.dropoff_coords.lng !== dropoffCoords.lng))) {
              updateData.dropoff_coords = dropoffCoords;
            }
            
            if (Object.keys(updateData).length > 0) {
              await base44.entities.DailyOrder.update(order.id, updateData);
              successCount++;
              console.log(`  💾 Database güncellendi`);
            } else {
              console.log(`  ℹ️ Koordinatlar zaten günceldi, atlandı.`);
            }
          } catch (error) {
            failCount++;
            console.error(`  ⚠️ Database güncelleme hatası (${order.ezcater_order_id}):`, error.message);
          }
        } else {
          failCount++;
          console.log(`  ❌ ${order.ezcater_order_id} için koordinat bulunamadı veya güncellenmedi.`);
        }
        
        setGeocodingProgress(Math.round(((i + 1) / needsGeocode.length) * 100));
        
        if ((i + 1) % 5 === 0 && i < needsGeocode.length - 1) {
          console.log(`  ⏳ Batch bekleme...`);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      alert(`✅ Geocoding tamamlandı!\n\n📊 İşlenen: ${needsGeocode.length}\n✅ Başarılı: ${successCount}\n❌ Başarısız: ${failCount}`);
      loadOrders();
      
    } catch (error) {
      alert(`❌ Geocoding hatası: ${error.message}\n\nBaşarılı: ${successCount}\nBaşarısız: ${failCount}`);
      console.error('Geocoding hatası:', error);
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
      const { parseAndUpdateDriverRules } = await import("@/functions/parseAndUpdateDriverRules");
      
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
    const assignedOrders = orders.filter(o => 
      o.status === 'Atandı' && 
      o.driver_id && 
      o.driver_phone
    );
    
    if (assignedOrders.length === 0) {
      alert('Bu tarihte sürücüye atanmış sipariş yok!');
      return;
    }

    const confirmMessage = `${assignedOrders.length} atanmış siparişi sürücülere onay için SMS göndermek istiyor musunuz?\n\nSürücüler EVET/HAYIR veya gecikme süresi ile yanıt verebilecek.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSendingAssignmentSMS(true);
    try {
      const { sendOrderAssignmentSMS } = await import("@/functions/sendOrderAssignmentSMS");
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
      }
    } catch (error) {
      console.error('SMS gönderim hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsSendingAssignmentSMS(false);
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
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
      if (filterStatus === 'DELAYED') {
        if (!order.estimated_delay_minutes || order.estimated_delay_minutes <= 0) {
          return false;
        }
      } else if (order.status !== filterStatus) {
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

  const getStatusLabel = (status) => {
    switch(status) {
      case 'Çekildi': return '🕐 Bekleyen';
      case 'Atandı': return '👤 Atandı';
      case 'Sürücü Onayı Bekleniyor': return '⚠️ Onay Bekliyor';
      case 'Sürücü Onayladı': return '✅ Onaylandı';
      case 'Sürücü Reddetti': return '❌ Reddedildi';
      case 'Tamamlandı': return '✅ Tamamlandı';
      case 'DELAYED': return '⏱️ Gecikmeler';
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
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sipariş Yönetimi</h1>
            <p className="text-slate-600 text-sm">Siparişleri yönetin ve sürücülere atayın</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            
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
                onClick={handleSendOrdersToDrivers}
                disabled={isSendingOrders}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                title="Atanmış siparişleri SMS ile sürücülere gönder"
              >
                {isSendingOrders ? 'Gönderiliyor...' : `SMS Gönder (${orders.filter(o => o.status === 'Atandı').length})`}
              </Button>
            )}

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

          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
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
            className="bg-white border-orange-50 border-2 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterStatus(filterStatus === 'DELAYED' ? null : 'DELAYED')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">⏱️ Gecikmeler</p>
                  <p className="text-xl font-bold text-orange-600">{stats.delayed}</p>
                </div>
                <AlertTriangle className="w-5 h-5 text-orange-500" />
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

        {filterStatus && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-900">
                    Filtreleniyor: {getStatusLabel(filterStatus)}
                  </span>
                  <span className="text-sm text-blue-600">
                    ({filteredOrders.length} sipariş)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilterStatus(null)}
                  className="h-7 text-blue-700 hover:bg-blue-100"
                >
                  <X className="w-4 h-4 mr-1" />
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
              </div>
            </div>
            {filteredOrders.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Checkbox 
                  checked={selectedOrderIds.length === filteredOrders.length}
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
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {filterStatus ? `${getStatusLabel(filterStatus)} durumunda sipariş yok` : 
                 searchTerm ? 'Arama sonucu bulunamadı' : 'Bu tarihe ait sipariş bulunamadı'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredOrders.map((order) => (
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

      {threeLayerResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">🎯 3 Katmanlı Atama Sonuçları</h2>
                <button
                  onClick={() => setThreeLayerResults(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Kalite Skoru</span>
                  <span className="text-3xl font-bold text-purple-600">
                    {threeLayerResults.quality_score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                    style={{ width: `${threeLayerResults.quality_score}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="font-semibold mb-2">1️⃣ Parser LLM</div>
                  <p className="text-sm text-slate-600">{threeLayerResults.layer1_summary}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="font-semibold mb-2">2️⃣ Assignment LLM</div>
                  <p className="text-sm text-slate-600">{threeLayerResults.layer2_summary}</p>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="font-semibold mb-2">3️⃣ Supervisor LLM</div>
                  <p className="text-sm text-slate-600">{threeLayerResults.layer3_summary}</p>
                </div>
              </div>

              {threeLayerResults.violations && threeLayerResults.violations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-lg">⚠️ Tespit Edilen İhlaller ({threeLayerResults.violations.length})</h3>
                  {threeLayerResults.violations.map((v, i) => (
                    <div 
                      key={i}
                      className={`border-l-4 p-4 rounded ${
                        v.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        v.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                        v.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">
                          {v.order_id} → {v.driver_name}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                          v.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                          v.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {v.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mb-2">{v.description}</p>
                      <div className="text-xs text-slate-600">
                        💡 <strong>Öneri:</strong> {v.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-bold text-lg">📋 Atamalar ({threeLayerResults.assignedCount})</h3>
                {threeLayerResults.assignments.map((a, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-blue-600">
                        {a.order_id} → {a.driver_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {a.driver_phone}
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>🔵 Pickup: {a.pickup_time} - {a.pickup_address}</div>
                      <div>🟢 Dropoff: {a.dropoff_time} - {a.dropoff_address}</div>
                      <div className="text-slate-600 italic mt-2">💭 {a.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {missingPhones && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {missingPhones.allGood ? '✅ Telefon Numarası Kontrolü' : '⚠️ Eksik Telefon Numaraları'}
                </h2>
                <button
                  onClick={() => setMissingPhones(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {missingPhones.allGood ? (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-900 mb-2">MÜKEMMEL!</h3>
                  <p className="text-green-800">
                    Tüm <strong>{missingPhones.total}</strong> onaylanmış sipariş için sürücü bilgileri tam!
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-green-700">
                    <p>📞 Telefon numarası: ✅</p>
                    <p>👤 Sürücü ID/İsim: ✅</p>
                    <p className="mt-4 font-semibold">Hiçbir mesaj kaçırılmayacak! 🎉</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                      <div>
                        <p className="font-semibold text-yellow-900 mb-2">
                          UYARI: Eksik Bilgiler Bulundu!
                        </p>
                        <div className="text-sm text-yellow-800 space-y-1">
                          <p>• Toplam Onaylanmış Sipariş: <strong>{missingPhones.total}</strong></p>
                          <p>• Eksik Telefon: <strong className="text-red-600">{missingPhones.missingPhone.length}</strong></p>
                          <p>• Eksik Sürücü Bilgisi: <strong className="text-red-600">{missingPhones.missingDriver.length}</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {missingPhones.missingPhone.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <Phone className="w-5 h-5 text-red-600" />
                        Telefon Numarası Eksik ({missingPhones.missingPhone.length})
                      </h3>
                      <div className="space-y-2">
                        {missingPhones.missingPhone.map((order, i) => (
                          <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Package className="w-4 h-4 text-red-600" />
                                  <span className="font-semibold text-red-900">
                                    {order.ezcater_order_id}
                                  </span>
                                </div>
                                <div className="text-sm space-y-1 text-red-800">
                                  <p>👤 Sürücü: <strong>{order.driver_name || 'Bilinmiyor'}</strong></p>
                                  <p>📞 Telefon: <strong className="text-red-600">EKSİK!</strong></p>
                                  <p>⏰ Pickup: {order.pickup_time}</p>
                                  <p className="text-xs text-red-700 mt-2">
                                    ❌ Bu siparişe mesaj gönderilemeyecek!
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {missingPhones.missingDriver.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <User className="w-5 h-5 text-orange-600" />
                        Sürücü Bilgisi Eksik ({missingPhones.missingDriver.length})
                      </h3>
                      <div className="space-y-2">
                        {missingPhones.missingDriver.map((order, i) => (
                          <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Package className="w-4 h-4 text-orange-600" />
                                  <span className="font-semibold text-orange-900">
                                    {order.ezcater_order_id}
                                  </span>
                                </div>
                                <div className="text-sm space-y-1 text-orange-800">
                                  <p>👤 Sürücü ID: <strong className="text-orange-600">{order.driver_id ? '✅' : '❌ EKSİK'}</strong></p>
                                  <p>📝 Sürücü İsim: <strong className="text-orange-600">{order.driver_name || '❌ EKSİK'}</strong></p>
                                  <p>⏰ Pickup: {order.pickup_time}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 text-sm">💡 Çözüm:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>1. Driver Management sayfasına git</p>
                      <p>2. Eksik telefon numaralarını ekle</p>
                      <p>3. Bu sayfaya geri dön ve tekrar kontrol et</p>
                      <p className="mt-3 font-semibold text-blue-900">
                        ⚠️ Telefon numarası olmayan siparişlere mesaj gönderilemez!
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {groupPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 z-10">
              <div className="flex justify-between items-center">
                <div className="text-white">
                  <h2 className="text-2xl font-bold">🔗 Toplu Mesaj Gruplandırma Önizlemesi</h2>
                  <p className="text-sm text-purple-100 mt-1">Hangi sürücüye kaç sipariş birleşik gönderilecek</p>
                </div>
                <button
                  onClick={() => setGroupPreview(null)}
                  className="text-white hover:text-purple-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {groupPreview.map((driverGroup, idx) => (
                <div key={idx} className="border-2 border-slate-300 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50 shadow-md">
                  <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-slate-200">
                    <div>
                      <h3 className="font-bold text-xl text-slate-900">{driverGroup.driverName}</h3>
                      <p className="text-sm text-slate-600 mt-1">{driverGroup.driverPhone}</p>
                    </div>
                    <div className="text-right bg-purple-100 rounded-lg px-4 py-2">
                      <p className="text-xs text-purple-700 font-semibold">MESAJ SAYISI</p>
                      <p className="text-3xl font-bold text-purple-700">{driverGroup.groups.length}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {driverGroup.groups.map((group, groupIdx) => {
                      const isGrouped = group.length > 1;
                      return (
                        <div 
                          key={groupIdx}
                          className={`rounded-xl p-5 shadow-md ${
                            isGrouped 
                              ? 'bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-100 border-4 border-purple-400' 
                              : 'bg-white border-2 border-slate-300'
                          }`}
                        >
                          <div className={`flex items-center justify-between mb-4 pb-3 border-b-2 ${isGrouped ? 'border-purple-300' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                              {isGrouped ? (
                                <>
                                  <div className="bg-purple-600 rounded-full p-2">
                                    <MessageSquare className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-black text-xl text-purple-800 uppercase tracking-wide">
                                      🔗 GRUP MESAJI
                                    </p>
                                    <p className="text-purple-600 text-sm font-semibold mt-1">
                                      {group.length} sipariş tek SMS'te birleştirildi
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="bg-slate-400 rounded-full p-2">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-base text-slate-700">
                                      📄 Tekil Mesaj
                                    </p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                      Tek sipariş için ayrı mesaj
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">İlk Pickup</p>
                              <p className="text-lg font-bold text-slate-700">{group[0].pickup_time}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {group.map((order, orderIdx) => (
                              <div key={orderIdx} className={`rounded-lg p-4 ${
                                isGrouped 
                                  ? 'bg-white border-2 border-purple-300' 
                                  : 'bg-slate-50 border border-slate-300'
                              }`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <p className="font-mono font-black text-base text-slate-900">
                                        {order.ezcater_order_id}
                                      </p>
                                      {isGrouped && (
                                        <Badge className={`${orderIdx === 0 ? 'bg-purple-700' : 'bg-purple-500'} text-white font-bold`}>
                                          {orderIdx === 0 ? 'ANA' : `+${orderIdx}`}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-700 flex items-center gap-1 font-semibold">
                                      <Clock className="w-4 h-4" />
                                      {order.pickup_time} → {order.dropoff_time}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-2">
                                      📍 {order.pickup_address}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {isGrouped && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg">
                              <div className="flex items-start gap-3 text-white">
                                <div className="bg-white/20 rounded-full p-2">
                                  <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-base mb-1">
                                    💬 TEK SMS GÖNDERİMİ
                                  </p>
                                  <p className="text-sm text-purple-100">
                                    Bu {group.length} sipariş için sadece <strong className="text-yellow-300">1 adet SMS</strong> gönderilecek.
                                    Pickup süreleri 2.5 saat içinde olduğu için gruplandırıldı.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 border-4 border-blue-400 rounded-xl p-6 shadow-xl">
                <h4 className="font-black text-blue-900 mb-4 text-xl flex items-center gap-3">
                  <div className="bg-blue-600 rounded-full p-2">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  📊 MESAJ GÖNDERİM ÖZETİ
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 border-2 border-blue-300 shadow-md">
                    <p className="text-xs text-slate-600 mb-2 font-semibold">TOPLAM SÜRÜCÜ</p>
                    <p className="text-4xl font-black text-blue-600">{groupPreview.length}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-300 shadow-md">
                    <p className="text-xs text-slate-600 mb-2 font-semibold">SMS GÖNDERİLECEK</p>
                    <p className="text-4xl font-black text-purple-600">
                      {groupPreview.reduce((sum, d) => sum + d.groups.length, 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-300 shadow-md">
                    <p className="text-xs text-slate-600 mb-2 font-semibold">🔗 GRUPLANDIRILMIŞ</p>
                    <p className="text-4xl font-black text-purple-600">
                      {groupPreview.reduce((sum, d) => sum + d.groups.filter(g => g.length > 1).length, 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-slate-300 shadow-md">
                    <p className="text-xs text-slate-600 mb-2 font-semibold">📄 TEKİL</p>
                    <p className="text-4xl font-black text-slate-700">
                      {groupPreview.reduce((sum, d) => sum + d.groups.filter(g => g.length === 1).length, 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg border-2 border-blue-700 shadow-lg">
                  <p className="text-sm text-white font-semibold">
                    💡 <strong className="text-yellow-200">FARK:</strong> Gruplandırılmış mesajlarda birden fazla sipariş tek SMS'te gönderilir. 
                    Bu sayede hem <strong className="text-yellow-200">maliyet düşer</strong> hem de sürücü için <strong className="text-yellow-200">daha kolay okunur</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}