import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import { Driver } from '@/entities/Driver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Star, Phone, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom golden star icon for Top Dashers
const topDasherIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjRkZCRjAwIiBzdHJva2U9IiNGRjk4MDAiIHN0cm9rZS13aWR0aD0iMSI+PHBhdGggZD0iTTEyIDJsMTAgNy02LjUgNSA3LjUgN2wtMTAtMy0xMCAzIDcuNS03LTUuNS01IDEwLTd6Ii8+PC9zdmc+',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// 🆕 Ultra Gelişmiş geocoding - birden fazla format dener
const geocodeAddress = async (address, driverName = '') => {
  if (!address) return null;
  
  // 🔥 EREN EREN - ÖZEL KOORDİNAT
  if (/eren.*eren/i.test(driverName)) {
    console.log(`  ⭐ Eren Eren için özel koordinat kullanılıyor`);
    return {
      lat: 38.91739,
      lng: -77.09717,
      displayName: 'Eren Eren - Özel Konum'
    };
  }
  
  const cleanAddress = address
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/Apt\.?/gi, '')
    .replace(/Apartment/gi, '')
    .replace(/Unit/gi, '')
    .replace(/\#\d+/g, '')
    .trim();
  
  // 🔥 614 GIRARD STREET - DİREKT KOORDİNAT VER!
  if (/614.*girard/i.test(cleanAddress)) {
    console.log(`  ⭐ 614 Girard Street algılandı - Direkt koordinat veriliyor`);
    return {
      lat: 38.9272,
      lng: -76.9926,
      displayName: '614 Girard Street NE, Washington, DC 20017'
    };
  }
  
  let fixedAddress = cleanAddress
    .replace(/alexsandria/gi, 'Alexandria')
    .replace(/silver spring/gi, 'Silver Spring')
    .replace(/manassas/gi, 'Manassas')
    .replace(/sterling/gi, 'Sterling')
    .replace(/\bdenley\b/gi, 'Denley')
    .replace(/girard st/gi, 'Girard Street NE');
  
  const zipMatch = fixedAddress.match(/\b(\d{5})\b/);
  let zipCode = zipMatch ? zipMatch[1] : null;
  
  if (!zipCode && /silver spring/i.test(fixedAddress)) {
    zipCode = '20910';
  }
  
  const stateMatch = fixedAddress.match(/\b(VA|MD|DC|WV)\b/);
  const state = stateMatch ? stateMatch[1] : null;
  
  const cityMatch = fixedAddress.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[,\s]+(VA|MD|DC|WV)/i);
  const city = cityMatch ? cityMatch[1] : null;
  
  // 🔥 ÖZEL DURUMLAR
  const victorMatch = fixedAddress.match(/Denley\s+rd\s+silver\s+spring\s+MD\s+(\d+)/i);
  if (victorMatch) {
    const houseNumber = victorMatch[1];
    fixedAddress = `${houseNumber} Denley Rd, Silver Spring, MD ${zipCode || '20910'}`;
    console.log(`  🔧 Victor'un adresi düzeltildi: ${fixedAddress}`);
  }
  
  const enisMatch = fixedAddress.match(/(\d+)\s+Juniper\s+Wood\s+Terr/i);
  if (enisMatch) {
    const houseNumber = enisMatch[1];
    fixedAddress = `${houseNumber} Juniper Wood Terrace, Sterling, VA ${zipCode || '20166'}`;
    console.log(`  🔧 Enis'in adresi düzeltildi: ${fixedAddress}`);
  }
  
  const calebMatch = fixedAddress.match(/(\d+)\s+bucknell\s+drive/i);
  if (calebMatch) {
    const houseNumber = calebMatch[1];
    fixedAddress = `${houseNumber} Bucknell Drive, Silver Spring, MD ${zipCode || '20902'}`;
    console.log(`  🔧 Caleb'in adresi düzeltildi: ${fixedAddress}`);
  }
  
  const formats = [
    fixedAddress,
    fixedAddress + ', USA',
    fixedAddress.replace(/\bUnited States\b/gi, 'USA'),
    zipCode ? `${zipCode}, USA` : null,
    city && state ? `${city}, ${state}, USA` : null,
    fixedAddress.split(',').slice(0, 3).join(',') + ', USA',
    fixedAddress.replace(/\b(VA|MD|DC)\b/g, (match) => {
      const stateMap = { 'VA': 'Virginia', 'MD': 'Maryland', 'DC': 'Washington DC' };
      return stateMap[match] || match;
    }),
    fixedAddress
      .replace(/\bTerr\b/gi, 'Terrace')
      .replace(/\bBlvd\b/gi, 'Boulevard')
      .replace(/\bDr\b/gi, 'Drive')
      .replace(/\bSt\b/gi, 'Street')
      .replace(/\bAve\b/gi, 'Avenue')
      .replace(/\bRd\b/gi, 'Road')
      .replace(/\bLn\b/gi, 'Lane') + ', USA',
    fixedAddress.split(',')[0] + (city && state ? `, ${city}, ${state}, USA` : ', USA'),
    state ? fixedAddress.split(',')[0] + `, ${state}, USA` : null,
    zipCode ? fixedAddress.split(',')[0] + `, ${zipCode}, USA` : null,
    city ? fixedAddress.split(',')[0] + `, ${city}, USA` : null,
    zipCode && state ? `${zipCode}, ${state}, USA` : null
  ].filter(Boolean);
  
  for (const format of formats) {
    try {
      let retries = 2;
      let response = null;
      
      while (retries > 0) {
        try {
          response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(format)}&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'TopDasherMap/1.0' } }
          );
          
          if (response.ok) break;
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (fetchError) {
          retries--;
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!response || !response.ok) continue;
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        
        const isInRegion = (
          lat >= 37.5 && lat <= 39.5 &&
          lng >= -78.5 && lng <= -76.0
        );
        
        if (!isInRegion) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
        
        return {
          lat: lat,
          lng: lng,
          displayName: data[0].display_name
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return null;
};

