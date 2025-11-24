import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Brain, TrendingUp, AlertCircle, Save, BarChart3, Target, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LearningInsightsPage() {
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parameters, setParameters] = useState({
    distance_weight: 400,
    region_weight: 60,
    zip_weight: 0,
    state_weight: 0,
    chain_weight: 0,
    time_gap_weight: 150,
    early_morning_weight: 50
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('analyzeLearningInsights');
      
      if (response.data.success) {
        setInsights(response.data);
        
        // Önerilen parametreleri yükle
        if (response.data.recommended_parameters) {
          setParameters(response.data.recommended_parameters);
        }
      }
    } catch (error) {
      console.error('İçgörüler yüklenemedi:', error);
    }
    setIsLoading(false);
  };

  const handleSaveParameters = async () => {
    setIsSaving(true);
    try {
      // Parametreleri localStorage'a kaydet (veya database'e)
      localStorage.setItem('assignment_parameters', JSON.stringify(parameters));
      alert('✅ Parametreler kaydedildi! Artık yeni atamalar bu skorları kullanacak.');
    } catch (error) {
      alert('❌ Hata: ' + error.message);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Brain className="w-8 h-8 animate-pulse text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Öğrenme İçgörüleri & Parametre Optimizasyonu
          </h1>
          <p className="text-slate-600">
            Gerçek atamalardan öğrenilen pattern'ler ve algoritma iyileştirme önerileri
          </p>
        </div>

        {insights && (
          <>
            {/* İstatistikler */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Analiz Edilen Atama</p>
                      <p className="text-3xl font-bold text-slate-900">{insights.total_assignments}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Güncellenen Sürücü</p>
                      <p className="text-3xl font-bold text-slate-900">{insights.updated_drivers}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Keşfedilen Pattern</p>
                      <p className="text-3xl font-bold text-slate-900">{insights.patterns_found}</p>
                    </div>
                    <Brain className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Accuracy Potansiyeli</p>
                      <p className="text-3xl font-bold text-slate-900">{insights.potential_accuracy}%</p>
                    </div>
                    <Target className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Keşfedilen Pattern'ler */}
            {insights.discovered_patterns && insights.discovered_patterns.length > 0 && (
              <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    Keşfedilen Pattern'ler
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.discovered_patterns.map((pattern, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="flex items-start gap-3">
                        <Badge className="bg-purple-100 text-purple-800">
                          {pattern.type}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{pattern.title}</p>
                          <p className="text-sm text-slate-700 mt-1">{pattern.description}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            📊 Örnek Sayısı: {pattern.sample_count} | Güven: {pattern.confidence}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Algoritma İyileştirme Önerileri */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-900">
                    <AlertCircle className="w-5 h-5" />
                    Algoritma İyileştirme Önerileri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-yellow-300">
                      <div className="flex items-start gap-3">
                        <Zap className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{rec.title}</p>
                          <p className="text-sm text-slate-700 mt-1">{rec.description}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">
                              Beklenen Etki: +{rec.expected_improvement}% accuracy
                            </Badge>
                            <Badge variant="outline">
                              Öncelik: {rec.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Parametre Ayarlama */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Atama Algoritması Parametreleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="grid grid-cols-2 gap-6">
                  {/* Mesafe Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        📏 Mesafe Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.distance_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.distance_weight]}
                      onValueChange={([v]) => setParameters({...parameters, distance_weight: v})}
                      min={100}
                      max={600}
                      step={50}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Sürücü ile pickup noktası arasındaki mesafe önemi
                    </p>
                  </div>

                  {/* Bölge Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        🗺️ Bölge Uzmanlığı Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.region_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.region_weight]}
                      onValueChange={([v]) => setParameters({...parameters, region_weight: v})}
                      min={0}
                      max={300}
                      step={20}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Sürücünün preferred_areas'ındaki şehir match bonus
                    </p>
                  </div>

                  {/* Zip Code Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        📮 Zip Code Match Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.zip_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.zip_weight]}
                      onValueChange={([v]) => setParameters({...parameters, zip_weight: v})}
                      min={0}
                      max={250}
                      step={25}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Sürücünün top_zip_codes'unda varsa bonus
                    </p>
                  </div>

                  {/* Eyalet Tercihi Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        🏛️ Eyalet Tercihi Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.state_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.state_weight]}
                      onValueChange={([v]) => setParameters({...parameters, state_weight: v})}
                      min={0}
                      max={200}
                      step={20}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Sürücünün region_distribution'ında yüksek %'li eyalet
                    </p>
                  </div>

                  {/* Zincir Pattern Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        🔗 Zincir Pattern Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.chain_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.chain_weight]}
                      onValueChange={([v]) => setParameters({...parameters, chain_weight: v})}
                      min={0}
                      max={200}
                      step={20}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Daha önce benzeri rota zinciri yaptıysa bonus
                    </p>
                  </div>

                  {/* Zaman Boşluğu Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        ⏱️ Zaman Boşluğu Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.time_gap_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.time_gap_weight]}
                      onValueChange={([v]) => setParameters({...parameters, time_gap_weight: v})}
                      min={0}
                      max={250}
                      step={25}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      İdeal zaman boşluğu (30-60dk) varsa bonus
                    </p>
                  </div>

                  {/* Erken Sabah Ağırlığı */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">
                        🌅 Erken Sabah Ağırlığı
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {parameters.early_morning_weight}
                      </span>
                    </div>
                    <Slider
                      value={[parameters.early_morning_weight]}
                      onValueChange={([v]) => setParameters({...parameters, early_morning_weight: v})}
                      min={0}
                      max={150}
                      step={10}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Erken sabah güvenilir sürücülere bonus
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                  <Button variant="outline" onClick={loadInsights}>
                    🔄 Yenile
                  </Button>
                  <Button onClick={handleSaveParameters} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Kaydediliyor...' : 'Parametreleri Kaydet'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sürücü Bazlı İstatistikler */}
            {insights.driver_stats && insights.driver_stats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sürücü Bazlı Öğrenme İstatistikleri</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.driver_stats.slice(0, 10).map((stat, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-slate-900">{stat.driver_name}</h4>
                          <Badge className="bg-blue-100 text-blue-800">
                            {stat.total_learned_assignments} atama
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-slate-600">Top Bölgeler:</p>
                            <p className="font-medium">{stat.top_regions.slice(0, 2).join(', ')}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Zip Sayısı:</p>
                            <p className="font-medium">{stat.unique_zips}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Zincir Sayısı:</p>
                            <p className="font-medium">{stat.chain_count}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Accuracy Katkısı:</p>
                            <p className="font-medium">+{stat.accuracy_contribution}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}