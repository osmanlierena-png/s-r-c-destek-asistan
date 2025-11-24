
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Phone,
  User,
  Search,
  MapPin,
  Calendar,
  TrendingUp,
  Award,
  Sunrise,
  Star
} from "lucide-react";
import { Driver } from "@/entities/Driver";
import DriverForm from "./DriverForm";

const translateDay = (day) => {
  const dayMap = {
    'Monday': 'Pzt',
    'Tuesday': 'Sal',
    'Wednesday': 'Çar',
    'Thursday': 'Per',
    'Friday': 'Cum',
    'Saturday': 'Cmt',
    'Sunday': 'Paz'
  };
  return dayMap[day] || day;
};

export default function DriverList({ drivers, onRefresh, isLoading }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingEarlyMorning, setUpdatingEarlyMorning] = useState({});
  const [updatingTopDasher, setUpdatingTopDasher] = useState({});
  const [filterTopDasher, setFilterTopDasher] = useState('all');
  const [updatingJoker, setUpdatingJoker] = useState({});
  const [updatingShift, setUpdatingShift] = useState({});

  // Güvenli filtreleme - drivers null/undefined olabilir
  const safeDrivers = drivers || [];
  
  const filteredDrivers = safeDrivers.filter(driver => {
    if (!driver) return false; // Null/undefined driver'ları atla
    
    const matchesSearch = (driver.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (driver.phone || '').includes(searchTerm);
    
    if (filterTopDasher === 'top_only') {
      return matchesSearch && driver.is_top_dasher === true;
    } else if (filterTopDasher === 'regular') {
      return matchesSearch && !driver.is_top_dasher;
    }
    
    return matchesSearch;
  });

  const handleEdit = (driver) => {
    setEditingDriver(driver);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingDriver(null);
    onRefresh();
  };

  const getStatusColor = (status) => {
    const colors = {
      'Aktif': 'bg-green-100 text-green-800 border-green-200',
      'Pasif': 'bg-gray-100 text-gray-800 border-gray-200',
      'İzinli': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getReliabilityBadge = (reliability) => {
    const badges = {
      1: { emoji: '⭐⭐⭐', text: 'Çok Güvenilir', color: 'bg-green-100 text-green-800 border-green-300' },
      2: { emoji: '⭐⭐', text: 'Yüksek Güven', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      3: { emoji: '⭐', text: 'Orta Güven', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      4: { emoji: '○', text: 'Düşük Güven', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      0: { emoji: '✗', text: 'Almaz', color: 'bg-slate-100 text-slate-600 border-slate-300' }
    };
    return badges[reliability] || badges[0];
  };

  const sortedDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  const toggleJokerDriver = async (driver, e) => {
    e.stopPropagation();
    
    setUpdatingJoker(prev => ({ ...prev, [driver.id]: true }));
    
    try {
      const newValue = !driver.is_joker_driver;
      await Driver.update(driver.id, { 
        is_joker_driver: newValue 
      });
      
      onRefresh();
    } catch (error) {
      console.error('Joker Driver güncellenirken hata:', error);
      alert('Güncelleme başarısız!');
    }
    
    setUpdatingJoker(prev => ({ ...prev, [driver.id]: false }));
  };

  const toggleEarlyMorning = async (driver, e) => {
    e.stopPropagation();
    
    setUpdatingEarlyMorning(prev => ({ ...prev, [driver.id]: true }));
    
    try {
      const newValue = !driver.early_morning_eligible;
      await Driver.update(driver.id, { 
        early_morning_eligible: newValue 
      });
      
      onRefresh();
    } catch (error) {
      console.error('Erken sabah güncellenirken hata:', error);
      alert('Güncelleme başarısız!');
    }
    
    setUpdatingEarlyMorning(prev => ({ ...prev, [driver.id]: false }));
  };

  const toggleTopDasher = async (driver, e) => {
    e.stopPropagation();
    
    setUpdatingTopDasher(prev => ({ ...prev, [driver.id]: true }));
    
    try {
      const newValue = !driver.is_top_dasher;
      await Driver.update(driver.id, { 
        is_top_dasher: newValue 
      });
      
      onRefresh();
    } catch (error) {
      console.error('Top Dasher güncellenirken hata:', error);
      alert('Güncelleme başarısız!');
    }
    
    setUpdatingTopDasher(prev => ({ ...prev, [driver.id]: false }));
  };

  const cycleShift = async (driver, e) => {
    e.stopPropagation();
    
    setUpdatingShift(prev => ({ ...prev, [driver.id]: true }));
    
    try {
      const currentShift = driver.preferred_shift || 'all_day';
      const shifts = ['all_day', 'morning', 'evening'];
      const currentIndex = shifts.indexOf(currentShift);
      const nextShift = shifts[(currentIndex + 1) % shifts.length];
      
      await Driver.update(driver.id, { 
        preferred_shift: nextShift 
      });
      
      onRefresh();
    } catch (error) {
      console.error('Vardiya güncellenirken hata:', error);
      alert('Güncelleme başarısız!');
    } finally {
      setUpdatingShift(prev => ({ ...prev, [driver.id]: false }));
    }
  };

  const getShiftDisplay = (shift) => {
    const displays = {
      'all_day': { emoji: '☀️🌙', text: 'Tüm Gün', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'morning': { emoji: '🌅', text: 'Sabahçı', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'evening': { emoji: '🌙', text: 'Akşamcı', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
    };
    return displays[shift] || displays['all_day'];
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Sürücüler ({filteredDrivers.length})
            </CardTitle>
            <Button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Yeni Sürücü
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Sürücü adı veya telefon ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filterTopDasher === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterTopDasher('all')}
                size="sm"
              >
                Tümü ({safeDrivers.length})
              </Button>
              <Button
                variant={filterTopDasher === 'top_only' ? 'default' : 'outline'}
                onClick={() => setFilterTopDasher('top_only')}
                size="sm"
                className={filterTopDasher === 'top_only' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
              >
                ⭐ Top Dasher ({safeDrivers.filter(d => d.is_top_dasher).length})
              </Button>
              <Button
                variant={filterTopDasher === 'regular' ? 'default' : 'outline'}
                onClick={() => setFilterTopDasher('regular')}
                size="sm"
              >
                Normal ({safeDrivers.filter(d => !d.is_top_dasher).length})
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrivers.map((driver) => {
                const workingDays = (driver.assignment_preferences?.working_days || [])
                  .map(day => translateDay(day))
                  .sort((a, b) => sortedDays.indexOf(a) - sortedDays.indexOf(b));
                
                const specialNotes = driver.special_notes || {};
                const reliabilityBadge = getReliabilityBadge(driver.early_morning_reliability || 0);
                const shiftDisplay = getShiftDisplay(driver.preferred_shift);

                return (
                  <Card 
                    key={driver.id} 
                    className={`border hover:shadow-xl hover:border-blue-400 transition-all duration-200 bg-white cursor-pointer group ${
                      driver.is_top_dasher ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white' : 'border-slate-200'
                    } ${driver.is_joker_driver ? 'ring-2 ring-purple-400' : ''}`}
                    onClick={() => handleEdit(driver)}
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                              {driver.name}
                            </h3>
                            {driver.is_top_dasher && (
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                                ⭐ Top
                              </Badge>
                            )}
                            {driver.is_joker_driver && (
                              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                🃏 Joker
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{driver.phone || 'Tel yok'}</span>
                          </div>
                          {driver.address && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" />
                              <span className="line-clamp-1">{driver.address}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge className={`${getStatusColor(driver.status)} border font-medium`}>
                            {driver.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {driver.language === 'en' ? '🇺🇸 EN' : '🇹🇷 TR'}
                          </Badge>
                          
                          <button
                            onClick={(e) => cycleShift(driver, e)}
                            disabled={updatingShift[driver.id]}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${shiftDisplay.color} hover:opacity-80 border`}
                            title="Vardiya tercihi (tıkla değiştir)"
                          >
                            {updatingShift[driver.id] ? '...' : `${shiftDisplay.emoji} ${shiftDisplay.text}`}
                          </button>

                          <button
                            onClick={(e) => toggleJokerDriver(driver, e)}
                            disabled={updatingJoker[driver.id]}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              driver.is_joker_driver 
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md border border-purple-300' 
                                : 'bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-700 border border-slate-300'
                            }`}
                            title={driver.is_joker_driver ? 'Joker Driver (zor siparişler alır)' : 'Joker Driver yap'}
                          >
                            🃏
                            {updatingJoker[driver.id] ? '...' : (driver.is_joker_driver ? 'Joker' : 'Joker Yap')}
                          </button>

                          <button
                            onClick={(e) => toggleTopDasher(driver, e)}
                            disabled={updatingTopDasher[driver.id]}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              driver.is_top_dasher 
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 shadow-md border border-yellow-300'
                                : 'bg-slate-100 text-slate-500 hover:bg-yellow-100 hover:text-yellow-700 border border-slate-300'
                            }`}
                            title={driver.is_top_dasher ? 'Top Dasher (kaldırmak için tıkla)' : 'Top Dasher yap'}
                          >
                            <Star className={`w-3 h-3 ${driver.is_top_dasher ? 'fill-white' : ''}`} />
                            {updatingTopDasher[driver.id] ? '...' : (driver.is_top_dasher ? 'Top' : 'Top Yap')}
                          </button>
                          
                          <button
                            onClick={(e) => toggleEarlyMorning(driver, e)}
                            disabled={updatingEarlyMorning[driver.id]}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all ${
                              driver.early_morning_eligible 
                                ? reliabilityBadge.color
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300'
                            }`}
                            title={driver.early_morning_eligible ? `Erken sipariş alır - ${reliabilityBadge.text}` : 'Erken sipariş almaz'}
                          >
                            <Sunrise className="w-3 h-3" />
                            {updatingEarlyMorning[driver.id] ? '...' : (
                              driver.early_morning_eligible ? reliabilityBadge.emoji : '✗'
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-200">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">Günlük Max</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-900">
                            {driver.assignment_preferences?.max_orders_per_day || 0}
                          </p>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-medium text-purple-700">Haftalık Ort</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-900">
                            {driver.assignment_preferences?.avg_orders_per_week || 0}
                          </p>
                        </div>
                      </div>

                      {(specialNotes.is_owner || specialNotes.is_friend || specialNotes.must_get_orders_when_working ||
                        specialNotes.avoid_dc || specialNotes.avoid_long_distance || specialNotes.priority_level > 0) && (
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <div className="flex flex-wrap gap-1.5">
                            {specialNotes.is_owner && (
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">
                                👑 Sahip
                              </Badge>
                            )}
                            {specialNotes.is_friend && (
                              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                🤝 Arkadaş
                              </Badge>
                            )}
                            {specialNotes.must_get_orders_when_working && (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                                ⚡ Kesin
                              </Badge>
                            )}
                            {specialNotes.avoid_dc && (
                              <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
                                🚫 DC Yok
                              </Badge>
                            )}
                            {specialNotes.avoid_long_distance && (
                              <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                                📏 Kısa Rota
                              </Badge>
                            )}
                            {specialNotes.priority_level > 0 && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
                                ⭐ Öncelik {specialNotes.priority_level}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-semibold text-slate-700">Çalışma Günleri</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sortedDays.map(day => (
                            <Badge
                              key={day}
                              variant={workingDays.includes(day) ? "default" : "outline"}
                              className={workingDays.includes(day)
                                ? "bg-green-100 text-green-800 border-green-300 font-medium"
                                : "bg-slate-50 text-slate-400 border-slate-200"
                              }
                            >
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {driver.preferred_areas && driver.preferred_areas.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-orange-600" />
                            <span className="text-xs font-semibold text-slate-700">Popüler Bölgeler</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {driver.preferred_areas.slice(0, 3).map(area => (
                              <Badge
                                key={area}
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                              >
                                {area}
                              </Badge>
                            ))}
                            {driver.preferred_areas.length > 3 && (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs">
                                +{driver.preferred_areas.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {driver.notes && (
                        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md border border-slate-100">
                          {driver.notes}
                        </p>
                      )}

                      <div className="mt-3 pt-3 border-t border-slate-200 text-center">
                        <span className="text-xs text-blue-600 font-medium group-hover:text-blue-700">
                          📝 Düzenlemek için tıklayın
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!isLoading && filteredDrivers.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {searchTerm ? 'Arama kriterine uygun sürücü bulunamadı.' : 'Henüz sürücü eklenmemiş.'}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <DriverForm
          driver={editingDriver}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
