import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageCircle,
  Send,
  Clock,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Search,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ChatInterfacePage() {
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const getESTDate = () => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => getESTDate());

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🔍 ChatInterface - ${selectedDate} tarihli case'ler yükleniyor (EST)`);

      // EST tarihini UTC'ye çevir: EST = UTC-5
      const [year, month, day] = selectedDate.split('-').map(Number);
      const estStartUTC = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
      const estEndUTC = new Date(Date.UTC(year, month - 1, day + 1, 4, 59, 59, 999));

      // Direkt veritabanından sadece seçilen tarih aralığındaki case'leri çek
      const data = await base44.entities.Case.filter(
        { 
          created_date: { 
            $gte: estStartUTC.toISOString(),
            $lte: estEndUTC.toISOString()
          } 
        },
        '-created_date',
        500
      );

      console.log(`✅ ${data.length} case bulundu (${selectedDate})`);
      setCases(data);
      setFilteredCases(data);
    } catch (error) {
      console.error('Case\'ler yüklenirken hata:', error);
      setCases([]);
      setFilteredCases([]);
    }
    setIsLoading(false);
  }, [selectedDate]);

  const loadChatMessages = useCallback(async () => {
    if (!selectedCase) return;
    try {
      // Bot mesajları
      const chatMessages = await base44.entities.ChatMessage.filter(
        { case_id: selectedCase.id },
        'timestamp'
      );
      
      // SMS mesajları (order_id'den case'e ulaşıyoruz)
      let smsMessages = [];
      if (selectedCase.driver_phone) {
        smsMessages = await base44.entities.CheckMessage.filter(
          { driver_phone: selectedCase.driver_phone },
          'sent_time'
        );
      }
      
      // Birleşik mesaj listesi oluştur
      const allMessages = [
        ...chatMessages.map(m => ({ ...m, type: 'chat', timestamp: m.created_date })),
        ...smsMessages.map(m => ({ ...m, type: 'sms', timestamp: m.sent_time }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setChatMessages(allMessages);
      
      // 🔄 Her 5 saniyede yeni mesajları yükle
      const interval = setInterval(async () => {
        const updatedChatMessages = await base44.entities.ChatMessage.filter(
          { case_id: selectedCase.id },
          'timestamp'
        );
        
        let updatedSmsMessages = [];
        if (selectedCase.driver_phone) {
          updatedSmsMessages = await base44.entities.CheckMessage.filter(
            { driver_phone: selectedCase.driver_phone },
            'sent_time'
          );
        }
        
        const updatedAllMessages = [
          ...updatedChatMessages.map(m => ({ ...m, type: 'chat', timestamp: m.created_date })),
          ...updatedSmsMessages.map(m => ({ ...m, type: 'sms', timestamp: m.sent_time }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        setChatMessages(updatedAllMessages);
      }, 5000);
      
      return () => clearInterval(interval);
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error);
    }
  }, [selectedCase]);

  useEffect(() => {
    loadCases();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedCase) {
      loadChatMessages();
    } else {
        setChatMessages([]);
    }
  }, [selectedCase, loadChatMessages]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredCases(cases.filter(c => 
        c.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.sorun?.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setFilteredCases(cases);
    }
  }, [searchTerm, cases]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedCase) return;

    try {
      const conversationId = selectedCase.ekstra_bilgi?.replace("Chatling Conversation ID: ", "");

      if (!conversationId || conversationId.includes("Cok trafik") || conversationId.includes("WhatsApp mesajı")) {
        alert("Bu case için geçerli bir Chatling Conversation ID bulunamadı.");
        return;
      }

      const { sendChatMessage } = await import("@/functions/sendChatMessage");
      const response = await sendChatMessage({
        conversationId: conversationId.trim(),
        message: newMessage,
        caseId: selectedCase.id
      });

      if (response.data.success) {
        setNewMessage("");
        loadChatMessages();
      } else {
        alert(`Mesaj gönderilemedi: ${response.data.error}`);
      }
    } catch (error) {
      alert(`Hata: ${error.message}`);
    }
  };
  
  const handleFeedback = async (message, feedbackType) => {
    const originalMessages = [...chatMessages];
    const newFeedback = message.feedback === feedbackType ? null : feedbackType;
    const updatedMessages = chatMessages.map(m =>
      m.id === message.id ? { ...m, feedback: newFeedback } : m
    );
    setChatMessages(updatedMessages);

    try {
      await base44.entities.ChatMessage.update(message.id, { feedback: newFeedback });
    } catch (error) {
      setChatMessages(originalMessages);
    }
  };

  const getUrgencyColor = (urgency) => {
    const colors = {
      'Acil': 'bg-red-100 text-red-800',
      'Yüksek': 'bg-orange-100 text-orange-800',
      'Orta': 'bg-yellow-100 text-yellow-800',
      'Düşük': 'bg-green-100 text-green-800',
    };
    return colors[urgency] || 'bg-slate-100 text-slate-800';
  };

  if (selectedCase) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="h-[calc(100vh-6rem)] flex flex-col">
            <CardHeader className="bg-blue-600 text-white pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedCase(null)}
                    className="text-white hover:bg-white/20 h-8 w-8"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-lg">
                      {selectedCase.driver_name || 'Bilinmeyen'}
                    </CardTitle>
                    <p className="text-blue-100 text-xs">
                      {selectedCase.case_id}
                    </p>
                  </div>
                </div>
                <Badge className={getUrgencyColor(selectedCase.aciliyet)}>
                  {selectedCase.aciliyet}
                </Badge>
              </div>

              <div className="mt-2 p-2 bg-white/10 rounded text-sm">
                <p className="text-blue-100 text-xs mb-1">Sorun:</p>
                <p className="text-white text-sm">{selectedCase.sorun}</p>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {chatMessages.map((message, idx) => {
                    if (message.type === 'sms') {
                      // SMS mesajı gösterimi
                      return (
                        <div key={`sms-${message.id}-${idx}`} className="flex justify-start">
                          <div className="max-w-[70%] px-3 py-2 rounded-lg text-sm bg-purple-100 text-purple-900 border border-purple-200">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="w-3 h-3" />
                              <span className="text-xs font-semibold">SMS ({message.message_type})</span>
                            </div>
                            <p>{message.message_content}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                              <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
                              {message.response_received && <span className="text-green-600">✓ Yanıtlandı</span>}
                              {message.message_status === 'failed' && <span className="text-red-600">✗ Başarısız</span>}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Chat mesajı gösterimi (eski kod)
                    return (
                      <div key={`chat-${message.id}-${idx}`} className={`group flex items-end gap-2 ${message.sender === 'sürücü' ? 'justify-end' : 'justify-start'}`}>
                        {message.sender !== 'sürücü' && (
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleFeedback(message, 'liked')} className={cn("p-1 rounded-full hover:bg-green-100", message.feedback === 'liked' && 'bg-green-100')}>
                                <ThumbsUp className={cn("w-3 h-3 text-slate-400", message.feedback === 'liked' && 'text-green-600')} />
                              </button>
                              <button onClick={() => handleFeedback(message, 'disliked')} className={cn("p-1 rounded-full hover:bg-red-100", message.feedback === 'disliked' && 'bg-red-100')}>
                                <ThumbsDown className={cn("w-3 h-3 text-slate-400", message.feedback === 'disliked' && 'text-red-600')} />
                              </button>
                           </div>
                        )}
                        <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                          message.sender === 'sürücü'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-900'
                        }`}>
                          <p>{message.message}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {format(new Date(message.timestamp), 'HH:mm')}
                          </span>
                        </div>
                         {message.sender === 'sürücü' && <div className='w-10'></div>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Mesaj yazın..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 h-9"
                  />
                  <Button onClick={sendMessage} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Konuşma Paneli</h1>
          <p className="text-slate-600 text-sm">Sürücülerle mesajlaşın</p>
        </div>

        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Sürücü veya sorun ara..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[180px] h-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">Yükleniyor...</div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {selectedDate} tarihinde konuşma bulunamadı
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCases.map((caseItem) => (
                  <Card
                    key={caseItem.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                    onClick={() => setSelectedCase(caseItem)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-slate-900">
                              {caseItem.driver_name || 'Bilinmeyen'}
                            </h3>
                            {caseItem.hasYesResponse && (
                              <Badge className="bg-green-100 text-green-800 text-xs border-green-200">
                                ✓ EVET
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(caseItem.created_date), 'dd MMM HH:mm', { locale: tr })}
                          </p>
                        </div>
                        <Badge className={getUrgencyColor(caseItem.aciliyet) + " text-xs"}>
                          {caseItem.aciliyet}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-700 line-clamp-2 mb-2">
                        {caseItem.sorun}
                      </p>

                      {caseItem.recentMessages && caseItem.recentMessages.length > 0 && (
                        <div className="bg-slate-50 rounded p-2 mb-2 space-y-1">
                          {caseItem.recentMessages.map((msg, idx) => (
                            <div key={idx} className="text-xs">
                              <span className={msg.sender === 'sürücü' ? 'text-blue-600 font-medium' : 'text-slate-600'}>
                                {msg.sender === 'sürücü' ? '👤 ' : '🤖 '}
                                {msg.message?.substring(0, 50)}{msg.message?.length > 50 ? '...' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {caseItem.messageCount} mesaj
                        </span>
                        <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:bg-blue-50 h-6 px-2">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Tümünü Gör
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}