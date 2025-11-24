import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. AI'ın yaptığı atamalar (atama_raporu_2025-10-02-3.html)
        const aiAssignments = {
            "EzV9KQZX": { driver: "Victor Victor", pickup: "7101 Democracy Blvd, Bethesda", dropoff: "1313 Dolley Madison Blvd 101, McLean", pickup_time: "02:15 PM", dropoff_time: "3:00 PM" },
            "EzCAGWRR": { driver: "Victor Victor", pickup: "1716 International Dr, Tysons Corner", dropoff: "45448 E Severn Way. Ste 150, Sterling", pickup_time: "04:45 PM", dropoff_time: "5:45 PM" },
            "Ez61T073": { driver: "Fatih Yalcin", pickup: "8190 Strawberry Ln, Falls Church", dropoff: "510 14th St S, Arlington", pickup_time: "02:45 PM", dropoff_time: "3:30 PM" },
            "EzTGMCWQ": { driver: "Onur Uzonur", pickup: "6419 Shiplett Blvd, Burke", dropoff: "2450 Crystal Dr 200, Arlington", pickup_time: "07:15 AM", dropoff_time: "8:15 AM" },
            "EzZA2MX8": { driver: "Onur Uzonur", pickup: "5920 Kingstowne Towne Ctr, Alexandria", dropoff: "2900 Fairview Park Dr, Falls Church", pickup_time: "09:45 AM", dropoff_time: "10:15 AM" },
            "EzK98JP1": { driver: "Onur Uzonur", pickup: "7698 Richmond Hwy, Alexandria", dropoff: "705 Edgewood St NE 110, Washington", pickup_time: "10:45 AM", dropoff_time: "11:45 AM" },
            "EzXZM3WX": { driver: "Baran Hanci", pickup: "1051 N Highland St, Arlington", dropoff: "1155 23rd St NW PH3, Washington", pickup_time: "07:15 PM", dropoff_time: "7:45 PM" },
            "EzJ0T2E1": { driver: "Jr Sergio Sorto", pickup: "4515 Wisconsin Ave NW, Washington", dropoff: "251 National Harbor Blvd 400A, Forest Heights", pickup_time: "10:00 AM", dropoff_time: "11:00 AM" },
            "EzP4ECCF": { driver: "Jr Sergio Sorto", pickup: "13958 Lee Jackson Memorial Hwy, Chantilly", dropoff: "14155 Newbrook Dr Suite 130, Chantilly", pickup_time: "11:30 AM", dropoff_time: "11:45 AM" },
            "EzHXYYWY": { driver: "Armi Armi", pickup: "16431 Governor Bridge Rd, Bowie", dropoff: "1 Hargrove Dr Fabrication, Lanham", pickup_time: "10:15 AM", dropoff_time: "11:00 AM" },
            "EzF686F9": { driver: "Serkan Beder", pickup: "1716 International Dr, Tysons Corner", dropoff: "9704 Medical Center Dr, Rockville", pickup_time: "10:15 AM", dropoff_time: "11:15 AM" },
            "RHUWZ5K7": { driver: "Serkan Beder", pickup: "4731 Elm St, Bethesda", dropoff: "6116 Executive Blvd 8th Floor, Rockville", pickup_time: "11:15 AM", dropoff_time: "11:45 AM" },
            "RHFC47U8": { driver: "Seyit Gumus", pickup: "4720 14th St NW, Washington", dropoff: "1201 Wilson Blvd (12th Floor), Arlington", pickup_time: "10:30 AM", dropoff_time: "11:15 AM" },
            "RHCRA3XQ": { driver: "Seyit Gumus", pickup: "1060 Brentwood Rd NE, Washington", dropoff: "1201 Wilson Blvd, Arlington", pickup_time: "11:00 AM", dropoff_time: "11:45 AM" },
            "EzYV6F79": { driver: "Seyit Gumus", pickup: "6110 Arlington Blvd, Seven Corners", dropoff: "131 Great Falls St Suite 200, Falls Church", pickup_time: "11:30 AM", dropoff_time: "12:00 PM" },
            "Ez05V270": { driver: "Murad Najafov", pickup: "8406 Old Keene Mill Rd, West Springfield", dropoff: "9314A Old Keene Mill Rd, Burke", pickup_time: "10:45 AM", dropoff_time: "11:15 AM" },
            "RH9JXVGW": { driver: "Murad Najafov", pickup: "9078 Baltimore Ave, College Park", dropoff: "1450 Research Blvd Ste 120, Rockville", pickup_time: "10:45 AM", dropoff_time: "11:30 AM" },
            "EzC90P2F": { driver: "Can Timur", pickup: "2910 District Ave, Fairfax", dropoff: "7700 Old Georgetown Rd 500, Bethesda", pickup_time: "10:45 AM", dropoff_time: "11:45 AM" },
            "EzT4RYY6": { driver: "Dequan Spencer", pickup: "14720 Baltimore Ave, Laurel", dropoff: "10480 Little Patuxent Pkwy Suite 800, Columbia", pickup_time: "10:45 AM", dropoff_time: "11:30 AM" },
            "Ez3MMEJU": { driver: "Shannil Muhammed", pickup: "2001 International Dr, McLean", dropoff: "1600 Tysons Blvd 1100, McLean", pickup_time: "10:45 AM", dropoff_time: "11:00 AM" },
            "EzT63X32": { driver: "Shannil Muhammed", pickup: "12100 Sunset Hills Rd, Reston", dropoff: "1850 Town Center Pkwy 459, Reston", pickup_time: "11:45 AM", dropoff_time: "12:00 PM" },
            "EzXKF832": { driver: "Shannil Muhammed", pickup: "1961 Chain Bridge Rd Mall, McLean", dropoff: "8100 Tysons Corner Center, McLean", pickup_time: "12:45 PM", dropoff_time: "1:00 PM" }
        };

        // 2. Manuel atamalar (dataReport_2025-10-02.html)
        const manualAssignments = {
            "EzJ58Z12": { driver: "Fagan Ismailov", pickup: "2200 Pennsylvania Ave NW, Washington", dropoff: "1100 G St NW 350, Washington", pickup_time: "AM", dropoff_time: "7:45 AM" },
            "EzJVKXK4": { driver: "Fagan Ismailov", pickup: "314 Carroll St NW, Washington", dropoff: "20 F St NW Suite 400, Washington", pickup_time: "AM", dropoff_time: "12:00 PM" },
            "EzJ4RXYA": { driver: "Fatih Yalcin", pickup: "1201 S Hayes St, Arlington", dropoff: "901 N Stuart St 300, Arlington", pickup_time: "AM", dropoff_time: "11:45 AM" },
            "Ez0X5U2G": { driver: "Fatih Yalcin", pickup: "6017 Wilson Blvd, Arlington", dropoff: "510 14th St S 03, Arlington", pickup_time: "AM", dropoff_time: "8:00 AM" },
            "EzU4H6XV": { driver: "Archimede Samoth", pickup: "380 Eastern Ave NE, Washington", dropoff: "1405 Brentwood Pkwy NE, Washington", pickup_time: "AM", dropoff_time: "10:30 AM" },
            "Ez33YW0T": { driver: "Archimede Samoth", pickup: "91 H St NW, Washington", dropoff: "2705 Martin Luther King Jr Ave SE, Washington", pickup_time: "AM", dropoff_time: "11:15 AM" },
            "EzJWJ334": { driver: "Jose Beltrain", pickup: "211 Shorebird St, Frederick", dropoff: "196 Thomas Johnson Dr Suite 120, Frederick", pickup_time: "AM", dropoff_time: "11:45 AM" },
            "Ez6CU7R9": { driver: "Marcus Nunes", pickup: "670 Quince Orchard Rd, Gaithersburg", dropoff: "3275 Bennett Creek Ave, Frederick", pickup_time: "AM", dropoff_time: "12:00 PM" },
            "Ez0YH5HG": { driver: "Akram Khan", pickup: "1779 Carl D Silver Pkwy, Fredericksburg", dropoff: "3501 Lafayette Blvd, Fredericksburg", pickup_time: "AM", dropoff_time: "11:45 AM" },
            "EzVTE3T5": { driver: "Ghiyasiddin Mansory", pickup: "253 Garrisonville Rd, Stafford", dropoff: "125 Woodstream Blvd Suite 205, Stafford", pickup_time: "AM", dropoff_time: "11:45 AM" },
            "EzFJZ4PM": { driver: "Sayed Haamid Tore", pickup: "4229 Merchant Plaza, Lake Ridge", dropoff: "3985 Prince William Pkwy 102, Woodbridge", pickup_time: "AM", dropoff_time: "11:45 AM" },
            "EzUF9ZHH": { driver: "Sertan Qwert", pickup: "360 W Broad St, Falls Church", dropoff: "601 N Vermont St, Arlington", pickup_time: "AM", dropoff_time: "12:30 PM" },
            "Ez6MW9WM": { driver: "Sertan Qwert", pickup: "8101 Tysons Corner Center, Tysons", dropoff: "1775 Tysons Blvd 18th, McLean", pickup_time: "AM", dropoff_time: "11:30 AM" },
            "EzTGMCWQ": { driver: "Onur Uzonur", pickup: "6419 Shiplett Blvd, Burke", dropoff: "2450 Crystal Dr 200, Arlington", pickup_time: "AM", dropoff_time: "8:15 AM" }
        };

        // 3. Aynı siparişleri bul ve karşılaştır
        const comparison = {
            sameDriver: [],
            differentDriver: [],
            onlyInAI: [],
            onlyInManual: []
        };

        const allOrderIds = new Set([...Object.keys(aiAssignments), ...Object.keys(manualAssignments)]);

        for (const orderId of allOrderIds) {
            const ai = aiAssignments[orderId];
            const manual = manualAssignments[orderId];

            if (ai && manual) {
                if (ai.driver === manual.driver) {
                    comparison.sameDriver.push({
                        orderId,
                        driver: ai.driver,
                        route: `${ai.pickup} → ${ai.dropoff}`
                    });
                } else {
                    comparison.differentDriver.push({
                        orderId,
                        aiDriver: ai.driver,
                        manualDriver: manual.driver,
                        aiRoute: `${ai.pickup} → ${ai.dropoff}`,
                        manualRoute: `${manual.pickup} → ${manual.dropoff}`,
                        aiTime: `${ai.pickup_time} → ${ai.dropoff_time}`,
                        manualTime: `${manual.pickup_time} → ${manual.dropoff_time}`
                    });
                }
            } else if (ai && !manual) {
                comparison.onlyInAI.push({
                    orderId,
                    driver: ai.driver,
                    route: `${ai.pickup} → ${ai.dropoff}`
                });
            } else if (!ai && manual) {
                comparison.onlyInManual.push({
                    orderId,
                    driver: manual.driver,
                    route: `${manual.pickup} → ${manual.dropoff}`
                });
            }
        }

        return Response.json({
            success: true,
            comparison,
            summary: {
                totalAI: Object.keys(aiAssignments).length,
                totalManual: Object.keys(manualAssignments).length,
                sameDriverCount: comparison.sameDriver.length,
                differentDriverCount: comparison.differentDriver.length,
                onlyInAICount: comparison.onlyInAI.length,
                onlyInManualCount: comparison.onlyInManual.length,
                accuracyRate: ((comparison.sameDriver.length / Math.max(Object.keys(aiAssignments).length, Object.keys(manualAssignments).length)) * 100).toFixed(1) + "%"
            }
        });

    } catch (error) {
        console.error("Karşılaştırma hatası:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});