import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, User, Plus, MapPin, Calendar, TrendingUp, Award, Phone, Link as LinkIcon } from "lucide-react";
import { Driver } from "@/entities/Driver";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const DAYS_TR_TO_EN = {
  'Pazartesi': 'Monday',
  'Salı': 'Tuesday',
  'Çarşamba': 'Wednesday',
  'Perşembe': 'Thursday',
  'Cuma': 'Friday',
  'Cumartesi': 'Saturday',
  'Pazar': 'Sunday'
};

const DAYS_EN_TO_TR = {
  'Monday': 'Pazartesi',
  'Tuesday': 'Salı',
  'Wednesday': 'Çarşamba',
  'Thursday': 'Perşembe',
  'Friday': 'Cuma',
  'Saturday': 'Cumartesi',
  'Sunday': 'Pazar'
};

const daysOfWeekTR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function DriverForm({ driver, onClose }) {
  const [isSaving, setIsSaving] = useState(false);
  const [newArea, setNewArea] = useState("");

  // 🔥 FIX: State'i doğru initialize et
  const [formData, setFormData] = useState(() => {
    if (driver) {
      return {
        name: driver.name || "",
        phone: driver.phone || "",
        address: driver.address || "",
        language: driver.language || "tr",
        status: driver.status || "Aktif",
        notes: driver.notes || "",
        preferred_areas: driver.preferred_areas || [],
        early_morning_eligible: driver.early_morning_eligible || false,
        // 🔥 Doğru field isimleri
        max_orders_per_day: driver.assignment_preferences?.max_orders_per_day || 5,
        avg_orders_per_week: driver.assignment_preferences?.avg_orders_per_week || 0,
        working_days: driver.assignment_preferences?.working_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        special_notes: {
          is_owner: driver.special_notes?.is_owner || false,
          is_friend: driver.special_notes?.is_friend || false,
          must_get_orders_when_working: driver.special_notes?.must_get_orders_when_working || false,
          avoid_dc: driver.special_notes?.avoid_dc || false,
          avoid_long_distance: driver.special_notes?.avoid_long_distance || false,
          priority_level: driver.special_notes?.priority_level || 0,
          custom_note: driver.special_notes?.custom_note || ""
        }
      };
    } else {
      return {
        name: "",
        phone: "",
        address: "",
        language: "tr",
        status: "Aktif",
        notes: "",
        preferred_areas: [],
        early_morning_eligible: false,
        max_orders_per_day: 5,
        avg_orders_per_week: 0,
        working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        special_notes: {
          is_owner: false,
          is_friend: false,
          must_get_orders_when_working: false,
          avoid_dc: false,
          avoid_long_distance: false,
          priority_level: 0,
          custom_note: ""
        }
      };
    }
  });

  const handleWorkingDaysChange = (dayTR) => {
    const dayEN = DAYS_TR_TO_EN[dayTR];
    const currentDays = formData.working_days || [];
    const newDays = currentDays.includes(dayEN)
      ? currentDays.filter(d => d !== dayEN)
      : [...currentDays, dayEN];
    
    setFormData(prev => ({
      ...prev,
      working_days: newDays
    }));
  };

  const addPreferredArea = () => {
    if (newArea.trim() && !formData.preferred_areas.includes(newArea.trim())) {
      setFormData(prev => ({
        ...prev,
        preferred_areas: [...prev.preferred_areas, newArea.trim()]
      }));
      setNewArea("");
    }
  };

  const removeArea = (areaToRemove) => {
    setFormData(prev => ({
      ...prev,
      preferred_areas: prev.preferred_areas.filter(area => area !== areaToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const driverData = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        language: formData.language,
        status: formData.status,
        notes: formData.notes,
        preferred_areas: formData.preferred_areas,
        early_morning_eligible: formData.early_morning_eligible,
        assignment_preferences: {
          // 🔥 Mevcut bölge analiz verilerini KORU
          ...(driver?.assignment_preferences || {}),
          // Form'dan gelen verileri ekle/güncelle
          max_orders_per_day: parseInt(formData.max_orders_per_day) || 5,
          avg_orders_per_week: parseInt(formData.avg_orders_per_week) || 0,
          working_days: formData.working_days
        },
        special_notes: {
          // 🔥 Mevcut bölge analiz verilerini KORU
          ...(driver?.special_notes || {}),
          // Form'dan gelen verileri ekle/güncelle
          is_owner: formData.special_notes.is_owner,
          is_friend: formData.special_notes.is_friend,
          must_get_orders_when_working: formData.special_notes.must_get_orders_when_working,
          avoid_dc: formData.special_notes.avoid_dc,
          avoid_long_distance: formData.special_notes.avoid_long_distance,
          priority_level: parseInt(formData.special_notes.priority_level) || 0,
          custom_note: formData.special_notes.custom_note
        }
      };

      if (driver) {
        await Driver.update(driver.id, driverData);
        alert('✅ Sürücü başarıyla güncellendi!');
      } else {
        await Driver.create(driverData);
        alert('✅ Sürücü başarıyla oluşturuldu!');
      }
      
      onClose();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      alert(`❌ Hata: ${error.message}`);
    }
    
    setIsSaving(false);
  };

  const selectedDaysTR = (formData.working_days || [])
    .map(dayEN => DAYS_EN_TO_TR[dayEN])
    .filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-4xl my-8 bg-white flex flex-col max-h-[90vh]">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="w-6 h-6" />
              {driver ? 'Sürücü Düzenle' : 'Yeni Sürücü Ekle'}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 flex-1 flex flex-col">
          <ScrollArea className="flex-1 -mr-4 pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Temel Bilgiler */}
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Temel Bilgiler
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Sürücü Adı *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Örn: Ahmet Yılmaz"
                      required
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefon Numarası *
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="Örn: +905551234567"
                      required
                      className="bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Dil
                    </label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) => setFormData({...formData, language: value})}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                        <SelectItem value="en">🇺🇸 English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Durum
                    </label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({...formData, status: value})}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktif">✅ Aktif</SelectItem>
                        <SelectItem value="Pasif">⛔ Pasif</SelectItem>
                        <SelectItem value="İzinli">🏖️ İzinli</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Ev/Başlangıç Adresi
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Örn: 123 Main St, Arlington, VA"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Tercih Edilen Bölgeler */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Tercih Edilen Bölgeler
                </h3>
                
                <div className="flex gap-2">
                  <Input
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="Bölge ekle (örn: Beşiktaş)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPreferredArea();
                      }
                    }}
                  />
                  <Button type="button" onClick={addPreferredArea} size="sm" className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.preferred_areas.map(area => (
                    <Badge
                      key={area}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-colors px-3 py-1"
                      onClick={() => removeArea(area)}
                    >
                      {area} <X className="w-3 h-3 ml-1.5 inline-block" />
                    </Badge>
                  ))}
                  {formData.preferred_areas.length === 0 && (
                    <span className="text-sm text-slate-500">Henüz bölge eklenmedi</span>
                  )}
                </div>
              </div>

              {/* Chain History Display */}
              {driver?.chain_history && driver.chain_history.length > 0 && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Rota Zinciri Geçmişi ({driver.chain_history.length} kayıt)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {driver.chain_history.slice(0, 10).map((chain, idx) => (
                        <div key={idx} className="bg-white rounded p-3 border border-purple-200">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-slate-600">{chain.date}</span>
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              {chain.stops} durak
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-700 mb-1">{chain.chain}</p>
                          <div className="flex flex-wrap gap-1">
                            {chain.regions?.map((region, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {region}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                      {driver.chain_history.length > 10 && (
                        <p className="text-xs text-slate-500 text-center pt-2">
                          ... ve {driver.chain_history.length - 10} kayıt daha
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Atama Tercihleri */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  Atama Tercihleri
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <label className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Günlük Maksimum Sipariş
                    </label>
                    <Input
                      type="number"
                      value={formData.max_orders_per_day}
                      onChange={(e) => setFormData({...formData, max_orders_per_day: e.target.value})}
                      placeholder="Örn: 5"
                      min="0"
                      className="bg-white"
                    />
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <label className="text-sm font-medium text-purple-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Haftalık Ort. Sipariş
                    </label>
                    <Input
                      type="number"
                      value={formData.avg_orders_per_week}
                      onChange={(e) => setFormData({...formData, avg_orders_per_week: e.target.value})}
                      placeholder="Örn: 20"
                      min="0"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <label className="text-sm font-medium text-green-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Çalışma Günleri
                  </label>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {daysOfWeekTR.map(dayTR => {
                      const isChecked = selectedDaysTR.includes(dayTR);
                      return (
                        <div
                          key={dayTR}
                          onClick={() => handleWorkingDaysChange(dayTR)}
                          className={`
                            flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all
                            ${isChecked 
                              ? 'bg-green-500 text-white border-2 border-green-600 shadow-md' 
                              : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-green-300'
                            }
                          `}
                        >
                          <span className="font-semibold text-sm">{dayTR.substring(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Özel Notlar */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-600" />
                  Özel Notlar ve Tercihler
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                    <label className="text-sm font-medium text-purple-900 mb-3 flex items-center gap-2 block">
                      <Award className="w-4 h-4" />
                      Öncelik Seviyesi (0-10)
                    </label>
                    <Input
                      type="number"
                      value={formData.special_notes.priority_level}
                      onChange={(e) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          priority_level: e.target.value
                        }
                      })}
                      min="0"
                      max="10"
                      className="w-24"
                    />
                    <p className="text-xs text-purple-600 mt-2">
                      10 = En yüksek öncelik, 0 = Normal
                    </p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Checkbox
                      checked={formData.special_notes.is_owner}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          is_owner: checked
                        }
                      })}
                      id="is_owner"
                    />
                    <label htmlFor="is_owner" className="text-sm font-medium cursor-pointer">
                      👑 Şirket Sahibi (Ben)
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <Checkbox
                      checked={formData.special_notes.is_friend}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          is_friend: checked
                        }
                      })}
                      id="is_friend"
                    />
                    <label htmlFor="is_friend" className="text-sm font-medium cursor-pointer">
                      🤝 Yakın Arkadaş
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <Checkbox
                      checked={formData.special_notes.must_get_orders_when_working}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          must_get_orders_when_working: checked
                        }
                      })}
                      id="must_get_orders"
                    />
                    <label htmlFor="must_get_orders" className="text-sm font-medium cursor-pointer">
                      ⚡ Çalıştığı Gün Kesin Sipariş
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Checkbox
                      checked={formData.special_notes.avoid_dc}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          avoid_dc: checked
                        }
                      })}
                      id="avoid_dc"
                    />
                    <label htmlFor="avoid_dc" className="text-sm font-medium cursor-pointer">
                      🚫 DC'ye Girmek İstemiyor
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <Checkbox
                      checked={formData.special_notes.avoid_long_distance}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          avoid_long_distance: checked
                        }
                      })}
                      id="avoid_long_distance"
                    />
                    <label htmlFor="avoid_long_distance" className="text-sm font-medium cursor-pointer">
                      📏 Uzun Mesafeden Kaçın
                    </label>
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Diğer Özel Notlar
                    </label>
                    <Textarea
                      value={formData.special_notes.custom_note}
                      onChange={(e) => setFormData({
                        ...formData,
                        special_notes: {
                          ...formData.special_notes,
                          custom_note: e.target.value
                        }
                      })}
                      placeholder="Örn: Cumartesi günleri daha erken başlamalı..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Genel Notlar */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-900">Notlar</h3>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Sürücü hakkında özel notlar..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </form>
          </ScrollArea>

          <div className="flex gap-3 pt-6 border-t mt-6 -mx-6 px-6 bg-white pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
            >
              {isSaving ? 'Kaydediliyor...' : (driver ? 'Güncelle' : 'Kaydet')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}