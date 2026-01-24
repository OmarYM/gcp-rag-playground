interface SettingsPanelProps {
  systemInstruction: string;
  onSystemInstructionChange: (value: string) => void;
}

export function SettingsPanel({
  systemInstruction,
  onSystemInstructionChange,
}: SettingsPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
        System Instruction
      </h3>

      <div className="space-y-1.5">
        <label
          htmlFor="system-instruction"
          className="block text-xs text-zinc-400"
        >
          Prompt instructions sent with each query
        </label>
        <textarea
          id="system-instruction"
          value={systemInstruction}
          onChange={(e) => onSystemInstructionChange(e.target.value)}
          className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 resize-none transition-colors"
          placeholder="Answer based on the provided context..."
        />
      </div>
    </div>
  );
}
