import React, { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { 
  Folder, 
  FolderOpen, 
  Box, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  ChevronRight, 
  ChevronDown, 
  Search,
  Sun,
  Wind,
  ShieldAlert,
  Layers
} from 'lucide-react';

export default function Outliner() {
  const {
    selectedObjectId,
    setSelectedObjectId,
    sceneVisibility,
    toggleSceneVisibility,
    sceneLocks,
    toggleSceneLock
  } = useStudioStore();

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({
    world: false,
    windTunnel: false,
    carAssembly: false,
    auditPins: false
  });

  const toggleCollapse = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sceneTree = [
    {
      id: 'World',
      name: 'World & Lighting',
      icon: Sun,
      visKey: 'worldLighting',
      lockKey: 'worldLighting',
      children: [
        { id: 'KeyLight', name: 'Key Sun Light (5600K)', icon: Sun },
        { id: 'FillLight', name: 'Fill Sky Light (Cool)', icon: Sun },
        { id: 'RimLight', name: 'Aero Rim Light', icon: Sun }
      ]
    },
    {
      id: 'WindTunnel',
      name: 'Wind Tunnel Chamber',
      icon: Wind,
      visKey: 'windTunnel',
      lockKey: 'windTunnel',
      children: [
        { id: 'NozzleInlet', name: 'Nozzle Air Contraction', icon: Wind },
        { id: 'GlassChamber', name: 'Aero Test Section Glass', icon: Box },
        { id: 'Streamlines', name: 'Streamline Rake (3000 pts)', icon: Wind, visKey: 'streamlines' }
      ]
    },
    {
      id: 'CarAssembly',
      name: 'LMP1 Hypercar Monocoque',
      icon: Box,
      visKey: 'carAssembly',
      lockKey: 'carAssembly',
      children: [
        { id: 'Chassis', name: 'Carbon Monocoque Tub', icon: Box, visKey: 'chassis' },
        { id: 'Cockpit', name: 'Canopy Bubble & Shark Fin', icon: Box, visKey: 'cockpit' },
        { id: 'Splitter', name: 'Front Splitter & Dive Canards', icon: Box, visKey: 'splitter' },
        { id: 'Diffuser', name: 'Venturi Diffuser Floor', icon: Box, visKey: 'diffuser' },
        { id: 'RearWing', name: 'Dual-Element Rear Wing', icon: Box, visKey: 'rearWing' },
        { id: 'Wheels', name: 'Forged Wheels & Aero Discs', icon: Box, visKey: 'wheels' }
      ]
    },
    {
      id: 'AuditPins',
      name: 'Neural Audit Markers',
      icon: ShieldAlert,
      visKey: 'auditPins',
      lockKey: 'auditPins',
      children: [
        { id: 'PinStall', name: 'Wing Boundary Layer Detachment', icon: ShieldAlert },
        { id: 'PinDiffuser', name: 'Diffuser Adverse Expansion', icon: ShieldAlert }
      ]
    }
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-b border-zinc-800 text-xs select-none">
      {/* Header & Filter */}
      <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <Layers size={14} className="text-orange-400" />
          <span>Outliner</span>
        </div>

        {/* Filter input */}
        <div className="relative w-36">
          <Search size={11} className="absolute left-1.5 top-1.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter scene..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded pl-5 pr-1.5 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1 font-mono text-[11px] space-y-0.5 custom-scrollbar">
        {sceneTree.map((group) => {
          const isGroupCollapsed = collapsed[group.id.toLowerCase()];
          const GroupIcon = group.icon;
          const isSelected = selectedObjectId === group.id;
          const isVisible = sceneVisibility[group.visKey] !== false;
          const isLocked = sceneLocks[group.lockKey] === true;

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Row */}
              <div
                onClick={() => setSelectedObjectId(group.id)}
                className={`flex items-center justify-between px-1.5 py-1 rounded cursor-pointer transition-colors ${
                  isSelected ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(group.id.toLowerCase());
                    }}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <GroupIcon size={13} className="text-orange-400 shrink-0" />
                  <span className="truncate font-sans font-medium text-xs">{group.name}</span>
                </div>

                {/* Visibility & Lock toggles */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (group.visKey) toggleSceneVisibility(group.visKey);
                    }}
                    className="p-0.5 text-zinc-500 hover:text-zinc-200"
                  >
                    {isVisible ? <Eye size={12} /> : <EyeOff size={12} className="text-zinc-600" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (group.lockKey) toggleSceneLock(group.lockKey);
                    }}
                    className="p-0.5 text-zinc-500 hover:text-zinc-200"
                  >
                    {isLocked ? <Lock size={12} className="text-amber-500" /> : <Unlock size={12} />}
                  </button>
                </div>
              </div>

              {/* Children Rows */}
              {!isGroupCollapsed &&
                group.children
                  .filter((child) => child.name.toLowerCase().includes(search.toLowerCase()))
                  .map((child) => {
                    const ChildIcon = child.icon;
                    const isChildSelected = selectedObjectId === child.id;
                    const isChildVis = child.visKey ? sceneVisibility[child.visKey] !== false : true;

                    return (
                      <div
                        key={child.id}
                        onClick={() => setSelectedObjectId(child.id)}
                        className={`flex items-center justify-between pl-6 pr-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          isChildSelected
                            ? 'bg-orange-500/25 text-orange-300 font-semibold'
                            : 'hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <ChildIcon size={12} className="text-zinc-500 shrink-0" />
                          <span className="truncate text-[11px] font-sans">{child.name}</span>
                        </div>

                        {child.visKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSceneVisibility(child.visKey);
                            }}
                            className="p-0.5 text-zinc-500 hover:text-zinc-200 shrink-0"
                          >
                            {isChildVis ? <Eye size={11} /> : <EyeOff size={11} className="text-zinc-600" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
