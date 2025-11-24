import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import puppeteer from 'npm:puppeteer@21.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req).asServiceRole;
    let browser;

    try {
        const { targetDate, orderSource = 'Ezcater' } = await req.json();
        const dateToScrap = targetDate || new Date().toISOString().split('T')[0];

        const browserbaseApiKey = Deno.env.get("BROWSERBASE_API_KEY");
        const savedCookies = Deno.env.get("HERE_APP_COOKIES");
        
        if (!browserbaseApiKey) {
            return Response.json({ 
                success: false,
                error: "BROWSERBASE_API_KEY tanımlanmamış! Lütfen Settings > Environment Variables'dan ekleyin." 
            }, { status: 400 });
        }

        if (!savedCookies) {
            return Response.json({ 
                success: false,
                error: "HERE_APP_COOKIES tanımlanmamış! Cookie'leri manuel olarak ayarlamanız gerekiyor." 
            }, { status: 400 });
        }

        console.log("========================================");
        console.log("SCRAPING BASLIYOR");
        console.log("Target Date:", dateToScrap);
        console.log("Order Source:", orderSource);
        console.log("========================================");
        
        try {
            browser = await puppeteer.connect({
                browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${browserbaseApiKey}`,
                protocolTimeout: 60000
            });
        } catch (browserError) {
            console.error("Browserbase bağlantı hatası:", browserError.message);
            
            // 402 hatası kontrolü
            if (browserError.message.includes('402') || browserError.message.includes('payment')) {
                return Response.json({ 
                    success: false,
                    error: "❌ Browserbase API limiti dolmuş veya ödeme problemi var!\n\n" +
                           "Çözüm seçenekleri:\n" +
                           "1. Browserbase hesabınızı kontrol edin (browserbase.com)\n" +
                           "2. API limitinizi yükseltin\n" +
                           "3. Yeni bir Browserbase hesabı oluşturup yeni API key kullanın\n\n" +
                           "Şu an manuel sipariş girişi yapabilirsiniz."
                }, { status: 402 });
            }
            
            return Response.json({ 
                success: false,
                error: `Browserbase'e bağlanılamadı: ${browserError.message}` 
            }, { status: 500 });
        }

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setCookie(...JSON.parse(savedCookies));

        const targetUrl = orderSource === 'Relish' 
            ? 'https://admin.here-app.com/Order/Ezcater?orderType=1&menuId=Relishx&forRelish=True'
            : 'https://admin.here-app.com/Order/Ezcater?orderType=1';

        console.log("URL'e gidiliyor:", targetUrl);
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForTimeout(2000);

        if (page.url().includes('/login')) {
            await browser.close();
            return Response.json({ 
                success: false,
                error: "Cookie'ler süresi dolmuş! Lütfen yeniden login yapıp cookie'leri güncelleyin." 
            }, { status: 401 });
        }

        console.log("Authenticated! URL:", page.url());

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        console.log("Bugün:", todayStr);
        console.log("Yarın:", tomorrowStr);
        console.log("Hedef tarih:", dateToScrap);

        console.log("Tarih input'una tıklanıyor...");
        
        await page.evaluate(() => {
            const dateInputs = document.querySelectorAll('input[type="text"]');
            for (const input of dateInputs) {
                const ph = input.placeholder ? input.placeholder.toLowerCase() : '';
                if (ph.includes('date')) {
                    input.click();
                    return true;
                }
            }
            return false;
        });

        await page.waitForTimeout(1000);

        let dateSetMethod = 'none';
        
        if (dateToScrap === tomorrowStr) {
            console.log("Hedef tarih yarin - 'Tomorrow' secenegine tiklanacak");
            
            const tomorrowClicked = await page.evaluate(() => {
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    if (el.textContent && el.textContent.trim() === 'Tomorrow') {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            
            if (tomorrowClicked) {
                dateSetMethod = 'tomorrow';
            }
            
        } else if (dateToScrap === todayStr) {
            console.log("Hedef tarih bugun - 'Today' secenegine tiklanacak");
            
            const todayClicked = await page.evaluate(() => {
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    if (el.textContent && el.textContent.trim() === 'Today') {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            
            if (todayClicked) {
                dateSetMethod = 'today';
            }
            
        } else {
            console.log("Hedef tarih ozel - 'Custom Range' kullanilacak");
            
            const customClicked = await page.evaluate(() => {
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    if (el.textContent && el.textContent.trim() === 'Custom Range') {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            
            if (customClicked) {
                await page.waitForTimeout(1000);
                
                const parts = dateToScrap.split('-');
                const formattedDate = parts[1] + '.' + parts[2] + '.' + parts[0];
                
                console.log("Custom Range modalinda tarih ayarlaniyor:", formattedDate);
                
                await page.evaluate((dateStr) => {
                    const labels = document.querySelectorAll('label');
                    for (const label of labels) {
                        const text = label.textContent ? label.textContent.trim().toUpperCase() : '';
                        
                        if (text === 'FROM' || text === 'TO') {
                            const input = label.nextElementSibling;
                            if (input && input.tagName === 'INPUT') {
                                input.value = dateStr;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                }, formattedDate);
                
                await page.waitForTimeout(500);
                
                console.log("Apply butonuna tiklaniyor...");
                
                await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent && btn.textContent.trim() === 'Apply') {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                dateSetMethod = 'custom_range';
            }
        }

        console.log("Tarih ayarlama metodu:", dateSetMethod);
        await page.waitForTimeout(1500);

        console.log("========================================");
        console.log("FILTRELER AYARLANIYOR");
        
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            
            for (let i = 0; i < selects.length; i++) {
                const select = selects[i];
                const options = select.options;
                
                for (let j = 0; j < options.length; j++) {
                    const optionText = options[j].text.trim();
                    
                    if (optionText === 'No') {
                        select.value = options[j].value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    if (optionText.includes('Unassigned')) {
                        select.value = options[j].value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        });

        await page.waitForTimeout(1000);

        console.log("SUBMIT BUTONUNA TIKLANIYOR");
        
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, input[type="submit"]');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const text = (btn.textContent || btn.value || '').toLowerCase();
                if (text.includes('submit')) {
                    btn.click();
                    break;
                }
            }
        });

        await page.waitForTimeout(3000);
        console.log("========================================");

        console.log("SAYFALAMA BASLIYOR");
        
        let allOrders = [];
        let currentPage = 1;

        while (true) {
            console.log("Sayfa", currentPage, "cekiliyor");
            
            const pageInfo = await page.evaluate(() => {
                const table = document.querySelector('table');
                return {
                    exists: table !== null,
                    rowCount: table ? table.querySelectorAll('tbody tr').length : 0
                };
            });
            
            console.log(">>> Tablo durumu:", JSON.stringify(pageInfo));
            
            const orders = await page.evaluate((src) => {
                const headers = document.querySelectorAll('table thead th');
                const columnMap = {};
                
                for (let i = 0; i < headers.length; i++) {
                    const headerText = headers[i].textContent ? headers[i].textContent.trim() : '';
                    if (headerText) {
                        columnMap[headerText] = i;
                    }
                }
                
                const pickupTimeIndex = columnMap['Pickup Time'] !== undefined ? columnMap['Pickup Time'] : 5;
                const deliveryTimeIndex = columnMap['Delivery Time'] !== undefined ? columnMap['Delivery Time'] : 8;
                const pickupAddressIndex = columnMap['Pickup Address'] !== undefined ? columnMap['Pickup Address'] : 3;
                const deliveryAddressIndex = columnMap['Delivery Address'] !== undefined ? columnMap['Delivery Address'] : 4;
                const priceIndex = columnMap['Price'] !== undefined ? columnMap['Price'] : 9;
                
                console.log('[COLUMN INDEXES]', {
                    pickupTime: pickupTimeIndex,
                    deliveryTime: deliveryTimeIndex,
                    pickupAddress: pickupAddressIndex,
                    deliveryAddress: deliveryAddressIndex,
                    price: priceIndex
                });
                
                const rows = document.querySelectorAll('table tbody tr');
                const results = [];
                
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.querySelectorAll('td');
                    
                    if (cells.length >= Math.max(pickupTimeIndex, deliveryTimeIndex, pickupAddressIndex, deliveryAddressIndex, priceIndex) + 1) {
                        const orderId = cells[0] ? cells[0].textContent.trim() : '';
                        if (orderId && orderId.length > 0) {
                            const pickupCell = cells[pickupTimeIndex];
                            let pickupTime = '';
                            
                            const pickupInput = pickupCell ? pickupCell.querySelector('input') : null;
                            if (pickupInput) {
                                pickupTime = pickupInput.value;
                            } else if (pickupCell) {
                                pickupTime = pickupCell.textContent.trim().split('\n')[0];
                            }
                            
                            const deliveryCell = cells[deliveryTimeIndex];
                            let deliveryTime = '';
                            if (deliveryCell) {
                                const fullText = deliveryCell.textContent.trim();
                                const lines = fullText.split('\n');
                                if (lines.length > 1) {
                                    deliveryTime = lines[1].trim();
                                } else {
                                    deliveryTime = lines[0].trim();
                                }
                            }
                            
                            results.push({
                                order_id: orderId,
                                pickup_address: cells[pickupAddressIndex] ? cells[pickupAddressIndex].textContent.trim() : '',
                                dropoff_address: cells[deliveryAddressIndex] ? cells[deliveryAddressIndex].textContent.trim() : '',
                                pickup_time: pickupTime,
                                dropoff_time: deliveryTime,
                                price: cells[priceIndex] ? cells[priceIndex].textContent.trim() : '',
                                orderSource: src
                            });
                        }
                    }
                }
                
                return results;
            }, orderSource);

            console.log(">>> Sayfa", currentPage, "-", orders.length, "siparis bulundu");
            
            if (orders.length > 0) {
                console.log(">>> Ilk siparis:", JSON.stringify(orders[0]));
            }
            
            allOrders = allOrders.concat(orders);

            const nextNum = currentPage + 1;
            
            const nextPageFound = await page.evaluate((pageNum) => {
                const pageLinks = document.querySelectorAll('a, button');
                for (let i = 0; i < pageLinks.length; i++) {
                    const link = pageLinks[i];
                    const txt = link.textContent ? link.textContent.trim() : '';
                    if (txt === String(pageNum)) {
                        const isActive = link.classList.contains('active');
                        const isDisabled = link.classList.contains('disabled') || link.hasAttribute('disabled');
                        
                        if (!isActive && !isDisabled) {
                            link.click();
                            return true;
                        }
                    }
                }
                return false;
            }, nextNum);

            if (!nextPageFound) {
                console.log(">>> Sonraki sayfa bulunamadi");
                break;
            }

            await page.waitForTimeout(3000);
            currentPage++;
            
            if (currentPage > 10) {
                console.log(">>> Maksimum sayfa sayisina ulasildi");
                break;
            }
        }

        await browser.close();

        console.log("========================================");
        console.log("SCRAPING TAMAMLANDI!");
        console.log("Toplam Cekilen Siparis:", allOrders.length);
        console.log("Taranan Sayfa Sayisi:", currentPage);
        console.log("========================================");

        if (allOrders.length === 0) {
            return Response.json({ 
                success: false, 
                message: "Hic siparis bulunamadi!", 
                newOrders: 0,
                totalScraped: 0
            });
        }

        const existing = await base44.entities.DailyOrder.filter({ order_date: dateToScrap });
        const existingIds = existing.map(o => o.ezcater_order_id);
        
        const newOrders = allOrders
            .filter(o => !existingIds.includes(o.order_id))
            .map(o => ({
                ezcater_order_id: o.order_id,
                order_date: dateToScrap,
                pickup_address: o.pickup_address,
                pickup_time: o.pickup_time,
                dropoff_address: o.dropoff_address,
                dropoff_time: o.dropoff_time,
                customer_name: o.orderSource + ' Order',
                ezcater_notes: 'Price: ' + o.price,
                status: 'Çekildi'
            }));

        if (newOrders.length > 0) {
            await base44.entities.DailyOrder.bulkCreate(newOrders);
        }

        return Response.json({
            success: true,
            message: newOrders.length + ' yeni siparis eklendi',
            newOrders: newOrders.length,
            totalScraped: allOrders.length,
            pagesScraped: currentPage
        });

    } catch (error) {
        console.error("========================================");
        console.error("HATA OLUSTU!");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        console.error("========================================");
        
        if (browser) {
            await browser.close();
        }
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});