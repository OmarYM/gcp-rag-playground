import { Sliders } from "lucide-react";

interface SettingsPanelProps {
  systemInstruction: string;
  onSystemInstructionChange: (value: string) => void;
}

export function SettingsPanel({
  systemInstruction,
  onSystemInstructionChange,
}: SettingsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-indigo-400 mb-2">
        <Sliders className="w-4 h-4" />
        <h3 className="font-semibold text-sm uppercase tracking-wider">
          System Settings
        </h3>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="system-instruction"
          className="block text-xs font-medium text-slate-400"
        >
          AI Persona / Instructions
        </label>
        <textarea
          id="system-instruction"
          value={systemInstruction}
          onChange={(e) => onSystemInstructionChange(e.target.value)}
          className="w-full h-32 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
          placeholder="You are a helpful assistant..."
        />
        <p className="text-[10px] text-slate-500">
          Define how the AI should behave or answer questions.
        </p>
      </div>
    </div>
  );
}
