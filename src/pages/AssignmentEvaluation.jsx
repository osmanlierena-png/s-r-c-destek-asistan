import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Brain, AlertCircle, CheckCircle, TrendingUp, FileText, BookOpen, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";

export default function AssignmentEvaluationPage() {
  const [systemFile, setSystemFile] = useState(null);
  const [manualFile, setManualFile] = useState(null);
  const [realFile, setRealFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [learningResults, setLearningResults] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

  const handleFileUpload = async (file, type) => {
    if (type === 'system') {
      setSystemFile(file);
    } else if (type === 'manual') {
      setManualFile(file);
    } else {
      setRealFile(file);
    }
  };

  const handleCompare = async () => {
    if (!systemFile || !manualFile) {
      alert('Lütfen her iki dosyayı da yükleyin!');
      return;
    }

    setIsProcessing(true);
    setDebugLogs([]);

    try {
      const logs = ['🔄 Dosyalar yükleniyor...'];
      setDebugLogs([...logs]);
      
      const systemUploadResponse = await base44.integrations.Core.UploadFile({ file: systemFile });
      logs.push(`✅ Akıllı Atama dosyası yüklendi`);
      setDebugLogs([...logs]);
      
      const systemParseResponse = await base44.functions.invoke('parseAssignmentReport', {
        file_url: systemUploadResponse.file_url
      });
      
      logs.push(`✅ Sistem parse: ${systemParseResponse.data.assignments?.length || 0} atama`);
      setDebugLogs([...logs]);

      const manualUploadResponse = await base44.integrations.Core.UploadFile({ file: manualFile });
      logs.push(`✅ Manuel dosyası yüklendi`);
      setDebugLogs([...logs]);
      
      const manualParseResponse = await base44.functions.invoke('parseAssignmentReport', {
        file_url: manualUploadResponse.file_url
      });
      
      logs.push(`✅ Manuel parse: ${manualParseResponse.data.assignments?.length || 0} atama`);
      setDebugLogs([...logs]);

      if (!systemParseResponse.data.success || !manualParseResponse.data.success) {
        logs.push('❌ PARSE BAŞARISIZ!');
        setDebugLogs([...logs]);
        alert('Dosyalar parse edilemedi!');
        setIsProcessing(false);
        return;
      }

      logs.push('');
      logs.push('🔍 Detaylı analiz yapılıyor...');
      setDebugLogs([...logs]);
      
      const analysisResponse = await base44.functions.invoke('analyzeAssignmentDifferences', {
        ai_assignments: systemParseResponse.data.assignments,
        manual_assignments: manualParseResponse.data.assignments
      });

      if (analysisResponse.data.success) {
        setAnalysis(analysisResponse.data);
        logs.push(`✅ Analiz tamamlandı! Accuracy: ${analysisResponse.data.accuracy}%`);
        setDebugLogs([...logs]);
      } else {
        logs.push(`❌ Analiz hatası: ${analysisResponse.data.error}`);
        setDebugLogs([...logs]);
        alert('Analiz başarısız!');
      }

    } catch (error) {
      console.error('Karşılaştırma hatası:', error);
      setDebugLogs(prev => [...prev, '', `❌ HATA: ${error.message}`]);
      alert('Hata: ' + error.message);
    }

    setIsProcessing(false);
  };

  const handleLearnFromReal = async () => {
    if (!realFile) {
      alert('Lütfen gerçek atama dosyasını yükleyin!');
      return;
    }

    setIsLearning(true);
    setDebugLogs([]);

    try {
      const logs = ['🧠 GERÇEK ATAMALARDAN ÖĞRENME BAŞLIYOR...'];
      setDebugLogs([...logs]);
      
      logs.push('📤 Dosya yükleniyor...');
      setDebugLogs([...logs]);
      
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: realFile });
      
      logs.push(`✅ Yüklendi: ${realFile.name}`);
      setDebugLogs([...logs]);
      
      logs.push('🔍 Parse ediliyor...');
      setDebugLogs([...logs]);
      
      const parseResponse = await base44.functions.invoke('parseAssignmentReport', {
        file_url: uploadResponse.file_url
      });

      if (!parseResponse.data.success) {
        logs.push('❌ PARSE BAŞARISIZ!');
        setDebugLogs([...logs]);
        alert('Dosya parse edilemedi!');
        setIsLearning(false);
        return;
      }

      logs.push(`✅ ${parseResponse.data.assignments.length} atama parse edildi`);
      setDebugLogs([...logs]);
      
      logs.push('');
      logs.push('🧠 Derin öğrenme analizi yapılıyor...');
      setDebugLogs([...logs]);
      
      const learningResponse = await base44.functions.invoke('learnFromRealAssignments', {
        assignments: parseResponse.data.assignments
      });

      if (learningResponse.data.success) {
        setLearningResults(learningResponse.data);
        logs.push(`✅ Öğrenme tamamlandı!`);
        logs.push(`   ${learningResponse.data.updated_drivers} sürücü güncellendi`);
        logs.push(`   ${learningResponse.data.insights.length} insight keşfedildi`);
        setDebugLogs([...logs]);
        alert('✅ Sistem gerçek atamalardan öğrendi ve güncellendi!');
      } else {
        logs.push(`❌ Öğrenme hatası: ${learningResponse.data.error}`);
        setDebugLogs([...logs]);
        alert('Öğrenme başarısız!');
      }

    } catch (error) {
      console.error('Öğrenme hatası:', error);
      setDebugLogs(prev => [...prev, '', `❌ HATA: ${error.message}`]);
      alert('Hata: ' + error.message);
    }

    setIsLearning(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerçekten Akıllı Öğrenme ve Optimizasyon Sistemi</h1>
          <p className="text-slate-600">Gerçek atamalardan öğren, sistem parametrelerini optimize et</p>
        </div>

        <Tabs defaultValue="learn" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="learn">
              <Brain className="w-4 h-4 mr-2" />
              Gerçek Atamalardan Öğren
            </TabsTrigger>
            <TabsTrigger value="compare">
              <TrendingUp className="w-4 h-4 mr-2" />
              Karşılaştır & Değerlendir
            </TabsTrigger>
          </TabsList>

          {/* 1️⃣ GERÇEK ATAMALARDAN ÖĞRENME */}
          <TabsContent value="learn" className="space-y-6">
            
            {debugLogs.length > 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">🔍 İşlem Logları</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {debugLogs.join('\n')}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Gerçek Atama Dosyası Yükle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center bg-white">
                  <input
                    type="file"
                    id="real-file"
                    accept=".html,.csv,.txt"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'real')}
                    className="hidden"
                  />
                  <label htmlFor="real-file" className="cursor-pointer flex flex-col items-center gap-3">
                    <Upload className="w-12 h-12 text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        Gerçek Atama Raporunu Yükle
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        CSV veya HTML formatında - Sistem bu verilerden öğrenecek
                      </p>
                    </div>
                    {realFile && (
                      <Badge className="bg-purple-100 text-purple-800 mt-2">
                        ✓ {realFile.name}
                      </Badge>
                    )}
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Sistem Neler Öğrenecek?
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 🕒 Hangi sürücü hangi saatlerde çalışıyor</li>
                    <li>• 🗺️ Hangi bölgelere hangi sürücü gidiyor</li>
                    <li>• 📊 Sürücü başına ortalama sipariş sayısı</li>
                    <li>• 🔗 Zincir rota kalıpları (A→B→C)</li>
                    <li>• ⏱️ Sürücülerin çalışma hızı ve tercihleri</li>
                    <li>• 🎯 Hangi sürücü hangi tür siparişleri alıyor</li>
                  </ul>
                </div>

                <Button
                  onClick={handleLearnFromReal}
                  disabled={!realFile || isLearning}
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isLearning ? (
                    <>
                      <Brain className="w-5 h-5 mr-2 animate-pulse" />
                      Öğreniyor...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 mr-2" />
                      Analiz Et ve Sistemi Güncelle
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* ÖĞRENME SONUÇLARI */}
            {learningResults && (
              <>
                {/* İstatistikler */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">Toplam Sipariş</p>
                          <p className="text-3xl font-bold text-slate-900">{learningResults.total_orders}</p>
                        </div>
                        <FileText className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">Aktif Sürücü</p>
                          <p className="text-3xl font-bold text-slate-900">{learningResults.active_drivers}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">Güncellenen</p>
                          <p className="text-3xl font-bold text-slate-900">{learningResults.updated_drivers}</p>
                        </div>
                        <Database className="w-8 h-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">Insight</p>
                          <p className="text-3xl font-bold text-slate-900">{learningResults.insights.length}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Keşfedilen Pattern'ler */}
                {learningResults.insights.length > 0 && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-900">
                        <AlertCircle className="w-5 h-5" />
                        Keşfedilen Pattern'ler ve Öğrenmeler
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {learningResults.insights.map((insight, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border border-yellow-300">
                          <div className="flex items-start gap-3">
                            <Badge className="bg-yellow-100 text-yellow-800">
                              {insight.type}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">{insight.title}</p>
                              <p className="text-sm text-slate-700 mt-1">{insight.description}</p>
                              {insight.recommendation && (
                                <p className="text-xs text-green-700 mt-2 bg-green-50 p-2 rounded">
                                  💡 {insight.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Sürücü Güncellemeleri */}
                {learningResults.driver_updates && learningResults.driver_updates.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sürücü Profil Güncellemeleri</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {learningResults.driver_updates.map((update, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <h4 className="font-semibold text-slate-900 mb-2">{update.driver_name}</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-slate-600">Çalışma Saatleri:</span>
                                  <p className="font-medium">{update.working_hours.join(', ')}</p>
                                </div>
                                <div>
                                  <span className="text-slate-600">Tercih Bölgeleri:</span>
                                  <p className="font-medium">{update.preferred_regions.slice(0, 3).join(', ')}</p>
                                </div>
                                <div>
                                  <span className="text-slate-600">Ortalama Sipariş:</span>
                                  <p className="font-medium">{update.avg_orders_per_day} /gün</p>
                                </div>
                                <div>
                                  <span className="text-slate-600">Zincir Sayısı:</span>
                                  <p className="font-medium">{update.chain_count}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

          </TabsContent>

          {/* 2️⃣ KARŞILAŞTIRMA VE DEĞERLENDİRME */}
          <TabsContent value="compare" className="space-y-6">
            
            {debugLogs.length > 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">🔍 İşlem Logları</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {debugLogs.join('\n')}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    Akıllı Atama (Sistem)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="system-file"
                      accept=".html,.csv,.txt"
                      onChange={(e) => handleFileUpload(e.target.files[0], 'system')}
                      className="hidden"
                    />
                    <label htmlFor="system-file" className="cursor-pointer flex flex-col items-center gap-3">
                      <Upload className="w-12 h-12 text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Akıllı Atama Raporunu Yükle
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          CSV veya HTML formatında
                        </p>
                      </div>
                      {systemFile && (
                        <Badge className="bg-purple-100 text-purple-800 mt-2">
                          ✓ {systemFile.name}
                        </Badge>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Manuel Atamalar (Gerçek)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="manual-file"
                      accept=".html,.csv,.txt"
                      onChange={(e) => handleFileUpload(e.target.files[0], 'manual')}
                      className="hidden"
                    />
                    <label htmlFor="manual-file" className="cursor-pointer flex flex-col items-center gap-3">
                      <Upload className="w-12 h-12 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Manuel Atama Raporunu Yükle
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          CSV veya HTML formatında
                        </p>
                      </div>
                      {manualFile && (
                        <Badge className="bg-blue-100 text-blue-800 mt-2">
                          ✓ {manualFile.name}
                        </Badge>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleCompare}
                disabled={!systemFile || !manualFile || isProcessing}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isProcessing ? (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2 animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Detaylı Analiz Yap
                  </>
                )}
              </Button>
            </div>

            {/* Analiz sonuçları (mevcut kodun devamı) */}
            {analysis && (
              <>
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">📊 Sipariş Karşılaştırması</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{analysis.total_common_orders}</div>
                        <p className="text-sm text-slate-600">Ortak Sipariş</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">{analysis.only_in_system}</div>
                        <p className="text-sm text-slate-600">Sadece Sistemde</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{analysis.only_in_manual}</div>
                        <p className="text-sm text-slate-600">Sadece Manuel'de</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                  <CardContent className="p-8 text-center">
                    <div className="text-6xl font-bold text-purple-600 mb-2">
                      {analysis.accuracy}%
                    </div>
                    <p className="text-lg text-slate-700">Doğruluk Oranı (Ortak Siparişler)</p>
                    <div className="flex justify-center gap-6 mt-4">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{analysis.matches.length}</p>
                        <p className="text-sm text-slate-600">Eşleşme</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{analysis.differences.length}</p>
                        <p className="text-sm text-slate-600">Farklı Atama</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pattern ve öneriler */}
                {(analysis.patterns.distance_pattern || analysis.patterns.region_pattern || analysis.patterns.time_pattern) && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-900">
                        <AlertCircle className="w-5 h-5" />
                        Tespit Edilen Problemler ve Öğrenme Önerileri
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.patterns.distance_pattern && (
                        <div className="bg-white rounded-lg p-4 border border-yellow-300">
                          <p className="font-semibold text-slate-900 mb-2">
                            🎯 Mesafe Problemi
                          </p>
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.patterns.distance_pattern.issue}
                          </p>
                          <p className="text-xs text-slate-600 mb-1">
                            Ortalama ekstra mesafe: <span className="font-semibold">{analysis.patterns.distance_pattern.avg_extra_distance} mil</span>
                          </p>
                          <Badge className="bg-green-100 text-green-800 mt-2">
                            💡 {analysis.patterns.distance_pattern.recommendation}
                          </Badge>
                        </div>
                      )}
                      
                      {analysis.patterns.region_pattern && (
                        <div className="bg-white rounded-lg p-4 border border-yellow-300">
                          <p className="font-semibold text-slate-900 mb-2">
                            🗺️ Bölge Uzmanlığı Problemi
                          </p>
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.patterns.region_pattern.issue}
                          </p>
                          <p className="text-xs text-slate-600 mb-1">
                            Hata sayısı: <span className="font-semibold">{analysis.patterns.region_pattern.error_count}</span>
                          </p>
                          <Badge className="bg-green-100 text-green-800 mt-2">
                            💡 {analysis.patterns.region_pattern.recommendation}
                          </Badge>
                        </div>
                      )}
                      
                      {analysis.patterns.time_pattern && (
                        <div className="bg-white rounded-lg p-4 border border-yellow-300">
                          <p className="font-semibold text-slate-900 mb-2">
                            ⏰ Erken Sabah Güvenilirlik Problemi
                          </p>
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.patterns.time_pattern.issue}
                          </p>
                          <p className="text-xs text-slate-600 mb-1">
                            Hata sayısı: <span className="font-semibold">{analysis.patterns.time_pattern.error_count}</span>
                          </p>
                          <Badge className="bg-green-100 text-green-800 mt-2">
                            💡 {analysis.patterns.time_pattern.recommendation}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}