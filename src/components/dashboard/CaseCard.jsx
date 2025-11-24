import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Clock, 
  MessageSquare,
  Truck,
  Package,
  Wrench,
  WifiOff
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function CaseCard({ caseItem, onViewDetails }) {
  const getUrgencyColor = (urgency) => {
    const colors = {
      'Acil': 'bg-red-100 text-red-800 border-red-200',
      'Yüksek': 'bg-orange-100 text-orange-800 border-orange-200',
      'Orta': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Düşük': 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      "Lojistik & Ulaşım": <Truck className="w-5 h-5" />,
      "Ürünle İlgili": <Package className="w-5 h-5" />,
      "Kurye Kaynaklı": <User className="w-5 h-5" />,
      "Teknolojik / Sistemsel": <WifiOff className="w-5 h-5" />,
    };
    return icons[category] || <Wrench className="w-5 h-5" />;
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-slate-200/50 bg-white/80 backdrop-blur-sm flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg flex items-center justify-center text-white">
              {getCategoryIcon(caseItem.kategori)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate">
                  {caseItem.driver_name || 'Bilinmeyen Sürücü'}
                </h3>
                {caseItem.hasYesResponse && (
                  <Badge className="bg-green-100 text-green-800 text-xs border-green-200">
                    ✓ OK
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(caseItem.created_date), 'dd MMM HH:mm', { locale: tr })}
              </p>
            </div>
          </div>
          <Badge className={`border text-xs ${getUrgencyColor(caseItem.aciliyet)}`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            {caseItem.aciliyet}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 flex flex-col justify-between">
        <div>
            <p className="text-sm text-slate-700 mb-3 line-clamp-2 font-medium">
            {caseItem.sorun}
            </p>
            {caseItem.konum && (
                <span className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                <MapPin className="w-3 h-3" />
                {caseItem.konum}
                </span>
            )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <Badge variant="outline" className="text-xs">
            {caseItem.kategori}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(caseItem)}
            className="text-xs hover:bg-blue-50 hover:text-blue-700"
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Detaylar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}