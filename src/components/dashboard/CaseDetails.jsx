
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/entities/ChatMessage";
import { Case } from "@/entities/Case";
import { 
  X, 
  User, 
  MapPin, 
  AlertTriangle,
  MessageSquare,
  Bot,
  Info,
  Camera,
  CheckCircle 
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function CaseDetails({ caseItem, onClose }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadChatMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const messages = await ChatMessage.filter(
        { case_id: caseItem.id },
        'created_date'
      );
      setChatMessages(messages);
    } catch (error) {
      console.error('Chat mesajları yüklenirken hata:', error);
    }
    setIsLoading(false);
  }, [caseItem.id]); // Dependency for useCallback

  useEffect(() => {
    loadChatMessages();
  }, [loadChatMessages]); // Dependency for useEffect

  const handleMarkAsSolved = async () => {
    setIsUpdating(true);
    try {
      await Case.update(caseItem.id, { durum: "Çözüldü" });
      onClose(); 
    } catch (error) {
      console.error('Case güncellenirken hata:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    const colors = {
      'Acil': 'bg-red-100 text-red-800 border-red-200',
      'Yüksek': 'bg-orange-100 text-orange-800 border-orange-200',
      'Orta': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Düşük': 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800 border-gray-200';
  };
  
  return (
    <Card className="h-full max-w-2xl mx-auto shadow-xl border-slate-200/50">
      <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-900 text-white">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl mb-1">{caseItem.case_id || 'Case Detayları'}</CardTitle>
            <p className="text-slate-300 text-sm">
              {format(new Date(caseItem.created_date), 'dd MMMM yyyy, HH:mm', { locale: tr })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {caseItem.durum !== "Çözüldü" && ( 
              <Button
                onClick={handleMarkAsSolved}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {isUpdating ? 'Kaydediliyor...' : 'Çözüldü'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
             <h4 className="font-semibold text-slate-800 mb-2">Ana Sorun</h4>
             <p className="text-slate-700">{caseItem.sorun}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <InfoPill icon={<User className="w-4 h-4 text-blue-500"/>} label="Sürücü" value={caseItem.driver_name || 'Bilinmiyor'} />
             {caseItem.konum && <InfoPill icon={<MapPin className="w-4 h-4 text-green-500"/>} label="Konum" value={caseItem.konum} />}
             <InfoPill icon={<AlertTriangle className="w-4 h-4 text-red-500"/>} label="Aciliyet" value={<Badge className={getUrgencyColor(caseItem.aciliyet)}>{caseItem.aciliyet}</Badge>} />
             <InfoPill icon={<Info className="w-4 h-4 text-yellow-500"/>} label="Kategori" value={<Badge variant="outline">{caseItem.kategori}</Badge>} />
          </div>

          {caseItem.ekstra_bilgi && (
            <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">Ek Bilgiler</h4>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{caseItem.ekstra_bilgi}</p>
            </div>
          )}

          {caseItem.fotograflar && caseItem.fotograflar.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-500" />
                Gönderilen Fotoğraflar ({caseItem.fotograflar.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {caseItem.fotograflar.map((foto, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={foto.url} 
                      alt={foto.aciklama || `Fotoğraf ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(foto.url, '_blank')}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs opacity-0 group-hover:opacity-100">Büyüt</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Konuşma Geçmişi
            </h4>
            <Card className="border-slate-200">
              <ScrollArea className="h-64 p-4">
                {isLoading ? (
                  <div className="text-center text-slate-500">Yükleniyor...</div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender === 'sürücü' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-3 py-2 rounded-lg ${
                          message.sender === 'sürücü' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-900'
                        }`}>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const InfoPill = ({ icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="mt-1">{icon}</div>
        <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <div className="text-sm text-slate-800 font-semibold">{value}</div>
        </div>
    </div>
);
