import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import puppeteer from 'npm:puppeteer@21.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let browser;
    try {
        const browserbaseApiKey = Deno.env.get("BROWSERBASE_API_KEY");
        const email = Deno.env.get("HERE_APP_EMAIL");
        const password = Deno.env.get("HERE_APP_PASSWORD");

        console.log("=== CREDENTIALS CHECK ===");
        console.log("Email:", email ? `${email.substring(0, 3)}***${email.substring(email.length - 3)}` : "NOT SET");
        console.log("Email length:", email?.length || 0);
        console.log("Email has whitespace:", email ? /\s/.test(email) : "N/A");
        console.log("Password length:", password?.length || 0);
        console.log("Password has whitespace:", password ? /\s/.test(password) : "N/A");

        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${browserbaseApiKey}`,
        });

        const page = await browser.newPage();
        await page.goto('https://admin.here-app.com/login', { waitUntil: 'networkidle0' });
        
        // Sayfanın HTML'ini al
        const pageHTML = await page.content();
        console.log("=== PAGE HTML (first 1000 chars) ===");
        console.log(pageHTML.substring(0, 1000));

        // Tüm input'ları bul
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(input => ({
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                className: input.className,
                value: input.value
            }));
        });
        console.log("=== ALL INPUTS ===");
        console.log(JSON.stringify(inputs, null, 2));

        // Method 1: Placeholder ile
        await page.click('input[placeholder="Username.."]');
        await page.keyboard.type(email);
        await page.click('input[placeholder="Password.."]');
        await page.keyboard.type(password);

        const values = await page.evaluate(() => ({
            username: document.querySelector('input[placeholder="Username.."]')?.value,
            passwordLength: document.querySelector('input[placeholder="Password.."]')?.value?.length
        }));

        console.log("=== VALUES AFTER TYPING ===");
        console.log(JSON.stringify(values, null, 2));

        // Screenshot al
        const screenshot = await page.screenshot({ encoding: 'base64' });

        await browser.close();

        return Response.json({
            success: true,
            credentials: {
                emailMasked: email ? `${email.substring(0, 3)}***${email.substring(email.length - 3)}` : "NOT SET",
                emailLength: email?.length || 0,
                emailHasWhitespace: email ? /\s/.test(email) : false,
                passwordLength: password?.length || 0,
                passwordHasWhitespace: password ? /\s/.test(password) : false
            },
            inputs: inputs,
            valuesAfterTyping: values,
            screenshotBase64: screenshot.substring(0, 100) + "..." // İlk 100 karakter
        });

    } catch (error) {
        if (browser) await browser.close();
        return Response.json({ error: error.message }, { status: 500 });
    }
});