import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Günleri parse et
const parseWorkingDays = (daysStr) => {
    if (!daysStr || daysStr === 'NaN' || daysStr === '') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const days = daysStr.split(',').map(d => d.trim());
    return days.filter(d => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(d));
};

// Telefon format
const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
    return phone;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    
    try {
        const { file_url } = await req.json();
        
        if (!file_url) {
            return Response.json({ error: 'file_url gerekli!' }, { status: 400 });
        }
        
        console.log("📥 HTML indiriliyor:", file_url);
        const response = await fetch(file_url);
        const htmlContent = await response.text();
        
        console.log("✅ HTML indirildi, parse başlıyor...");
        
        // tr'leri bul (table row)
        const rows = htmlContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
        
        console.log(`📋 ${rows.length} satır bulundu`);
        
        const applications = [];
        
        // İlk satır header, skip et
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            
            while ((cellMatch = cellRegex.exec(row)) !== null) {
                let content = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(content);
            }
            
            if (cells.length < 10) continue;
            
            const [timestamp, email, name, address, workArea, phone, availableDays, ssn, hasCar, hasLicense] = cells;
            
            if (!name || name === 'NaN') continue;
            
            applications.push({
                timestamp,
                email,
                name,
                address,
                workArea: workArea || '',
                phone: formatPhone(phone),
                workingDays: parseWorkingDays(availableDays),
                ssn,
                hasCar: hasCar === 'Yes',
                hasLicense: hasLicense === 'Yes'
            });
        }
        
        console.log(`✅ ${applications.length} başvuru parse edildi`);
        
        // Hepsini YENİ sürücü olarak ekle
        let addedCount = 0;
        const errors = [];
        
        for (const app of applications) {
            try {
                await base44.entities.Driver.create({
                    name: app.name,
                    phone: app.phone,
                    address: app.address,
                    status: 'Aktif',
                    language: 'en',
                    is_top_dasher: true, // ⭐ Top Dasher olarak ekle
                    assignment_preferences: {
                        max_orders_per_day: 5,
                        avg_orders_per_week: 25,
                        working_days: app.workingDays
                    },
                    notes: `Başvuru: ${app.timestamp}\nEmail: ${app.email}\nÇalışma Alanı: ${app.workArea}\nEhliyet: ${app.hasLicense ? 'Var' : 'Yok'}\nAraç: ${app.hasCar ? 'Var' : 'Yok'}`
                });
                addedCount++;
                console.log(`✅ Eklendi: ${app.name}`);
            } catch (error) {
                console.error(`❌ ${app.name} eklenemedi:`, error.message);
                errors.push({ name: app.name, error: error.message });
            }
        }
        
        return Response.json({
            success: true,
            message: `${addedCount} yeni Top Dasher sürücü eklendi!`,
            summary: {
                totalApplications: applications.length,
                added: addedCount,
                failed: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error("Import hatası:", error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});