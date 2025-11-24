import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, AlertCircle, FileImage } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ScreenshotUpload({ selectedDate, onClose, onSuccess }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // 🔧 BÜYÜK HARF UZANTIYI KÜÇÜK HARFE ÇEVİR
    const normalizedFiles = files.map(file => {
      // Eğer uzantı büyük harfse, File objesini yeniden oluştur
      if (/\.(JPG|JPEG|PNG|GIF|WEBP)$/.test(file.name)) {
        const newName = file.name.replace(/\.(JPG|JPEG|PNG|GIF|WEBP)$/, (match) => match.toLowerCase());
        return new File([file], newName, { type: file.type });
      }
      return file;
    });
    
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    const invalidFiles = normalizedFiles.filter(f => {
      const isValidType = validImageTypes.includes(f.type.toLowerCase()) || 
                         /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
      const isValidSize = f.size <= 5 * 1024 * 1024;
      return !isValidType || !isValidSize;
    });
    
    if (invalidFiles.length > 0) {
      const sizeIssues = invalidFiles.filter(f => f.size > 5 * 1024 * 1024);
      const typeIssues = invalidFiles.filter(f => f.size <= 5 * 1024 * 1024);
      
      let errorMsg = '';
      if (sizeIssues.length > 0) {
        errorMsg += `${sizeIssues.length} dosya çok büyük (max 5MB)\n`;
      }
      if (typeIssues.length > 0) {
        errorMsg += `${typeIssues.length} dosya geçersiz format (sadece JPG, PNG, GIF, WebP)`;
      }
      
      alert(errorMsg);
      return;
    }
    
    setSelectedFiles(normalizedFiles);
    setResults(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    const allOrders = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        setProgress(`${i+1}/${selectedFiles.length}: Uploading...`);
        
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        
        setProgress(`${i+1}/${selectedFiles.length}: Parsing...`);
        
        const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: uploadRes.file_url,
          json_schema: {
            type: "object",
            properties: {
              orders: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pickup_address: { type: "string" },
                    dropoff_address: { type: "string" },
                    pickup_time: { type: "string" },
                    dropoff_time: { type: "string" }
                  }
                }
              }
            }
          }
        });

        if (extractRes.status === 'success' && extractRes.output?.orders) {
          extractRes.output.orders.forEach((o, idx) => {
            allOrders.push({
              order_id: `SS${Date.now()}_${i}_${idx}`,
              customer_name: 'Screenshot Upload',
              pickup_address: o.pickup_address,
              pickup_time: o.pickup_time,
              dropoff_address: o.dropoff_address,
              dropoff_time: o.dropoff_time
            });
          });
        }
      }

      if (allOrders.length > 0) {
        setProgress('Saving...');
        
        const existing = await base44.entities.DailyOrder.filter({ order_date: selectedDate });
        const existingIds = existing.map(o => o.ezcater_order_id);
        
        const newOrders = allOrders
          .filter(o => !existingIds.includes(o.order_id))
          .map(o => ({
            ezcater_order_id: o.order_id,
            order_date: selectedDate,
            pickup_address: o.pickup_address,
            pickup_time: o.pickup_time,
            dropoff_address: o.dropoff_address,
            dropoff_time: o.dropoff_time,
            customer_name: o.customer_name,
            status: 'Çekildi'
          }));

        if (newOrders.length > 0) {
          for (let i = 0; i < newOrders.length; i += 5) {
            const batch = newOrders.slice(i, i + 5);
            await base44.entities.DailyOrder.bulkCreate(batch);
            if (i + 5 < newOrders.length) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }

        setResults({
          success: true,
          totalOrders: allOrders.length,
          newOrders: newOrders.length
        });
      } else {
        setResults({ success: false, message: 'No orders found' });
      }

    } catch (error) {
      setResults({ success: false, message: error.message });
    }

    setIsProcessing(false);
    setProgress(null);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" />
            Screenshot Upload
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <input
              type="file"
              id="screenshot-input"
              multiple
              accept="image/*,.jpg,.jpeg,.JPG,.JPEG,.png,.PNG,.gif,.GIF,.webp,.WEBP"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <label htmlFor="screenshot-input" className="cursor-pointer flex flex-col items-center gap-2">
              <FileImage className="w-12 h-12 text-slate-400" />
              <p className="text-sm text-slate-600">Select screenshots</p>
              <p className="text-xs text-slate-500">PNG, JPG, GIF, WebP • Max 5MB/file</p>
            </label>
          </div>

          {selectedFiles.length > 0 && !isProcessing && (
            <div className="text-sm text-slate-700">
              {selectedFiles.length} file(s) selected
            </div>
          )}

          {progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-900">{progress}</p>
            </div>
          )}

          {results && (
            <div className={`p-4 rounded-lg ${results.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-3">
                {results.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <p className={`font-medium ${results.success ? 'text-green-900' : 'text-red-900'}`}>
                    {results.success ? '✅ Success!' : '❌ Error'}
                  </p>
                  {results.success && (
                    <div className="mt-2 text-sm text-green-800">
                      <p>• {results.totalOrders} orders found</p>
                      <p>• {results.newOrders} new orders added</p>
                    </div>
                  )}
                  {!results.success && (
                    <p className="mt-1 text-sm text-red-700">{results.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              {results?.success ? 'Close' : 'Cancel'}
            </Button>
            {!results?.success && (
              <Button 
                onClick={handleUpload}
                disabled={isProcessing || selectedFiles.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            )}
            {results?.success && (
              <Button onClick={onSuccess} className="bg-green-600 hover:bg-green-700">
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}