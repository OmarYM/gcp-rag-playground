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
  const handleChange = (key: keyof ChunkingConfig, value: string | number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800">
      <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
        Chunking
      </h3>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Strategy</label>
          <select
            value={config.strategy}
            onChange={(e) => handleChange("strategy", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
          >
            <option value="recursive">Recursive character</option>
            <option value="fixed">Fixed window</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Chunk size</span>
            <span className="font-mono tabular-nums text-zinc-300">
              {config.size} chars
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="3000"
            step="100"
            value={config.size}
            onChange={(e) => handleChange("size", parseInt(e.target.value, 10))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Min chunk size</span>
            <span className="font-mono tabular-nums text-zinc-300">
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
              handleChange("minChunkSize", parseInt(e.target.value, 10))
            }
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Overlap</span>
            <span className="font-mono tabular-nums text-zinc-300">
              {config.overlap} chars
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="500"
            step="50"
            value={config.overlap}
            onChange={(e) =>
              handleChange("overlap", parseInt(e.target.value, 10))
            }
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
