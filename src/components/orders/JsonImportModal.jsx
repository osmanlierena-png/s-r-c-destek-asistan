import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, CheckCircle, XCircle, FileJson } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function JsonImportModal({ show, onClose, onSuccess }) {
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleClose = () => {
    setJsonInput('');
    setResult(null);
    onClose();
  };

  const handleImport = async () => {
    if (!jsonInput.trim()) { alert('Lütfen JSON verisi girin!'); return; }
    setIsImporting(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('importOrdersFromJson', { json_data: jsonInput });
      setResult(response.data);
      if (response.data.success) setTimeout(() => onSuccess(), 1000);
    } catch (error) {
      setResult({ success: false, message: error.message });
    }
    setIsImporting(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">📋 JSON İle Sipariş Yükle</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 text-sm">📝 JSON Formatı:</h3>
            <pre className="text-xs text-blue-800 bg-blue-100 p-3 rounded overflow-x-auto">{`[
  {
    "orderNo": "EzXXX",
    "pickupAddress": "123 Main St",
    "deliveryAddress": "456 Oak Ave",
    "pickupTime": "07:15 AM",
    "deliveryTime": "2/11/2026 7:45:00 AM",
    "tip": "12.57$",
    "price": "125.70$",
    "customerName": "John Doe"
  }
]`}</pre>
            <p className="text-xs text-blue-700 mt-2">💡 <strong>Not:</strong> Aynı orderNo + tarih kombinasyonuna sahip siparişler atlanır.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">JSON Verisi</label>
            <Textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} rows={12} className="font-mono text-xs" />
          </div>

          {result && (
            <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {result.success ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                <div className="flex-1">
                  <p className={`font-semibold mb-2 ${result.success ? 'text-green-900' : 'text-red-900'}`}>{result.success ? '✅ Başarılı' : '❌ Hata'}</p>
                  <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
                  {result.success && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-white rounded p-2 text-center border border-green-200"><p className="text-xs text-slate-600">Toplam</p><p className="text-lg font-bold">{result.total}</p></div>
                      <div className="bg-white rounded p-2 text-center border border-green-200"><p className="text-xs text-slate-600">Eklenen</p><p className="text-lg font-bold text-green-600">{result.added}</p></div>
                      <div className="bg-white rounded p-2 text-center border border-green-200"><p className="text-xs text-slate-600">Atlanan</p><p className="text-lg font-bold text-orange-600">{result.skipped}</p></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleClose} variant="outline" className="flex-1">İptal</Button>
            <Button onClick={handleImport} disabled={isImporting || !jsonInput.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />İmport Ediliyor...</> : <><FileJson className="w-4 h-4 mr-2" />İmport Et</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}