import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { date, assignments, triggerSMS = false } = await req.json();

        if (!date || !assignments || !Array.isArray(assignments)) {
            return Response.json({ 
                success: false,
                error: 'date ve assignments parametreleri gerekli' 
            }, { status: 400 });
        }

        console.log(`📦 ${assignments.length} atama işlenecek`);
        console.log(`📅 Tarih: ${date}, SMS: ${triggerSMS}`);

        const results = {
            updated: 0,
            failed: 0,
            errors: []
        };

        // Her atama için DailyOrder güncelle
        for (const assignment of assignments) {
            try {
                // Sürücü bilgisini al (driver_id için)
                let driverId = null;
                let driverPhone = null;

                if (assignment.driverName) {
                    const drivers = await base44.asServiceRole.entities.Driver.filter({
                        name: assignment.driverName
                    }, null, 1);

                    if (drivers.length > 0) {
                        driverId = drivers[0].id;
                        driverPhone = drivers[0].phone;
                    }
                }

                // Siparişi güncelle
                await base44.asServiceRole.entities.DailyOrder.update(assignment.orderId, {
                    driver_name: assignment.driverName,
                    driver_id: driverId,
                    driver_phone: driverPhone,
                    status: assignment.driverName ? 'Atandı' : 'Çekildi',
                    canvas_price: assignment.price,
                    canvas_group_id: assignment.groupId,
                    canvas_group_price: assignment.groupPrice || null,
                    canvas_updated_at: new Date().toISOString()
                });

                results.updated++;
                console.log(`✅ ${assignment.orderNumber} güncellendi`);

            } catch (err) {
                results.failed++;
                const errorMsg = `${assignment.orderNumber}: ${err.message || 'Bilinmeyen hata'}`;
                results.errors.push(errorMsg);
                console.error(`❌ ${errorMsg}`);
            }
        }

        // SMS tetikleme (opsiyonel)
        if (triggerSMS && results.updated > 0) {
            console.log('📤 SMS gönderimi tetiklenecek...');
            
            try {
                // Güncellenen siparişlerin ID'lerini al
                const orderIds = assignments
                    .filter(a => a.driverName) // Sadece atanmış olanlar
                    .map(a => a.orderId);
                
                if (orderIds.length > 0) {
                    // SMS gönder
                    await base44.functions.invoke('sendOrderAssignmentSMS', { orderIds });
                    console.log(`📨 ${orderIds.length} sipariş için SMS gönderildi`);
                }
            } catch (smsError) {
                console.error('SMS gönderme hatası:', smsError);
                results.errors.push(`SMS hatası: ${smsError.message}`);
            }
        }

        console.log(`\n📊 Özet: ${results.updated} güncellendi, ${results.failed} hata`);

        return Response.json({
            success: results.failed === 0,
            message: `${results.updated} sipariş güncellendi${results.failed > 0 ? `, ${results.failed} hata` : ''}`,
            updated: results.updated,
            failed: results.failed,
            errors: results.errors,
            smsTriggered: triggerSMS && results.updated > 0
        });

    } catch (error) {
        console.error('❌ Genel hata:', error);
        return Response.json({
            success: false,
            error: error.message || 'Bilinmeyen hata',
            updated: 0,
            failed: 0
        }, { status: 500 });
    }
});