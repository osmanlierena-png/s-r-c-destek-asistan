import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface CanvasAssignment {
  orderId: string;
  orderNumber: string;
  driverName: string | null;
  groupId: string | null;
  price: number;
  groupPrice?: number;
}

interface UpdateRequest {
  date: string;
  assignments: CanvasAssignment[];
  triggerSMS?: boolean;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Kullanıcı kontrolü (isteğe bağlı - public endpoint ise kaldırabilirsiniz)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body: UpdateRequest = await req.json();
    const { assignments } = body;
    
    console.log(`[Canvas Import] ${assignments.length} atama alındı`);

    let updated = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        // Sürücüyü isimle bul
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
          driver_id: driverId,
          driver_name: assignment.driverName,
          driver_phone: driverPhone,
          status: assignment.driverName ? 'Atandı' : 'Çekildi',
          canvas_group_id: assignment.groupId,
          canvas_price: assignment.price
        });

        updated++;
      } catch (error) {
        failed++;
        console.error(`Hata: ${assignment.orderNumber}`, error);
      }
    }

    return Response.json({ 
      success: failed === 0, 
      message: `${updated} sipariş güncellendi`,
      updated, 
      failed 
    });
    
  } catch (error) {
    console.error('updateOrdersFromCanvas error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});