import React from "react";

export default function ThreeLayerResultsModal({ results, onClose }) {
  if (!results) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">🎯 3 Katmanlı Atama Sonuçları</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Kalite Skoru</span>
              <span className="text-3xl font-bold text-purple-600">{results.quality_score}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                style={{ width: `${results.quality_score}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="font-semibold mb-2">1️⃣ Parser LLM</div>
              <p className="text-sm text-slate-600">{results.layer1_summary}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="font-semibold mb-2">2️⃣ Assignment LLM</div>
              <p className="text-sm text-slate-600">{results.layer2_summary}</p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <div className="font-semibold mb-2">3️⃣ Supervisor LLM</div>
              <p className="text-sm text-slate-600">{results.layer3_summary}</p>
            </div>
          </div>

          {results.violations && results.violations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-lg">⚠️ Tespit Edilen İhlaller ({results.violations.length})</h3>
              {results.violations.map((v, i) => (
                <div
                  key={i}
                  className={`border-l-4 p-4 rounded ${
                    v.severity === 'critical' ? 'border-red-500 bg-red-50' :
                    v.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                    v.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{v.order_id} → {v.driver_name}</div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      v.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                      v.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {v.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{v.description}</p>
                  <div className="text-xs text-slate-600">💡 <strong>Öneri:</strong> {v.recommendation}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-bold text-lg">📋 Atamalar ({results.assignedCount})</h3>
            {results.assignments.map((a, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-blue-600">{a.order_id} → {a.driver_name}</div>
                  <div className="text-xs text-slate-500">{a.driver_phone}</div>
                </div>
                <div className="text-sm space-y-1">
                  <div>🔵 Pickup: {a.pickup_time} - {a.pickup_address}</div>
                  <div>🟢 Dropoff: {a.dropoff_time} - {a.dropoff_address}</div>
                  <div className="text-slate-600 italic mt-2">💭 {a.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}