export default function TopDasherMap() {
  const [topDashers, setTopDashers] = useState([]);
  const [mappedDrivers, setMappedDrivers] = useState([]);
  const [failedDrivers, setFailedDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    loadTopDashers();
  }, []);

  const loadTopDashers = async () => {
    setIsLoading(true);
    try {
      const allDrivers = await Driver.list();
      const topDashersList = allDrivers.filter(d => d.is_top_dasher && d.address);
      
      console.log(`📍 ${topDashersList.length} Top Dasher bulundu`);
      setTopDashers(topDashersList);
      
      const geocodedDrivers = [];
      const needsGeocoding = [];
      const coordinateCount = new Map();
      
      // 🔥 1. ADIM: KAYITLI KOORDİNATLARI HEMEN TOPLA
      for (const driver of topDashersList) {
        if (driver.home_coordinates && driver.home_coordinates.lat && driver.home_coordinates.lng) {
          const coordKey = `${driver.home_coordinates.lat.toFixed(5)},${driver.home_coordinates.lng.toFixed(5)}`;
          const count = coordinateCount.get(coordKey) || 0;
          coordinateCount.set(coordKey, count + 1);
          
          const offset = count * 0.0005;
          geocodedDrivers.push({
            ...driver,
            coordinates: {
              lat: driver.home_coordinates.lat + offset,
              lng: driver.home_coordinates.lng + (offset * 0.5)
            }
          });
        } else {
          needsGeocoding.push(driver);
        }
      }
      
      console.log(`✅ ${geocodedDrivers.length} sürücü zaten koordinatlı`);
      console.log(`🔍 ${needsGeocoding.length} sürücü geocoding bekliyor`);
      
      // 🔥 2. ADIM: KAYITLI OLANLARI HEMEN GÖSTER
      if (geocodedDrivers.length > 0) {
        setMappedDrivers(geocodedDrivers);
        setIsLoading(false);
      }
      
      // 🔥 3. ADIM: EKSİK OLANLARI ARKA PLANDA GEOCODE ET
      if (needsGeocoding.length > 0) {
        const failed = [];
        
        for (let i = 0; i < needsGeocoding.length; i++) {
          const driver = needsGeocoding[i];
          console.log(`\n🔍 [${i+1}/${needsGeocoding.length}] ${driver.name}`);
          
          const coords = await geocodeAddress(driver.address, driver.name);
          
          if (coords) {
            const coordKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
            const count = coordinateCount.get(coordKey) || 0;
            coordinateCount.set(coordKey, count + 1);
            
            const offset = count * 0.0005;
            const adjustedCoords = {
              lat: coords.lat + offset,
              lng: coords.lng + (offset * 0.5)
            };
            
            const newDriver = {
              ...driver,
              coordinates: adjustedCoords
            };
            
            geocodedDrivers.push(newDriver);
            setMappedDrivers([...geocodedDrivers]);
            
            try {
              await Driver.update(driver.id, {
                home_coordinates: adjustedCoords
              });
              console.log(`   💾 Koordinat kaydedildi`);
            } catch (error) {
              console.error(`   ⚠️ Koordinat kaydetme hatası:`, error.message);
            }
            
          } else {
            failed.push(driver);
            console.log(`   ❌ Koordinat bulunamadı`);
          }
          
          setGeocodingProgress(Math.round(((i + 1) / needsGeocoding.length) * 100));
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        setFailedDrivers(failed);
        console.log(`\n📊 SONUÇ: ✅ ${geocodedDrivers.length} | ❌ ${failed.length}`);
      } else {
        setFailedDrivers([]);
      }
      
    } catch (error) {
      console.error('Harita yükleme hatası:', error);
      alert(`❌ Hata: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    if (failedDrivers.length === 0) {
      alert('Başarısız sürücü yok!');
      return;
    }

    if (!window.confirm(`${failedDrivers.length} sürücü için tekrar geocoding denemek istiyor musunuz?`)) {
      return;
    }

    setIsRetrying(true);
    const newlyMapped = [];
    const stillFailed = [];
    const coordinateCount = new Map();
    
    mappedDrivers.forEach(d => {
      if (d.coordinates && d.coordinates.lat && d.coordinates.lng) {
        const coordKey = `${d.coordinates.lat.toFixed(5)},${d.coordinates.lng.toFixed(5)}`;
        coordinateCount.set(coordKey, (coordinateCount.get(coordKey) || 0) + 1);
      }
    });

    for (let i = 0; i < failedDrivers.length; i++) {
      const driver = failedDrivers[i];
      console.log(`\n🔄 Tekrar [${i+1}/${failedDrivers.length}] ${driver.name}`);
      
      const coords = await geocodeAddress(driver.address, driver.name);
      
      if (coords) {
        const coordKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
        const count = coordinateCount.get(coordKey) || 0;
        coordinateCount.set(coordKey, count + 1);
        
        const offset = count * 0.0005;
        const adjustedCoords = {
          lat: coords.lat + offset,
          lng: coords.lng + (offset * 0.5)
        };
        
        newlyMapped.push({
          ...driver,
          coordinates: adjustedCoords
        });
        
        try {
          await Driver.update(driver.id, {
            home_coordinates: adjustedCoords
          });
          console.log(`   ✅ Başarılı! Koordinat kaydedildi`);
        } catch (error) {
          console.error(`   ⚠️ Kaydetme hatası:`, error.message);
        }
      } else {
        stillFailed.push(driver);
        console.log(`   ❌ Yine başarısız`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setMappedDrivers(prev => [...prev, ...newlyMapped]);
    setFailedDrivers(stillFailed);
    setIsRetrying(false);

    alert(`✅ ${newlyMapped.length} yeni sürücü haritaya eklendi!\n❌ ${stillFailed.length} hala başarısız`);
  };

  const defaultCenter = [38.9072, -77.0369];
  const defaultZoom = 10;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <MapPin className="w-8 h-8 text-yellow-500" />
              Top Dasher Haritası
            </h1>
            <p className="text-slate-600">
              {topDashers.length} Top Dasher sürücünün konumları
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg px-4 py-2">
              <Star className="w-5 h-5 mr-2" />
              {mappedDrivers.length} / {topDashers.length} Haritada
            </Badge>
            
            {failedDrivers.length > 0 && (
              <Button
                onClick={handleRetryFailed}
                disabled={isRetrying}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deneniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atanamayanları Tekrar Dene ({failedDrivers.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {isLoading && mappedDrivers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-yellow-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">
                İlk kez koordinatlar yükleniyor...
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {geocodingProgress}% tamamlandı
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-4">
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${geocodingProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {mappedDrivers.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-yellow-600" />
                Sürücü Konumları
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div style={{ height: '600px', width: '100%' }}>
                <MapContainer
                  center={defaultCenter}
                  zoom={defaultZoom}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {mappedDrivers.map((driver) => (
                    <Marker
                      key={driver.id}
                      position={[driver.coordinates.lat, driver.coordinates.lng]}
                      icon={topDasherIcon}
                    >
                      <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                        <div className="text-center">
                          <div className="font-bold text-yellow-700 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500" />
                            {driver.name}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {driver.phone}
                          </div>
                        </div>
                      </Tooltip>
                      <Popup>
                        <div className="p-2">
                          <div className="font-bold text-lg text-yellow-700 flex items-center gap-2 mb-2">
                            <Star className="w-4 h-4 fill-yellow-500" />
                            {driver.name}
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              <span>{driver.phone}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3 h-3 mt-0.5" />
                              <span className="text-xs">{driver.address}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Max: {driver.assignment_preferences?.max_orders_per_day || 5} sipariş/gün
                            </Badge>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && mappedDrivers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg text-slate-600">
                Haritaya eklenebilecek Top Dasher bulunamadı
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Top Dasher Listesi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topDashers.map((driver) => {
                  const onMap = mappedDrivers.some(d => d.id === driver.id);
                  return (
                    <div 
                      key={driver.id}
                      className={`p-3 rounded-lg border ${
                        onMap 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{driver.name}</span>
                        <Badge 
                          variant="outline" 
                          className={onMap ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                        >
                          {onMap ? '✓ Haritada' : '⚠ Koordinat Yok'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{driver.address}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}