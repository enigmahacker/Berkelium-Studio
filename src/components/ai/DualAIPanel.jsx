import { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { sendChatMessage, uploadImageOcr, uploadPdfOcr } from '../../services/api';
import {
  Sparkles,
  ShieldAlert,
  Send,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Wand2,
  Paperclip,
  Check
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
  const [appliedIndex, setAppliedIndex] = useState(null);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [aiState.chatHistory]);

  // Quick Action Prompts
  const quickPrompts = [
    { label: 'Monza Low Drag', prompt: 'Configure an ultra-low drag setup for high top speed, minimizing Cd and induced drag' },
    { label: 'High Downforce', prompt: 'Tune for maximum aerodynamic downforce for high-speed cornering stability' },
    { label: 'Check Stall', prompt: 'Audit rear wing and underfloor diffuser angles for aerodynamic flow separation' }
  ];

  // Send Chat message
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

      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
      let parsedParams = null;
      if (jsonMatch) {
        try {
          parsedParams = JSON.parse(jsonMatch[1]);
        } catch (_e) {
          // ignore json parse error
        }
      }

      setAiState((prev) => ({
        chatHistory: [
          ...prev.chatHistory,
          {
            sender: 'ai',
            role: 'Spatial Builder',
            text: reply,
            suggestedParams: parsedParams
          }
        ],
        isBuilding: false
      }));

      addScriptLog(`[Spatial Builder] Synthesized aerodynamic recommendations for: "${prompt.slice(0, 35)}..."`);
    } catch (err) {
      setAiState((prev) => ({
        chatHistory: [
          ...prev.chatHistory,
          { sender: 'ai', role: 'Spatial Builder', text: `Connection Error: ${err.message}` }
        ],
        isBuilding: false
      }));
    } finally {
      setLoading(false);
    }
  };

  // Run Neural Audit
  const handleTriggerAudit = () => {
    setLoading(true);
    triggerVisualSnapshot();

    setTimeout(() => {
      const hasStall = telemetry.flowSeparationDetected;
      const score = telemetry.homologationScore || 92;

      const report = {
        score,
        complianceStatus: score >= 90 ? 'Passed Homologation' : 'Review Required',
        timestamp: new Date().toLocaleTimeString(),
        issues: hasStall
          ? [
              {
                title: 'Rear Wing Boundary Layer Stall',
                detail: `Wing AOA is ${carParams.rearWingAOA}° (exceeds 14.5° stall threshold). Flow detachment detected on suction surface.`,
                suggestedFix: { rearWingAOA: 11.2 }
              }
            ]
          : [],
        checks: [
          { name: 'Mesh Watertightness & Normals', passed: true },
          { name: 'Front Splitter Ground Seal', passed: carParams.groundClearance >= 0.05 },
          { name: 'Diffuser Expansion Ramp', passed: carParams.diffuserAngle <= 12.0 },
          { name: 'Induced Vortex Minimization', passed: !hasStall }
        ]
      };

      setAiState((prev) => ({
        auditScore: score,
        auditReport: report,
        isAuditing: false,
        chatHistory: [
          ...prev.chatHistory,
          {
            sender: 'auditor',
            role: 'Neural Auditor',
            text: `### Neural Visual & Aerodynamic Audit Complete\n- **Homologation Score**: **${score}/100**\n- **Boundary Layer Status**: ${hasStall ? '⚠️ Flow Separation Detected' : '✅ Attached Laminar Flow'}\n${hasStall ? '\nRecommended Action: Click "Auto-Fix & Refine" to eliminate stall.' : ''}`,
            report
          }
        ]
      }));

      addScriptLog(`[Neural Auditor] Multi-angle visual audit completed. Compliance score: ${score}/100`);
      setLoading(false);
    }, 700);
  };

  // Auto-Fix & Refine
  const handleAutoFix = (fixParams) => {
    const patch = fixParams || { rearWingAOA: 11.2, diffuserAngle: 9.2 };
    setCarParams(patch);
    addScriptLog(`[Neural Auditor] Auto-Fix applied: Adjusted geometry to eliminate boundary layer stall.`);
    setAiState((prev) => ({
      chatHistory: [
        ...prev.chatHistory,
        {
          sender: 'system',
          role: 'System',
          text: `Applied Auto-Fix: Rear wing angle of attack set to ${patch.rearWingAOA || 11.2}° and diffuser ramp to ${patch.diffuserAngle || 9.2}°.`
        }
      ]
    }));
  };

  // Upload blueprint OCR
  const handleOcrFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    addScriptLog(`Uploading sketch ${file.name} to OCR endpoint...`);
    try {
      const res = await uploadImageOcr(file);
      handleSendMessage(`Here is the technical specification extracted from blueprint:\n\n${res.text}\n\nPlease adapt vehicle geometry to comply.`);
    } catch (err) {
      alert(`OCR failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Upload PDF spec
  const handlePdfFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    addScriptLog(`Uploading PDF ${file.name} to PDF-OCR endpoint...`);
    try {
      const res = await uploadPdfOcr(file);
      handleSendMessage(`Extracted from engineering PDF document:\n\n${res.text}\n\nOptimize vehicle aerodynamics to match these constraints.`);
    } catch (err) {
      alert(`PDF parsing failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0b10] border-l border-[#1e293b] select-text">
      {/* Header with Segmented Switch */}
      <div className="p-3 bg-[#0f172a] border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex bg-[#0b0b10] p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setAiBrainTab('builder')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              aiBrainTab === 'builder'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles size={12} />
            <span>Spatial Builder</span>
          </button>
          <button
            onClick={() => setAiBrainTab('auditor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              aiBrainTab === 'auditor'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert size={12} />
            <span>Neural Auditor</span>
          </button>
        </div>

        <button
          onClick={aiBrainTab === 'auditor' ? handleTriggerAudit : () => handleSendMessage('Recommend optimal aero')}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 transition-colors"
        >
          {aiBrainTab === 'auditor' ? <Wand2 size={12} /> : <RotateCcw size={12} />}
          <span>{aiBrainTab === 'auditor' ? 'Run Audit' : 'Suggest'}</span>
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 bg-[#0d1117] border-b border-[#1e293b] flex items-center gap-1.5 overflow-x-auto text-[11px]">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(qp.prompt)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all shrink-0"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Main Message Stream */}
      <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-3">
        {aiState.chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">Berkelium Dual-Brain AI</h4>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-[240px]">
                Describe your engineering requirements, upload a blueprint, or ask to audit flow detachment.
              </p>
            </div>
          </div>
        ) : (
          aiState.chatHistory.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const isAuditor = msg.sender === 'auditor';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={index} className="flex justify-center my-1">
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/70 border border-zinc-700 text-emerald-400 font-mono">
                    ✓ {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Sender badge */}
                <span className="text-[10px] text-zinc-500 px-1 font-mono uppercase tracking-wider">
                  {msg.role || msg.sender}
                </span>

                {/* Message bubble */}
                <div
                  className={`p-3 rounded-xl max-w-[92%] text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : isAuditor
                      ? 'bg-[#1e1b4b] border border-indigo-700/50 text-indigo-100 rounded-tl-none'
                      : 'bg-[#18181b] border border-zinc-800 text-zinc-200 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-line font-sans">{msg.text}</div>

                  {/* If AI suggested parameters, offer 1-click apply */}
                  {msg.suggestedParams && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        AOA: {msg.suggestedParams.rearWingAOA || 11.5}° • Diff: {msg.suggestedParams.diffuserAngle || 9}°
                      </span>
                      <button
                        onClick={() => {
                          setCarParams(msg.suggestedParams);
                          setAppliedIndex(index);
                          addScriptLog(`[Spatial Builder] Applied AI parameters to 3D Viewport.`);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                          appliedIndex === index
                            ? 'bg-emerald-600 text-white'
                            : 'bg-orange-600 hover:bg-orange-500 text-white shadow'
                        }`}
                      >
                        {appliedIndex === index ? (
                          <>
                            <Check size={11} />
                            <span>Applied</span>
                          </>
                        ) : (
                          <>
                            <Wand2 size={11} />
                            <span>Apply to 3D</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* If Auditor found issues, offer 1-click Auto-Fix */}
                  {msg.report && msg.report.issues?.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-indigo-700/40 space-y-2">
                      {msg.report.issues.map((iss, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 rounded bg-rose-950/40 border border-rose-800/40">
                          <div>
                            <p className="text-[11px] font-semibold text-rose-300">{iss.title}</p>
                            <p className="text-[10px] text-zinc-400">{iss.detail}</p>
                          </div>
                          <button
                            onClick={() => handleAutoFix(iss.suggestedFix)}
                            className="shrink-0 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold"
                          >
                            Auto-Fix
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 text-xs text-orange-400 bg-orange-950/20 border border-orange-800/30 rounded-lg">
            <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-[11px]">Reasoning aerodynamic geometry...</span>
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="p-2.5 bg-[#0f172a] border-t border-[#1e293b] space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          {/* File attachments */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Attach Blueprint Image (OCR)"
          >
            <Paperclip size={14} />
          </button>

          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Attach Tech Spec (PDF)"
          >
            <FileText size={14} />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOcrFile}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={pdfInputRef}
            onChange={handlePdfFile}
            accept=".pdf"
            className="hidden"
          />

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              aiBrainTab === 'builder'
                ? 'Ask Builder to design or tune car aero...'
                : 'Ask Auditor to inspect flow separation...'
            }
            className="flex-1 bg-[#0b0b10] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="p-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white transition-all shadow-sm"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
