import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bot, Phone, ChevronDown, ChevronUp, Download } from "lucide-react";
import AIResponseRules from "../components/settings/AIResponseRules";
import MessageTemplates from "../components/settings/MessageTemplates";
import MessageMonitoring from "../components/settings/MessageMonitoring";
import CronJobMonitoring from "../components/settings/CronJobMonitoring";
import OrderApprovalMonitor from "../components/settings/OrderApprovalMonitor";
import RuleForm from "../components/settings/RuleForm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [twilioPhone, setTwilioPhone] = useState(
    localStorage.getItem('twilio_phone') || ''
  );
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    cronJob: true,
    orderApproval: false,
    messageTemplates: false,
    messageMonitoring: false,
    twilioSettings: false,
    topDasherExport: false,
    aiRules: false
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.AIResponseRule.list();
      setRules(data);
    } catch (error) {
      console.error('Kurallar yüklenemedi:', error);
    }
    setIsLoading(false);
  };

  const handleAddRule = () => {
    setEditingRule(null);
    setShowRuleForm(true);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowRuleForm(true);
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Bu kuralı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await base44.entities.AIResponseRule.delete(ruleId);
      loadRules();
    } catch (error) {
      console.error('Kural silinemedi:', error);
      alert('Kural silinemedi: ' + error.message);
    }
  };

  const handleSaveRule = async () => {
    await loadRules();
    setShowRuleForm(false);
    setEditingRule(null);
  };

  const handleSaveTwilioPhone = () => {
    localStorage.setItem('twilio_phone', twilioPhone);
    alert('✅ Twilio telefon numarası kaydedildi!\n\nBu numara SMS gönderimlerinde kullanılacak.');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const CollapsibleSection = ({ title, description, isExpanded, onToggle, children, badge }) => (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-lg">
      <CardHeader 
        className="cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{title}</CardTitle>
              {badge && badge}
            </div>
            {description && (
              <p className="text-sm text-slate-500 mt-1">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent>{children}</CardContent>}
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Ayarlar</h1>
          <p className="text-slate-600">Sistem ayarlarını ve kurallarını yönetin</p>
        </div>

        <CollapsibleSection
          title="🧪 Cron Job Test & Monitoring"
          description="Zamanlanmış mesaj sistemini test edin"
          isExpanded={expandedSections.cronJob}
          onToggle={() => toggleSection('cronJob')}
        >
          <CronJobMonitoring />
        </CollapsibleSection>

        <CollapsibleSection
          title="📊 Sipariş Onay Durumu Kontrolü"
          description="Hangi siparişlerin mesaj alacağını kontrol edin"
          isExpanded={expandedSections.orderApproval}
          onToggle={() => toggleSection('orderApproval')}
        >
          {expandedSections.orderApproval && <OrderApprovalMonitor />}
        </CollapsibleSection>

        <CollapsibleSection
          title="💬 Mesaj Şablonları"
          description="Otomatik mesaj şablonlarını düzenleyin"
          isExpanded={expandedSections.messageTemplates}
          onToggle={() => toggleSection('messageTemplates')}
        >
          {expandedSections.messageTemplates && <MessageTemplates />}
        </CollapsibleSection>

        <CollapsibleSection
          title="📊 Mesaj İzleme ve Raporlama"
          description="Gönderilen mesajların durumunu ve istatistiklerini izleyin"
          isExpanded={expandedSections.messageMonitoring}
          onToggle={() => toggleSection('messageMonitoring')}
        >
          {expandedSections.messageMonitoring && <MessageMonitoring />}
        </CollapsibleSection>

        <CollapsibleSection
          title="📞 Twilio SMS Ayarları"
          description="SMS gönderimleri için telefon numarası"
          isExpanded={expandedSections.twilioSettings}
          onToggle={() => toggleSection('twilioSettings')}
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="+1234567890"
                value={twilioPhone}
                onChange={(e) => setTwilioPhone(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveTwilioPhone}
                className="bg-green-600 hover:bg-green-700"
              >
                Kaydet
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Not: Twilio hesabınıza kayıtlı ve doğrulanmış bir numara olmalıdır.
            </p>
          </div>
        </CollapsibleSection>



        <CollapsibleSection
          title="🤖 AI Yanıt Kuralları"
          description="Otomatik yanıt kurallarını yönetin"
          isExpanded={expandedSections.aiRules}
          onToggle={() => toggleSection('aiRules')}
        >
          {expandedSections.aiRules && (
            <AIResponseRules
              rules={rules}
              isLoading={isLoading}
              onAddRule={handleAddRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
            />
          )}
        </CollapsibleSection>

        {showRuleForm && (
          <RuleForm
            rule={editingRule}
            onClose={() => {
              setShowRuleForm(false);
              setEditingRule(null);
            }}
            onSave={handleSaveRule}
          />
        )}
      </div>
    </div>
  );
}