import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('\n🔧 TWILIO BAĞLANTI TESTİ BAŞLIYOR...\n');
        
        // Secret'ları al
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const phoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
        const testWhitelist = Deno.env.get("TEST_SMS_WHITELIST");

        const results = {
            success: false,
            secrets: {
                accountSid: {
                    exists: !!accountSid,
                    value: accountSid ? `${accountSid.substring(0, 8)}...` : null,
                    valid: false
                },
                authToken: {
                    exists: !!authToken,
                    value: authToken ? `${authToken.substring(0, 8)}...` : null,
                    valid: false
                },
                phoneNumber: {
                    exists: !!phoneNumber,
                    value: phoneNumber || null,
                    valid: false
                },
                testWhitelist: {
                    exists: !!testWhitelist,
                    value: testWhitelist || '(PRODUCTION MODE - Tüm sürücülere gidecek!)',
                    mode: testWhitelist ? 'TEST MODE 🧪' : 'PRODUCTION MODE 🚀'
                }
            },
            twilioConnection: null,
            phoneNumberDetails: null,
            errorMessage: null
        };

        console.log('📋 SECRET DURUMU:');
        console.log(`   TWILIO_ACCOUNT_SID: ${results.secrets.accountSid.exists ? '✅' : '❌'} ${results.secrets.accountSid.value || 'YOK'}`);
        console.log(`   TWILIO_AUTH_TOKEN: ${results.secrets.authToken.exists ? '✅' : '❌'} ${results.secrets.authToken.value || 'YOK'}`);
        console.log(`   TWILIO_PHONE_NUMBER: ${results.secrets.phoneNumber.exists ? '✅' : '❌'} ${results.secrets.phoneNumber.value || 'YOK'}`);
        console.log(`   TEST_SMS_WHITELIST: ${results.secrets.testWhitelist.exists ? '✅' : '❌'} ${results.secrets.testWhitelist.value}`);
        console.log(`   MODE: ${results.secrets.testWhitelist.mode}\n`);

        // Eksik secret varsa
        if (!accountSid || !authToken || !phoneNumber) {
            throw new Error('Eksik Twilio secret\'ları! Lütfen Settings → Environment Variables\'dan ekleyin.');
        }

        // 1️⃣ Twilio Account Doğrulama
        console.log('🔐 Twilio hesabı doğrulanıyor...');
        const accountUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
        
        const accountResponse = await fetch(accountUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
            }
        });

        if (!accountResponse.ok) {
            const errorData = await accountResponse.json();
            throw new Error(`Twilio Auth YANLIŞ: ${errorData.message || 'Account SID veya Auth Token hatalı'}`);
        }

        const accountData = await accountResponse.json();
        results.secrets.accountSid.valid = true;
        results.secrets.authToken.valid = true;
        results.twilioConnection = {
            connected: true,
            friendlyName: accountData.friendly_name,
            accountStatus: accountData.status,
            accountType: accountData.type
        };

        console.log(`✅ Twilio hesabı doğrulandı: ${accountData.friendly_name}`);
        console.log(`   Status: ${accountData.status}`);
        console.log(`   Type: ${accountData.type}\n`);

        // 2️⃣ Telefon Numarası Doğrulama
        console.log('📞 Telefon numarası kontrol ediliyor...');
        const cleanPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
        
        // Incoming phone numbers listesini al
        const numbersUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
        
        const numbersResponse = await fetch(numbersUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
            }
        });

        if (!numbersResponse.ok) {
            const errorText = await numbersResponse.text();
            console.error('Telefon numarası listesi hatası:', errorText);
            throw new Error(`Telefon numarası listesi alınamadı: ${numbersResponse.status}`);
        }

        const numbersData = await numbersResponse.json();
        console.log('Twilio API yanıtı:', JSON.stringify(numbersData, null, 2));
        
        // Twilio API yanıtı incoming_phone_numbers array'i içerir
        const phoneNumbersList = numbersData.incoming_phone_numbers || [];
        
        console.log(`   Kayıtlı ${phoneNumbersList.length} numara bulundu`);
        
        const matchingNumber = phoneNumbersList.find(n => 
            n.phone_number === cleanPhoneNumber || n.phone_number === phoneNumber
        );

        if (!matchingNumber) {
            console.log(`⚠️ UYARI: ${phoneNumber} bu Twilio hesabında kayıtlı değil!`);
            console.log(`   Kayıtlı numaralar:`);
            phoneNumbersList.forEach(n => {
                console.log(`   - ${n.phone_number} (${n.friendly_name})`);
            });
            
            results.phoneNumberDetails = {
                valid: false,
                message: 'Bu numara Twilio hesabınızda kayıtlı değil',
                availableNumbers: phoneNumbersList.map(n => ({
                    number: n.phone_number,
                    name: n.friendly_name
                }))
            };
        } else {
            results.secrets.phoneNumber.valid = true;
            results.phoneNumberDetails = {
                valid: true,
                friendlyName: matchingNumber.friendly_name,
                capabilities: matchingNumber.capabilities,
                smsUrl: matchingNumber.sms_url,
                phoneStatus: matchingNumber.status
            };

            console.log(`✅ Telefon numarası doğrulandı: ${matchingNumber.phone_number}`);
            console.log(`   İsim: ${matchingNumber.friendly_name}`);
            console.log(`   SMS: ${matchingNumber.capabilities.sms ? '✅' : '❌'}`);
            console.log(`   Voice: ${matchingNumber.capabilities.voice ? '✅' : '❌'}`);
            console.log(`   SMS Webhook: ${matchingNumber.sms_url || '(YOK)'}\n`);
        }

        results.success = results.secrets.accountSid.valid && 
                         results.secrets.authToken.valid && 
                         results.secrets.phoneNumber.valid;

        console.log('\n📊 TEST SONUCU:');
        console.log(`   Account SID & Auth Token: ${results.secrets.accountSid.valid ? '✅ DOĞRU' : '❌ YANLIŞ'}`);
        console.log(`   Phone Number: ${results.secrets.phoneNumber.valid ? '✅ DOĞRU' : '❌ YANLIŞ'}`);
        console.log(`   Test Mode: ${results.secrets.testWhitelist.mode}`);
        console.log(`   Genel Durum: ${results.success ? '✅ HER ŞEY HAZIR!' : '❌ SORUN VAR'}\n`);

        return Response.json(results);

    } catch (error) {
        console.error('❌ Test hatası:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            secrets: {
                accountSid: { exists: !!Deno.env.get("TWILIO_ACCOUNT_SID") },
                authToken: { exists: !!Deno.env.get("TWILIO_AUTH_TOKEN") },
                phoneNumber: { exists: !!Deno.env.get("TWILIO_PHONE_NUMBER") },
                testWhitelist: { 
                    exists: !!Deno.env.get("TEST_SMS_WHITELIST"),
                    mode: Deno.env.get("TEST_SMS_WHITELIST") ? 'TEST MODE 🧪' : 'PRODUCTION MODE 🚀'
                }
            }
        }, { status: 500 });
    }
});