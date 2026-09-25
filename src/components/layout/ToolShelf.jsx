import { useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { 
  MousePointer, 
  Target, 
  Move, 
  RotateCw, 
  Scaling, 
  Ruler, 
  Wind, 
  Gauge 
} from 'lucide-react';

const tools = [
  { id: 'select', name: 'Select Box', shortcut: 'B', icon: MousePointer },
  { id: 'cursor', name: '3D Cursor', shortcut: 'C', icon: Target },
  { id: 'translate', name: 'Translate / Move', shortcut: 'G', icon: Move },
  { id: 'rotate', name: 'Rotate', shortcut: 'R', icon: RotateCw },
  { id: 'scale', name: 'Scale', shortcut: 'S', icon: Scaling },
  { id: 'measure', name: 'Ruler / Measure', shortcut: 'M', icon: Ruler },
  { id: 'streamline', name: 'Streamline Emitter', shortcut: 'E', icon: Wind },
  { id: 'probe', name: 'Aero Pressure Probe', shortcut: 'P', icon: Gauge }
];

export default function ToolShelf() {
  const { activeTool, setActiveTool } = useStudioStore();

  // Global hotkeys for Blender tools
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or monaco editor
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.closest('.monaco-editor')) return;

      const key = e.key.toUpperCase();
      const match = tools.find((t) => t.shortcut === key);
      if (match) {
        setActiveTool(match.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  return (
    <aside className="w-11 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-2 gap-1.5 select-none z-30">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.name} (${tool.shortcut})`}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all relative group ${
              isActive
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
            }`}
          >
            <Icon size={16} />

            {/* Hover Tooltip */}
            <div className="absolute left-10 hidden group-hover:flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700 text-zinc-100 text-[11px] rounded shadow-xl whitespace-nowrap pointer-events-none z-50">
              <span>{tool.name}</span>
              <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-[9px] font-mono text-orange-400">
                {tool.shortcut}
              </kbd>
            </div>
          </button>
        );
      })}

      <div className="w-6 border-t border-zinc-800 my-1" />

      {/* Streamline Smoke Toggle Quick Button */}
      <button
        onClick={() => setWindTunnelParams({ smokeRake: !windTunnelParams.smokeRake })}
        title={windTunnelParams.smokeRake ? 'Disable Smoke Rake' : 'Enable Smoke Rake'}
        className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
          windTunnelParams.smokeRake ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30' : 'text-zinc-600'
        }`}
      >
        <Wind size={15} />
      </button>
    </aside>
  );
}
