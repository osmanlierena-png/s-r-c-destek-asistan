
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Bot } from 'lucide-react';

export default function WhatsAppConfig() {
  const [config, setConfig] = useState({
    accountSid: '',
    authToken: '',
    twilioNumber: ''
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('whatsAppConfig');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('whatsAppConfig', JSON.stringify(config));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setConfig(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-green-500" />
          WhatsApp API Entegrasyonu (Twilio)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Twilio hesabınızdan aldığınız bilgileri buraya girerek sistemi WhatsApp'a bağlayın. Bu bilgiler tarayıcınızda saklanacaktır.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="accountSid">Account SID</Label>
            <Input id="accountSid" value={config.accountSid} onChange={handleChange} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <Label htmlFor="authToken">Auth Token</Label>
            <Input id="authToken" type="password" value={config.authToken} onChange={handleChange} placeholder="••••••••••••••••••••••••••" />
          </div>
          <div>
            <Label htmlFor="twilioNumber">Twilio WhatsApp Numarası</Label>
            <Input id="twilioNumber" value={config.twilioNumber} onChange={handleChange} placeholder="whatsapp:+14155238886" />
            <p className="text-xs text-slate-500 mt-1">
              Numara "whatsapp:+[ülke kodu][alan kodu][numara]" formatında olmalıdır. Örneğin: whatsapp:+14155238886 (ABD formatı)
            </p>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          {isSaved ? 'Kaydedildi!' : 'API Bilgilerini Kaydet'}
        </Button>
      </CardContent>
    </Card>
  );
}
