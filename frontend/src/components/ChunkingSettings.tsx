import { ScatterChart, HelpCircle } from "lucide-react";

export interface ChunkingConfig {
  strategy: "recursive" | "fixed";
  size: number;
  overlap: number;
  minChunkSize: number;
}

interface ChunkingSettingsProps {
  config: ChunkingConfig;
  onConfigChange: (config: ChunkingConfig) => void;
}

export function ChunkingSettings({
  config,
  onConfigChange,
}: ChunkingSettingsProps) {
  const handleChange = (key: keyof ChunkingConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const LabelWithTooltip = ({
    label,
    tooltip,
  }: {
    label: string;
    tooltip: string;
  }) => (
    <div className="flex items-center gap-1.5 group relative w-fit">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <HelpCircle className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors cursor-help" />
      <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-[10px] text-slate-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {tooltip}
        {/* Arrow aligned to the icon */}
        <div className="absolute -bottom-1 left-1.5 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pt-4 border-t border-slate-800">
      <div className="flex items-center gap-2 text-indigo-400 mb-2">
        <ScatterChart className="w-4 h-4" />
        <h3 className="font-semibold text-sm uppercase tracking-wider">
          Chunking Strategy
        </h3>
      </div>

      <div className="space-y-3">
        {/* Strategy Selector */}
        <div className="space-y-1">
          <LabelWithTooltip
            label="Strategy"
            tooltip="Determines how text is split. 'Recursive' splits by structure (paragraphs) to preserve context. 'Fixed' splits by exact character count."
          />
          <select
            value={config.strategy}
            onChange={(e) => handleChange("strategy", e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="recursive">Recursive Character</option>
            <option value="fixed">Fixed Size</option>
          </select>
        </div>

        {/* Chunk Size */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <LabelWithTooltip
              label="Chunk Size"
              tooltip="Target size for each text chunk. Larger chunks provide more context but may dilute specific details for retrieval."
            />
            <span className="text-xs text-slate-500">{config.size} chars</span>
          </div>
          <input
            type="range"
            min="100"
            max="3000"
            step="100"
            value={config.size}
            onChange={(e) => handleChange("size", parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Min Chunk Size */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <LabelWithTooltip
              label="Min Chunk Size"
              tooltip="Minimum characters required for a chunk to be kept. Helps filter out noise like page numbers, short headers, or empty lines."
            />
            <span className="text-xs text-slate-500">
              {config.minChunkSize} chars
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={config.minChunkSize}
            onChange={(e) =>
              handleChange("minChunkSize", parseInt(e.target.value))
            }
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Chunk Overlap */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <LabelWithTooltip
              label="Overlap"
              tooltip="Number of characters shared between adjacent chunks. Ensures context isn't lost at the boundaries where text is split."
            />
            <span className="text-xs text-slate-500">
              {config.overlap} chars
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="500"
            step="50"
            value={config.overlap}
            onChange={(e) => handleChange("overlap", parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
