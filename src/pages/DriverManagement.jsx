import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BarChart2, RefreshCw, User, Calendar, Sunrise } from "lucide-react";
import DriverList from "../components/management/DriverList";
import { useNavigate, useLocation } from "react-router-dom";

export default function DriverManagementPage() {
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingStatuses, setIsUpdatingStatuses] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingChains, setIsImportingChains] = useState(false);
  const [selectedDay, setSelectedDay] = useState('all');
  const [isUpdatingEarlyMorning, setIsUpdatingEarlyMorning] = useState(false);
  const [isImportingNewDrivers, setIsImportingNewDrivers] = useState(false);
  const [isExtractingAreas, setIsExtractingAreas] = useState(false);
  const [isParsingRules, setIsParsingRules] = useState(false);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isTestingRegionPriorities, setIsTestingRegionPriorities] = useState(false);
  const [isUpdatingRegionPriorities, setIsUpdatingRegionPriorities] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isParsingRules) {
        e.preventDefault();
        e.returnValue = 'Sürücü kuralları parse ediliyor! Sayfayı kapatırsanız işlem yarıda kalacak.';
        return e.returnValue;
      }
    };

    const handlePopState = (e) => {
      if (isParsingRules) {
        const confirmLeave = window.confirm(
          '⚠️ Sürücü kuralları parse ediliyor!\n\n' +
          `İlerleme: ${parseProgress.current}/${parseProgress.total}\n\n` +
          'Şimdi ayrılırsanız işlem yarıda kalacak. Yine de ayrılmak istiyor musunuz?'
        );
        
        if (!confirmLeave) {
          e.preventDefault();
          window.history.pushState(null, '', location.pathname + location.search);
        }
      }
    };

    if (isParsingRules) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      window.history.pushState(null, '', location.pathname + location.search);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isParsingRules, parseProgress, location]);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      console.log(`🔄 Sürücüler yükleniyor... (Deneme ${retryCount + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const driversData = await base44.entities.Driver.list('-created_date', 200);
        clearTimeout(timeoutId);
        
        console.log(`✅ ${driversData.length} sürücü yüklendi`);
        setDrivers(driversData);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch (error) {
      console.error('Sürücüler yüklenirken hata:', error);
      
      if (retryCount < 2) {
        console.log(`⚠️ Hata oluştu, ${retryCount + 2}. deneme yapılıyor...`);
        await new Promise(r => setTimeout(r, 2000));
        return loadDrivers(retryCount + 1);
      }
      
      alert(
        `❌ Sürücüler yüklenirken hata oluştu!\n\n` +
        `Hata: ${error.message}\n\n` +
        `Lütfen:\n` +
        `1. İnternet bağlantınızı kontrol edin\n` +
        `2. Sayfayı yenileyin (F5)\n` +
        `3. Sorun devam ederse Dashboard → Data → Driver bölümünden kontrol edin`
      );
    }
    setIsLoading(false);
  };

  const handleUpdateFromData = async () => {
    setIsUpdating(true);
    try {
      const { updateDriversFromData } = await import("@/functions/updateDriversFromData");
      const response = await updateDriversFromData();
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Sürücü verilerini güncelleme hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsUpdating(false);
  };

  const handleUpdateStatuses = async () => {
    setIsUpdatingStatuses(true);
    try {
      const { updateDriverStatuses } = await import("@/functions/updateDriverStatuses");
      const response = await updateDriverStatuses();
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Sürücü durumlarını güncelleme hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsUpdatingStatuses(false);
  };

  const handleDeleteAll = async () => {
    const confirmMessage = "⚠️ DİKKAT! Tüm sürücüleri silmek üzeresiniz!\n\nBu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { deleteAllDrivers } = await import("@/functions/deleteAllDrivers");
      const response = await deleteAllDrivers();
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Silme hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsDeleting(false);
  };

  const handleImportHTML = async () => {
    setIsImporting(true);
    try {
      const { importDriversFromStoredHTML } = await import("@/functions/importDriversFromStoredHTML");
      const response = await importDriversFromStoredHTML();
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Detaylar:\n- Eklenen: ${response.data.addedCount}\n- Parse edilen: ${response.data.totalParsed}\n- Beklenen: ${response.data.expectedTotal}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Import hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsImporting(false);
  };

  const handleImportChains = async () => {
    setIsImportingChains(true);
    try {
      const { importChainHistory } = await import("@/functions/importChainHistory");
      const response = await importChainHistory();
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Güncellenen: ${response.data.updatedCount}\nToplam: ${response.data.totalDrivers}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Chain import hatası:', error);
      alert(`❌ Bağlantı hatası: ${error.message}`);
    }
    setIsImportingChains(false);
  };

  const handleUpdateEarlyMorning = async () => {
    setIsUpdatingEarlyMorning(true);
    try {
      const { updateEarlyMorningReliability } = await import("@/functions/updateEarlyMorningReliability");
      const response = await updateEarlyMorningReliability();
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\nGüncellenen: ${response.data.updatedCount}\nToplam: ${response.data.totalDrivers}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Bağlantı hatası: ${error.message}`);
      console.error('Erken sabah güncelleme hatası:', error);
    }
    setIsUpdatingEarlyMorning(false);
  };

  const handleImportNewDrivers = async () => {
    const fileUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/687922c274a70a2de1788cbe/28e42a58b_driver_applications_table.html';
    
    if (!window.confirm('⚠️ 11 yeni sürücüyü Top Dasher olarak eklemek istiyor musunuz?')) {
      return;
    }

    setIsImportingNewDrivers(true);
    try {
      const { simpleImportDrivers } = await import("@/functions/simpleImportDrivers");
      const response = await simpleImportDrivers({ file_url: fileUrl });
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Eklenen: ${response.data.summary.added}/${response.data.summary.totalApplications}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ İçe aktarma hatası: ${error.message}`);
      console.error('Import hatası:', error);
    }
    setIsImportingNewDrivers(false);
  };

  const handleExtractPreferredAreas = async () => {
    if (!window.confirm('Top Dasher\'ların notes alanından tercih bölgelerini çıkarmak istiyor musunuz?')) {
      return;
    }

    setIsExtractingAreas(true);
    try {
      const { extractPreferredAreasFromNotes } = await import("@/functions/extractPreferredAreasFromNotes");
      const response = await extractPreferredAreasFromNotes();
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 ${response.data.updatedCount}/${response.data.totalTopDashers} Top Dasher güncellendi`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Bağlantı hatası: ${error.message}`);
      console.error('Extract hatası:', error);
    }
    setIsExtractingAreas(false);
  };

  const handleParseDriverRules = async () => {
    if (!window.confirm('📋 Sürücü kurallarını parse etmek istiyor musunuz?\n\n⚠️ ÖNEMLİ:\n✅ SADECE KURALLAR güncellenir (bölgeler, günler, saatler)\n✅ STATUS DEĞİŞMEZ (aktif → aktif kalır)\n✅ Home coordinates KORUNUR\n\nİşlem 10-15 dakika sürebilir. Devam?')) {
      return;
    }

    if (!window.confirm('⚠️ ADIM 1: Önce "Aktif Listesini Uygula" butonuna bastınız mı?\n\nBu çok önemli - yoksa parse öncesi sürücü durumları doğru olmayabilir!\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    setIsParsingRules(true);
    setParseProgress({ current: 0, total: 0 });
    
    let totalUpdated = 0;
    let totalCreated = 0;
    let batchStart = 0;
    const batchSize = 1;
    let retryCount = 0;
    const maxRetries = 5;
    
    try {
      while (true) {
        const batchNum = Math.floor(batchStart / batchSize) + 1;
        console.log(`\n📦 Batch ${batchNum} başlatılıyor (${batchStart})...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 240000);
          
          const response = await base44.functions.invoke('parseAndUpdateDriverRules', {
            batchStart,
            batchSize
          }, {
            signal: controller.signal
          }).catch(err => {
            clearTimeout(timeoutId);
            throw err;
          });
          
          clearTimeout(timeoutId);
          
          if (!response.data.success) {
            throw new Error(response.data.error || 'Backend hatası');
          }
          
          retryCount = 0;
          
          totalUpdated += response.data.updatedCount || 0;
          totalCreated += response.data.createdCount || 0;
          
          setParseProgress({
            current: response.data.processedSoFar || 0,
            total: response.data.totalDrivers || 0
          });
          
          console.log(`✅ Batch ${batchNum} OK: ${response.data.processedSoFar}/${response.data.totalDrivers}`);
          
          if (response.data.batchComplete) {
            console.log(`\n🎉 Tamamlandı!`);
            alert(`✅ Parse tamamlandı!\n\n📊 Özet:\n- Güncellenen: ${totalUpdated}\n- Yeni Oluşturulan: ${totalCreated}\n- Toplam: ${response.data.totalDrivers}\n\n⚠️ STATUS DEĞİŞMEDİ - Aktif sürücüler aktif kaldı!`);
            loadDrivers();
            break;
          }
          
          batchStart = response.data.nextBatchStart;
          
          const waitTime = (batchNum % 10 === 0) ? 20000 : 15000;
          console.log(`⏸️  ${waitTime/1000} saniye bekleniyor...`);
          await new Promise(r => setTimeout(r, waitTime));
          
        } catch (batchError) {
          retryCount++;
          const errorMsg = batchError.message || batchError.toString();
          console.error(`❌ Batch ${batchNum} hata (deneme ${retryCount}/${maxRetries}):`, errorMsg);
          
          if (retryCount >= maxRetries) {
            const shouldContinue = window.confirm(
              `❌ Batch ${batchNum} ${maxRetries} denemeden sonra başarısız!\n\n` +
              `Hata: ${errorMsg}\n\n` +
              `Şu ana kadar:\n- Güncellenen: ${totalUpdated}\n- Yeni Oluşturulan: ${totalCreated}\n\n` +
              `Devam etmek ister musunuz? (Bu batch atlanacak)`
            );
            
            if (shouldContinue) {
              retryCount = 0;
              batchStart += batchSize;
              continue;
            } else {
              throw new Error(`Batch ${batchNum} başarısız: ${errorMsg}`);
            }
          }
          
          const waitTime = Math.min(30000 + (20000 * retryCount), 90000);
          console.log(`⏳ ${retryCount}. deneme için ${waitTime/1000} saniye bekleniyor...`);
          await new Promise(r => setTimeout(r, waitTime));
          
          continue;
        }
      }
      
    } catch (error) {
      alert(`❌ Parse hatası: ${error.message}\n\nŞu ana kadar:\n- Güncellenen: ${totalUpdated}\n- Yeni Oluşturulan: ${totalCreated}`);
      console.error('Parse hatası:', error);
      
      if (totalUpdated > 0 || totalCreated > 0) {
        loadDrivers();
      }
    }
    
    setIsParsingRules(false);
    setParseProgress({ current: 0, total: 0 });
  };

  const handleRestoreFromHTML = async () => {
    if (!window.confirm('⚠️ ACİL GERİ YÜKLEME\n\nHTML dosyasından son bilinen doğru duruma dönmek istiyor musunuz?\n\nBu işlem:\n✅ Status, language, çalışma günleri geri yükler\n✅ Max sipariş sayıları düzeltir\n✅ Bölge analizi VERİLERİNİ KORUR\n\nDevam?')) {
      return;
    }

    setIsRestoring(true);
    try {
      const { restoreDriversFromHTML } = await import("@/functions/restoreDriversFromHTML");
      const response = await restoreDriversFromHTML();
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Detaylar:\n- Geri yüklenen: ${response.data.updatedCount}\n- Toplam sürücü: ${response.data.totalDrivers}`);
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Geri yükleme hatası: ${error.message}`);
      console.error('Geri yükleme hatası:', error);
    }
    setIsRestoring(false);
  };

  const handleAnalyzeDamage = async () => {
    setIsAnalyzing(true);
    try {
      const { analyzeDriverDamage } = await import("@/functions/analyzeDriverDamage");
      const response = await analyzeDriverDamage();
      
      if (response.data.success) {
        setAnalysisResult(response.data);
        
        const msg = `📊 DURUM ANALİZİ:\n\n` +
          `Toplam Sürücü: ${response.data.summary.total}\n` +
          `✅ Telefonu olan: ${response.data.summary.original}\n` +
          `❌ Telefonu olmayan: ${response.data.summary.withoutPhone}\n` +
          `⭐ Top Dasher: ${response.data.summary.topDashers}\n` +
          `🔁 Duplicate isimler: ${response.data.summary.duplicates}\n\n` +
          `⚠️ Muhtemelen YANLIŞ eklenen: ${response.data.summary.suspiciousNew}\n\n` +
          `Detaylar console'da. Ne yapmak istiyorsun?`;
        
        alert(msg);
        console.log('🔍 DETAYLI ANALİZ:', response.data);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Analiz hatası: ${error.message}`);
      console.error('Analiz hatası:', error);
    }
    setIsAnalyzing(false);
  };

  const handleDeleteSuspicious = async () => {
    if (!analysisResult) {
      alert('⚠️ Önce "Durum Analizi" yap!');
      return;
    }
    
    const suspiciousCount = analysisResult.summary.suspiciousNew;
    
    if (suspiciousCount === 0) {
      alert('✅ Silinecek şüpheli sürücü yok!');
      return;
    }
    
    if (!window.confirm(
      `⚠️ ${suspiciousCount} telefonsuz Top Dasher silinecek!\n\n` +
      `Bunlar muhtemelen parse sırasında yanlış oluşturulan kayıtlar.\n\n` +
      `ORİJİNAL sürücüler (${analysisResult.summary.original} adet) KORUNACAK.\n\n` +
      `Devam?`
    )) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const { deletePhonelessTopDashers } = await import("@/functions/deletePhonelessTopDashers");
      const response = await deletePhonelessTopDashers();
      
      if (response.data.success) {
        alert(`✅ ${response.data.deletedCount} şüpheli sürücü silindi!\n\nKalan: ${response.data.remaining}`);
        loadDrivers();
        setAnalysisResult(null);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Silme hatası: ${error.message}`);
    }
    setIsDeleting(false);
  };

  const handleTestRegionPriorities = async () => {
    setIsTestingRegionPriorities(true);
    try {
      const response = await base44.functions.invoke('testRegionPriorities', {});
      
      if (response.data.success) {
        const { summary, driversWithRegionPriorities, fredericksburgTest } = response.data;
        
        let msg = `🧪 BÖLGE ÖNCELİK TESTİ\n\n`;
        msg += `📊 ÖZET:\n`;
        msg += `  • Toplam sürücü: ${summary.totalDrivers}\n`;
        msg += `  • Bölge önceliği olan: ${summary.driversWithPriorities}\n`;
        msg += `  • Bölge önceliği olmayan: ${summary.driversWithoutPriorities}\n\n`;
        
        if (driversWithRegionPriorities.length > 0) {
          msg += `✅ BÖLGE ÖNCELİĞİ OLAN SÜRÜCÜLER:\n\n`;
          driversWithRegionPriorities.forEach(d => {
            msg += `👤 ${d.name}\n`;
            Object.entries(d.region_priorities).forEach(([region, priority]) => {
              msg += `   📍 ${region}: ${priority}. öncelik\n`;
            });
            msg += `\n`;
          });
        }
        
        msg += `\n🧪 FREDERICKSBURG TESTİ:\n`;
        msg += `Sipariş bölgesi: ${fredericksburgTest.orderRegion.city}, ${fredericksburgTest.orderRegion.state}\n\n`;
        
        if (fredericksburgTest.priorityLevel1.length > 0) {
          msg += `✅ 1. ÖNCELİKLİ (${fredericksburgTest.priorityLevel1.length}):\n`;
          fredericksburgTest.priorityLevel1.forEach(d => {
            msg += `   • ${d.name} (${d.matched_region})\n`;
          });
          msg += `\n`;
        } else {
          msg += `❌ 1. öncelikli sürücü YOK\n\n`;
        }
        
        if (fredericksburgTest.priorityLevel2.length > 0) {
          msg += `⚠️ 2. ÖNCELİKLİ (${fredericksburgTest.priorityLevel2.length}):\n`;
          fredericksburgTest.priorityLevel2.forEach(d => {
            msg += `   • ${d.name} (${d.matched_region})\n`;
          });
        }
        
        msg += `\n\n💡 SONUÇ:\n`;
        if (fredericksburgTest.priorityLevel1.length > 0) {
          msg += `✅ Fredericksburg siparişleri için öncelikli sürücüler VAR!\n`;
          msg += `Atama sistemi bunları kullanacak.`;
        } else {
          msg += `❌ Fredericksburg için öncelikli sürücü YOK!\n`;
          msg += `Lütfen Driver Management'ta ilgili sürücülere\n`;
          msg += `special_notes.region_priorities alanını ekle:\n`;
          msg += `{ "fredericksburg": 1, "stafford": 1 }`;
        }
        
        alert(msg);
        console.log('🧪 DETAYLI TEST SONUCU:', response.data);
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Test hatası: ${error.message}`);
      console.error('Test hatası:', error);
    }
    setIsTestingRegionPriorities(false);
  };

  const handleUpdateRegionPriorities = async () => {
    if (!window.confirm(
      '📍 BÖLGE ÖNCELİKLERİNİ EKLE\n\n' +
      'Bu işlem 5 sürücüye bölge öncelikleri ekleyecek:\n\n' +
      '1. Akram Khan - Fredericksburg, Stafford (1. öncelik)\n' +
      '2. Giyaseddin Dayi - Fredericksburg, Stafford (2. öncelik)\n' +
      '3. Kamran Ejaz - Fredericksburg (3. öncelik)\n' +
      '4. Jose Beltrain - Frederick (1. öncelik)\n' +
      '5. Victor Nunes - Bethesda, Rockville, Silver Spring, Gaithersburg (1. öncelik)\n\n' +
      '❌ Ersad kaldırıldı - DC çok geniş, sabah 1. öncelik yeterli\n\n' +
      'Devam?'
    )) {
      return;
    }

    setIsUpdatingRegionPriorities(true);
    try {
      const response = await base44.functions.invoke('updateDriverRegionPriorities', {});
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\n📊 Başarılı: ${response.data.successCount}\n❌ Başarısız: ${response.data.failCount}`);
        
        if (response.data.results) {
          console.log('📋 DETAYLI SONUÇLAR:', response.data.results);
        }
        
        loadDrivers();
      } else {
        alert(`❌ Hata: ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Güncelleme hatası: ${error.message}`);
      console.error('Region priorities update hatası:', error);
    }
    setIsUpdatingRegionPriorities(false);
  };

  const daysOfWeek = [
    { en: 'Monday', tr: 'Pazartesi', emoji: '📅' },
    { en: 'Tuesday', tr: 'Salı', emoji: '📅' },
    { en: 'Wednesday', tr: 'Çarşamba', emoji: '📅' },
    { en: 'Thursday', tr: 'Perşembe', emoji: '📅' },
    { en: 'Friday', tr: 'Cuma', emoji: '📅' },
    { en: 'Saturday', tr: 'Cumartesi', emoji: '📅' },
    { en: 'Sunday', tr: 'Pazar', emoji: '📅' }
  ];

  const filteredDrivers = selectedDay === 'all' 
    ? drivers 
    : drivers.filter(driver => {
        const workingDays = driver.assignment_preferences?.working_days || [];
        return workingDays.includes(selectedDay);
      });

  const activeDrivers = filteredDrivers.filter(d => d.status === 'Aktif').length;

  const anyActionInProgress = isUpdatingEarlyMorning || isImporting || isUpdating || isUpdatingStatuses || isDeleting || isImportingChains || isImportingNewDrivers || isExtractingAreas || isParsingRules || isRestoring || isAnalyzing || isTestingRegionPriorities || isUpdatingRegionPriorities;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Sürücü Yönetimi
            </h1>
            <p className="text-slate-600 text-lg">
              {drivers.length} sürücünün detaylı performans verileri ile yönetim.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleDeleteAll}
            disabled={anyActionInProgress}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <User className="w-4 h-4 mr-2" />
                Tümünü Sil
              </>
            )}
          </Button>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
              Güne Göre Filtrele
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedDay === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedDay('all')}
                className={selectedDay === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                🗓️ Tümü ({drivers.length})
              </Button>
              {daysOfWeek.map(day => {
                const dayDriverCount = drivers.filter(d => {
                  const workingDays = d.assignment_preferences?.working_days || [];
                  return workingDays.includes(day.en);
                }).length;

                const earlyMorningCount = drivers.filter(d => {
                  const workingDays = d.assignment_preferences?.working_days || [];
                  return workingDays.includes(day.en) && d.early_morning_eligible === true;
                }).length;

                return (
                  <Button
                    key={day.en}
                    variant={selectedDay === day.en ? 'default' : 'outline'}
                    onClick={() => setSelectedDay(day.en)}
                    className={selectedDay === day.en ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                  >
                    {day.emoji} {day.tr} ({dayDriverCount})
                    {earlyMorningCount > 0 && (
                      <span className="ml-1 text-xs opacity-75">
                        🌅 {earlyMorningCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
            {selectedDay !== 'all' && (
              <p className="text-sm text-slate-600 mt-3">
                📊 {daysOfWeek.find(d => d.en === selectedDay)?.tr} günü çalışan {filteredDrivers.length} sürücü gösteriliyor
                {filteredDrivers.filter(d => d.early_morning_eligible).length > 0 && (
                  <span className="ml-2 text-orange-600 font-medium">
                    (🌅 {filteredDrivers.filter(d => d.early_morning_eligible).length} erken sabah)
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {selectedDay === 'all' ? 'Toplam Aktif Sürücü' : 'Bu Gün Aktif Sürücü'}
              </CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{activeDrivers}</div>
              {selectedDay !== 'all' && (
                <p className="text-xs text-slate-500 mt-1">
                  Toplam {filteredDrivers.length} sürücü
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <DriverList drivers={filteredDrivers} onRefresh={loadDrivers} isLoading={isLoading} />

      </div>
    </div>
  );
}