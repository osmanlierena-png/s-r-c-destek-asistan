import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Top Dasher'ları çek
    const topDashers = await base44.asServiceRole.entities.Driver.filter({
      is_top_dasher: true
    });

    console.log(`📊 ${topDashers.length} Top Dasher bulundu`);

    // CSV formatında oluştur
    const headers = [
      'İsim',
      'Telefon',
      'Adres',
      'Durum',
      'Dil',
      'Tercih Edilen Vardiya',
      'Günlük Max Sipariş',
      'Çalışma Günleri',
      'Tercih Edilen Bölgeler',
      'Ana Bölge',
      'Top Zip Codes',
      'Erken Sabah Uzmanı',
      'Erken Sabah Güvenilirlik',
      'Atama Skoru',
      'Atama Önceliği',
      'Joker Sürücü',
      'DC\'den Kaçın',
      'Uzun Mesafeden Kaçın',
      'Notlar'
    ];

    const reliabilityMap = {
      0: 'Yok',
      1: 'Çok Güvenilir',
      2: 'Yüksek',
      3: 'Orta',
      4: 'Düşük'
    };

    const shiftMap = {
      'all_day': 'Tüm Gün',
      'morning': 'Sabah (07:00-14:00)',
      'evening': 'Akşam (14:00-21:00)'
    };

    const rows = topDashers.map(driver => [
      driver.name || '',
      driver.phone || '',
      driver.address || '',
      driver.status || '',
      driver.language?.toUpperCase() || 'TR',
      shiftMap[driver.preferred_shift] || driver.preferred_shift || 'Tüm Gün',
      driver.assignment_preferences?.max_orders_per_day || 5,
      driver.assignment_preferences?.working_days?.join(', ') || '',
      driver.preferred_areas?.join(', ') || '',
      driver.special_notes?.primary_region || '',
      driver.special_notes?.top_zip_codes?.join(', ') || '',
      driver.early_morning_specialist ? 'Evet' : 'Hayır',
      reliabilityMap[driver.early_morning_reliability] || 'Yok',
      driver.assignment_score || 0,
      driver.assignment_priority || 'None',
      driver.is_joker_driver ? 'Evet' : 'Hayır',
      driver.special_notes?.avoid_dc ? 'Evet' : 'Hayır',
      driver.special_notes?.avoid_long_distance ? 'Evet' : 'Hayır',
      (driver.notes || driver.special_notes?.custom_note || '').replace(/"/g, '""')
    ]);

    // CSV içeriği oluştur
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // UTF-8 BOM ekle (Excel için Türkçe karakter desteği)
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new Response(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=top-dashers-${new Date().toISOString().split('T')[0]}.csv`
      }
    });

  } catch (error) {
    console.error('❌ Top Dasher export hatası:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});