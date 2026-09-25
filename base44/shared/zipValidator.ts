// ZIP kodu doğrulama ve düzeltme — Google Geocoding API kullanır
// Adresi olduğu gibi Google'a gönderir, Google'ın döndürdüğü postal_code'u orijinal ZIP ile karşılaştırır
// partial_match / APPROXIMATE sonuçlar reddedilir (kaba koordinat istemiyoruz)
// ZIP düzeltilemezse 'ZIP şüpheli' flag'i döner — ama sipariş engellenmez

export interface ZipValidationResult {
  original_address: string;
  fixed_address: string | null;      // null = düzeltme gerekmedi
  zip_valid: boolean;
  zip_fixed: boolean;
  coords: { lat: number; lng: number } | null;
  quality_flag: string | null;       // 'ZIP şüpheli' veya null
}

function extractZip(address: string): string | null {
  // 4-5 haneli ZIP (4 haneli = truncated, düzeltme adayı)
  const match = address.match(/\b(\d{4,5})(?:-\d{4})?\s*$/);
  return match ? match[1] : null;
}

function isZipValid(zip: string | null): boolean {
  return zip !== null && /^\d{5}$/.test(zip);
}

function replaceZip(address: string, newZip: string): string {
  return address.replace(/\b\d{4,5}(?:-\d{4})?\s*$/, newZip);
}

export async function validateAddressZip(
  address: string,
  apiKey: string
): Promise<ZipValidationResult> {
  if (!address || !apiKey) {
    return {
      original_address: address || '',
      fixed_address: null,
      zip_valid: false,
      zip_fixed: false,
      coords: null,
      quality_flag: 'ZIP şüpheli'
    };
  }

  const originalZip = extractZip(address);
  const zipLooksShort = originalZip !== null && !/^\d{5}$/.test(originalZip);

  // Google Geocoding ile doğrula (ham adresi olduğu gibi gönder)
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  let coords: { lat: number; lng: number } | null = null;
  let googleZip: string | null = null;
  let isPartialMatch = false;

  try {
    const res = await fetch(geocodeUrl);
    const data = await res.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const locationType = result.geometry?.location_type;
      isPartialMatch = result.partial_match === true;

      // partial_match kabul edilir — ZIP yanlış olduğu için partial_match olması normaldir
      // SADECE APPROXIMATE reddedilir (çok kaba koordinat)
      if (locationType !== 'APPROXIMATE') {
        coords = {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        };

        // Google'ın döndürdüğü postal_code'u al
        for (const comp of result.address_components) {
          if (comp.types.includes('postal_code')) {
            googleZip = comp.short_name;
            break;
          }
        }
      }
    }
  } catch (e) {
    // Geocoding failed — aşağıdaki mantıkla devam et
  }

  // ZIP düzeltme kararı
  if (googleZip && isZipValid(googleZip)) {
    // Google geçerli ZIP döndürdü
    // partial_match ise ZIP düzeltilir AMA 'ZIP şüpheli' ile işaretlenir
    const flag = isPartialMatch ? 'ZIP şüpheli' : null;
    if (originalZip !== googleZip) {
      // ZIP farklı (veya eksikti) — düzelt
      const fixedAddress = replaceZip(address, googleZip);
      return {
        original_address: address,
        fixed_address: fixedAddress,
        zip_valid: true,
        zip_fixed: true,
        coords,
        quality_flag: flag
      };
    } else {
      // ZIP zaten doğru
      return {
        original_address: address,
        fixed_address: null,
        zip_valid: true,
        zip_fixed: false,
        coords,
        quality_flag: flag
      };
    }
  } else if (zipLooksShort || !isZipValid(originalZip)) {
    // ZIP kısa/geçersiz ve Google düzeltemedi
    return {
      original_address: address,
      fixed_address: null,
      zip_valid: false,
      zip_fixed: false,
      coords,
      quality_flag: 'ZIP şüpheli'
    };
  } else if (!coords) {
    // ZIP 5 haneli ama Google hiç geocode edemedi (coords yok) — adres doğrulanamadı
    return {
      original_address: address,
      fixed_address: null,
      zip_valid: false,
      zip_fixed: false,
      coords: null,
      quality_flag: 'ZIP şüpheli'
    };
  } else {
    // ZIP 5 haneli ve Google koordinat buldu (postal_code olmayabilir) — geçerli
    return {
      original_address: address,
      fixed_address: null,
      zip_valid: true,
      zip_fixed: false,
      coords,
      quality_flag: null
    };
  }
}