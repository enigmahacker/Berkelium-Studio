import React, { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { sendChatMessage, uploadImageOcr, uploadPdfOcr } from '../../services/api';
import { 
  Sparkles, 
  ShieldAlert, 
  Send, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Wand2, 
  Activity, 
  Layers, 
  Camera, 
  Check, 
  ArrowRight,
  Maximize2
} from 'lucide-react';

export default function DualAIPanel() {
  const {
    aiState,
    setAiState,
    carParams,
    setCarParams,
    telemetry,
    triggerVisualSnapshot,
    capturedSnapshots,
    addScriptLog
  } = useStudioStore();

  const [aiBrainTab, setAiBrainTab] = useState('builder'); // 'builder' | 'auditor'
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSnapshotModal, setActiveSnapshotModal] = useState(null);
  const chatScrollRef = useRef(null);
  const ocrInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [aiState.chatHistory]);

  // Handle Chat Submission to Spatial Builder
  const handleSendMessage = async (textToSend) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim() || loading) return;

    setInputText('');
    setLoading(true);

    const newHistory = [
      ...aiState.chatHistory,
      { sender: 'user', role: 'Engineer', text: prompt }
    ];

    setAiState({ chatHistory: newHistory, isBuilding: true });

    try {
      const result = await sendChatMessage(prompt, carParams);
      const reply = result.response;

      // Check if reply has JSON car parameters block to auto-suggest
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
      let parsedParams = null;
      if (jsonMatch) {
        try {
          parsedParams = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.warn('Could not parse JSON from AI response', e);
        }
      }

      setAiState((prev) => ({
        isBuilding: false,
        chatHistory: [
          ...prev.chatHistory,
          {
            sender: 'ai',
            role: 'Spatial Builder',
            text: reply,
            suggestedParams: parsedParams
          }
        ]
      }));

      // Automatically apply suggested parameters if available
      if (parsedParams) {
        setCarParams(parsedParams);
        addScriptLog(`[Spatial Builder] Auto-applied AI geometric parameters: ${JSON.stringify(parsedParams)}`);
      }
    } catch (err) {
      setAiState({ isBuilding: false });
    } finally {
      setLoading(false);
    }
  };

  // OCR Blueprint upload
  const handleOcrFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setAiState({ isBuilding: true });

    try {
      const res = await uploadImageOcr(file);
      setAiState((prev) => ({
        isBuilding: false,
        chatHistory: [
          ...prev.chatHistory,
          { sender: 'user', role: 'Engineer', text: `Uploaded CAD Blueprint: ${file.name}` },
          { sender: 'ai', role: 'Spatial Builder', text: `Extracted CAD blueprint specifications:\n${res.text}` }
        ]
      }));
    } catch (err) {
      setAiState({ isBuilding: false });
    } finally {
      setLoading(false);
    }
  };

  // Trigger Multi-Angle Visual Capture & Audit
  const handleTriggerAudit = () => {
    setAiState({ isAuditing: true });
    triggerVisualSnapshot();

    setTimeout(() => {
      // Calculate audit score based on stall & parameters
      let score = 95;
      if (carParams.rearWingAOA > 14.5) score -= 18;
      if (carParams.diffuserAngle > 12.0) score -= 14;
      if (carParams.groundClearance < 0.05) score -= 8;

      setAiState({
        isAuditing: false,
        auditScore: Math.max(45, score),
        auditReport: {
          timestamp: new Date().toLocaleTimeString(),
          stabilityScore: score > 80 ? 'Optimal (High-G Cohesive)' : 'Degraded (Turbulent)',
          watertight: '100% Manifold Mesh',
          liftToDrag: telemetry.liftToDragRatio
        }
      });
      addScriptLog(`[Neural Auditor] Multi-angle visual inspection complete. Homologation Score: ${score}%`);
    }, 1500);
  };

  // One-Click "Auto-Fix & Refine"
  const handleAutoFix = () => {
    setLoading(true);
    setAiState({ isAuditing: true });

    setTimeout(() => {
      // Correct parameters to optimal laminar aerodynamic envelope
      const refinedParams = {
        rearWingAOA: 11.2,
        diffuserAngle: 9.5,
        splitterLength: 0.28,
        groundClearance: 0.075
      };

      setCarParams(refinedParams);

      setAiState((prev) => ({
        isAuditing: false,
        auditScore: 98,
        defectPins: [],
        chatHistory: [
          ...prev.chatHistory,
          {
            sender: 'ai',
            role: 'Neural Auditor',
            text: 'One-Click Auto-Refine Applied: Rear wing AOA corrected to 11.2° (eliminates stall). Diffuser ramp set to 9.5° for attached boundary layer recovery. Homologation score upgraded to 98%.'
          }
        ]
      }));

      addScriptLog('[Neural Auditor] Applied Auto-Fix & Refine. All boundary layer detachments eliminated.');
      setLoading(false);
    }, 1000);
  };

  const samplePrompts = [
    'Monza low-drag setup',
    'High downforce endurance kit',
    'Fix boundary layer stall',
    'Tune diffuser for ground effect'
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 text-xs select-none">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={ocrInputRef}
        onChange={handleOcrFile}
        accept="image/*"
        className="hidden"
      />

      {/* Dual AI Header Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/60 p-1">
        <button
          onClick={() => setAiBrainTab('builder')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition-all ${
            aiBrainTab === 'builder'
              ? 'bg-orange-500 text-white font-semibold shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles size={13} />
          <span>Spatial Builder</span>
        </button>

        <button
          onClick={() => setAiBrainTab('auditor')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition-all ${
            aiBrainTab === 'auditor'
              ? 'bg-amber-500 text-white font-semibold shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldAlert size={13} />
          <span>Neural Auditor</span>
          {aiState.defectPins.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
              {aiState.defectPins.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SPATIAL BUILDER */}
      {aiBrainTab === 'builder' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages */}
          <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
            {aiState.chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg text-[11px] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-100 ml-4'
                    : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200 mr-2 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-1 font-mono text-[10px] text-zinc-400">
                  <span className="font-semibold text-orange-400">{msg.role}</span>
                  <span>{msg.sender === 'user' ? 'You' : 'Model'}</span>
                </div>
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Suggested parameters action */}
                {msg.suggestedParams && (
                  <button
                    onClick={() => setCarParams(msg.suggestedParams)}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-orange-600/90 hover:bg-orange-500 text-white rounded text-[10px] font-semibold transition-all"
                  >
                    <Check size={11} />
                    <span>Apply Parameters to 3D Model</span>
                  </button>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono p-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span>Synthesizing aerodynamic geometry...</span>
              </div>
            )}
          </div>

          {/* Prompt Suggestion Chips */}
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-zinc-800/80 custom-scrollbar">
            {samplePrompts.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-2 border-t border-zinc-800 bg-zinc-900/80 flex items-center gap-1.5">
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 rounded"
              title="Upload CAD Blueprint OCR"
            >
              <FileText size={15} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Spatial Builder (e.g. 'Optimize wing for Le Mans')..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-orange-500"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputText.trim()}
              className="p-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded transition-all"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: NEURAL RENDERING AUDITOR */}
      {aiBrainTab === 'auditor' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Audit Action Header */}
          <div className="flex items-center justify-between">
            <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Camera size={14} className="text-amber-400" />
              <span>Multi-Angle Visual Audit</span>
            </div>
            <button
              onClick={handleTriggerAudit}
              disabled={aiState.isAuditing}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold text-xs shadow transition-all active:scale-95"
            >
              <RotateCcw size={12} className={aiState.isAuditing ? 'animate-spin' : ''} />
              <span>{aiState.isAuditing ? 'Auditing...' : 'Run Audit'}</span>
            </button>
          </div>

          {/* Visual Captures Gallery (4-angles) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Neural Inspection Views
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'persp', label: 'Perspective View' },
                { key: 'top', label: 'Top Aero Deck' },
                { key: 'side', label: 'Side Profile' },
                { key: 'front', label: 'Front Stagnation' }
              ].map(({ key, label }) => (
                <div
                  key={key}
                  onClick={() => capturedSnapshots[key] && setActiveSnapshotModal(capturedSnapshots[key])}
                  className="relative aspect-video bg-zinc-900 rounded border border-zinc-800 overflow-hidden cursor-pointer group"
                >
                  {capturedSnapshots[key] ? (
                    <img
                      src={capturedSnapshots[key]}
                      alt={label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[10px]">
                      <Camera size={16} className="mb-1 opacity-50" />
                      <span>{label}</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1.5 px-1 bg-zinc-950/80 text-[9px] font-mono text-zinc-400 rounded">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scorecard */}
          <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">
                Homologation Compliance
              </span>
              <span
                className={`font-mono font-bold text-sm ${
                  aiState.auditScore >= 90
                    ? 'text-emerald-400'
                    : aiState.auditScore >= 75
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {aiState.auditScore}%
              </span>
            </div>

            {/* Score Progress Bar */}
            <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  aiState.auditScore >= 90
                    ? 'bg-emerald-500'
                    : aiState.auditScore >= 75
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${aiState.auditScore}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
              <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block">Stability Index</span>
                <span className="text-zinc-200 font-bold">
                  {aiState.auditReport?.stabilityScore || '89% (Stable)'}
                </span>
              </div>
              <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block">Mesh Watertight</span>
                <span className="text-emerald-400 font-bold">100% Manifold</span>
              </div>
            </div>
          </div>

          {/* Detected Defects List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">
                Detected Aerodynamic Defects ({aiState.defectPins.length})
              </span>
            </div>

            {aiState.defectPins.length === 0 ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Zero critical aerodynamic defects detected. High flow adherence.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {aiState.defectPins.map((pin) => (
                  <div
                    key={pin.id}
                    className="p-2 rounded bg-zinc-900 border border-red-500/40 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{pin.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug">{pin.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* One-Click Auto-Fix & Refine */}
          <button
            onClick={handleAutoFix}
            disabled={loading || aiState.defectPins.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 text-white rounded font-bold text-xs shadow-lg transition-all active:scale-98"
          >
            <Wand2 size={14} />
            <span>Auto-Fix & Refine Aero Balance</span>
          </button>
        </div>
      )}

      {/* Snapshot Enlarge Modal */}
      {activeSnapshotModal && (
        <div
          onClick={() => setActiveSnapshotModal(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden shadow-2xl"
          >
            <img src={activeSnapshotModal} alt="Capture" className="w-full block" />
            <button
              onClick={() => setActiveSnapshotModal(null)}
              className="absolute top-2 right-2 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
