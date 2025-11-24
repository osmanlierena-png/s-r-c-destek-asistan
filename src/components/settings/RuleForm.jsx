
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AIResponseRule } from '@/entities/AIResponseRule';
import { Plus, Save, Bot, X } from 'lucide-react';

export default function RuleForm({ rule, onSave, onCancel }) {
  const [formData, setFormData] = useState(rule || {
    category_name: "",
    keywords: [],
    required_info: [],
    initial_question: "",
    completion_message: "",
    is_active: true
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const infoOptions = [
    { id: "sure_bilgisi", label: "Süre Bilgisi (Kaç dakika?)" },
    { id: "evet_hayir", label: "Evet/Hayır (Yapabilir mi?)" },
    { id: "konum", label: "Konum Bilgisi" },
    { id: "fotoğraf", label: "Fotoğraf" },
    { id: "aciklama", label: "Detaylı Açıklama" }
  ];

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData({...formData, keywords: [...formData.keywords, newKeyword.trim()]});
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({...formData, keywords: formData.keywords.filter(k => k !== keyword)});
  };

  const toggleRequiredInfo = (info) => {
    const newInfo = formData.required_info.includes(info)
      ? formData.required_info.filter(i => i !== info)
      : [...formData.required_info, info];
    setFormData({...formData, required_info: newInfo});
  };

  const handleSave = async () => {
    if (!formData.category_name.trim()) {
      alert("Lütfen 'Kategori Adı' alanını doldurun.");
      return;
    }
    if (formData.keywords.length === 0) {
      alert("Lütfen en az bir 'Anahtar Kelime' ekleyin. Kelimeyi yazdıktan sonra '+' butonuna basmayı unutmayın.");
      return;
    }
    if (formData.required_info.length === 0) {
      alert("Lütfen en az bir 'Alınacak Bilgi' seçeneğini işaretleyin.");
      return;
    }
    if (!formData.initial_question.trim()) {
      alert("Lütfen 'İlk Sorulacak Soru' alanını doldurun.");
      return;
    }
    if (!formData.completion_message.trim()) {
      alert("Lütfen 'Bitiş Mesajı' alanını doldurun.");
      return;
    }
    
    setIsSaving(true);
    try {
      if (rule) {
        await AIResponseRule.update(rule.id, formData);
      } else {
        await AIResponseRule.create(formData);
      }
      onSave();
    } catch (error) {
      console.error('Kural kaydedilirken hata:', error);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="bg-blue-500 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {rule ? 'Kuralı Düzenle' : 'Yeni Kural Ekle'}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <div className="flex-1 overflow-y-auto">
          <CardContent className="p-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Kategori Adı *</label>
              <Input
                value={formData.category_name}
                onChange={(e) => setFormData({...formData, category_name: e.target.value})}
                placeholder="Örn: Trafik/Gecikme, Araç Arızası"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Anahtar Kelimeler *</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Kelime ekle..."
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                />
                <Button onClick={addKeyword} size="sm"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.keywords.map(keyword => (
                  <Badge key={keyword} variant="secondary" className="cursor-pointer hover:bg-red-100" onClick={() => removeKeyword(keyword)}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Alınacak Bilgiler *</label>
              <div className="space-y-2">
                {infoOptions.map(option => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.required_info.includes(option.id)}
                      onCheckedChange={() => toggleRequiredInfo(option.id)}
                    />
                    <label className="text-sm">{option.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">İlk Sorulacak Soru *</label>
              <Textarea
                value={formData.initial_question}
                onChange={(e) => setFormData({...formData, initial_question: e.target.value})}
                placeholder="Örn: Kaç dakika gecikeceksin?"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Bitiş Mesajı *</label>
              <Textarea
                value={formData.completion_message}
                onChange={(e) => setFormData({...formData, completion_message: e.target.value})}
                placeholder="Örn: Anlaşıldı, not edildi. Kolay gelsin."
                rows={2}
              />
            </div>
          </CardContent>
        </div>

        <div className="flex-shrink-0 p-6 border-t bg-gray-50">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">İptal</Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {isSaving ? 'Kaydediliyor...' : (rule ? 'Güncelle' : 'Kaydet')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
