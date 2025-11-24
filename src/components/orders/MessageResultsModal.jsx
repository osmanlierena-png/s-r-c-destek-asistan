import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';

export default function MessageResultsModal({ results, onClose }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-500" />
            Mesaj Gönderim Sonuçları
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4 text-center">
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Gönderildi</p>
            <p className="text-2xl font-bold text-green-700">{results.sent.length}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">Başarısız</p>
            <p className="text-2xl font-bold text-red-700">{results.failed.length}</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-600">Atlandı</p>
            <p className="text-2xl font-bold text-yellow-700">{results.skipped?.length || 0}</p>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-lg p-4">
          <div className="space-y-4">
            
            {/* Başarılı Gönderimler */}
            {results.sent.length > 0 && (
              <div>
                <h3 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Başarıyla Gönderildi ({results.sent.length})
                </h3>
                {results.sent.map((item, index) => (
                  <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">{item.driver}</p>
                        {item.order && <p className="text-sm text-slate-600">Sipariş #{item.order}</p>}
                        {item.orderCount && <p className="text-sm text-slate-600">{item.orderCount} sipariş</p>}
                        <p className="text-xs text-slate-500">{item.phone}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">✓ Gönderildi</Badge>
                    </div>
                    {item.message && (
                      <p className="text-xs text-slate-600 mt-2 bg-white p-2 rounded border">
                        {item.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Başarısız Gönderimler */}
            {results.failed.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Başarısız ({results.failed.length})
                </h3>
                {results.failed.map((item, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">{item.driver || 'Bilinmiyor'}</p>
                        {item.order && <p className="text-sm text-slate-600">Sipariş #{item.order}</p>}
                      </div>
                      <Badge className="bg-red-100 text-red-800">✗ Hata</Badge>
                    </div>
                    <p className="text-xs text-red-600 mt-2">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Atlanan Gönderimler */}
            {results.skipped && results.skipped.length > 0 && (
              <div>
                <h3 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Atlandı ({results.skipped.length})
                </h3>
                {results.skipped.map((item, index) => (
                  <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">{item.driver}</p>
                        <p className="text-sm text-slate-600">Sipariş #{item.order}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">⊘ Atlandı</Badge>
                    </div>
                    <p className="text-xs text-yellow-600 mt-2">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 mt-4">
          <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}