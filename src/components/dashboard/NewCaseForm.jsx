
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, PlusCircle } from "lucide-react";
import { Case } from "@/entities/Case";

export default function NewCaseForm({ onClose, onCaseCreated }) {
  const [formData, setFormData] = useState({
    sorun: "",
    driver_name: "",
    ekstra_bilgi: "" // For Conversation ID
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sorun || !formData.ekstra_bilgi) {
        alert("Lütfen tüm zorunlu alanları doldurun.");
        return;
    }
    setIsLoading(true);

    try {
      await Case.create({
        ...formData,
        aciliyet: "Orta",
        kategori: "Belirlenmedi",
        durum: "Bildirildi"
      });
      onCaseCreated();
    } catch (error) {
      console.error('Case oluşturulurken hata:', error);
      alert("Case oluşturulurken bir hata oluştu.");
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg bg-white">
        <CardHeader className="bg-slate-800 text-white">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Manuel Yeni Case Oluştur
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            WhatsApp'tan gelen bir konuşmayı başlatmak için Chatling'den kopyaladığınız Conversation ID'yi buraya yapıştırın.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Chatling Conversation ID *
              </label>
              <Input
                value={formData.ekstra_bilgi}
                onChange={(e) => setFormData({...formData, ekstra_bilgi: e.target.value})}
                placeholder="Chatling panelinden kopyalanan ID"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Sürücü Adı (Opsiyonel)
              </label>
              <Input
                value={formData.driver_name}
                onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
                placeholder="Örn: Ahmet Yılmaz"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Bildirilen Ana Sorun *
              </label>
              <Textarea
                value={formData.sorun}
                onChange={(e) => setFormData({...formData, sorun: e.target.value})}
                placeholder="Sürücünün bildirdiği problemi kısaca özetleyin"
                required
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                İptal
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {isLoading ? 'Oluşturuluyor...' : 'Case Oluştur'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
