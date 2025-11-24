import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bot } from 'lucide-react';

export default function AIResponseRules({ rules, isLoading, onAddNew, onEdit, onDelete }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            AI Cevap Şablonları
          </CardTitle>
          <Button onClick={onAddNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kural Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-6">
          AI'nın farklı durum kategorilerine nasıl cevap vereceğini ve hangi bilgileri toplayacağını belirleyin.
        </p>
        
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Henüz kural eklenmemiş. İlk kuralınızı ekleyin.
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map(rule => (
              <Card key={rule.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{rule.category_name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.keywords.slice(0, 3).map(keyword => (
                          <Badge key={keyword} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {rule.keywords.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{rule.keywords.length - 3} daha
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(rule)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onDelete(rule)} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-600 space-y-2">
                    <p><strong>İlk Soru:</strong> {rule.initial_question}</p>
                    <p><strong>Bitiş:</strong> {rule.completion_message}</p>
                    <div>
                      <strong>Alınacak Bilgiler:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.required_info.map(info => (
                          <Badge key={info} variant="secondary" className="text-xs">
                            {info.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}