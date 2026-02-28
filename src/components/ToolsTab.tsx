import { ModelCategory } from '@runanywhere/web';
import {
  ToolCalling,
  ToolCallFormat,
  toToolValue,
  getStringArg,
  getNumberArg,
  type ToolDefinition,
  type ToolCall,
  type ToolResult,
  type ToolCallingResult,
  type ToolValue,
} from '@runanywhere/web-llamacpp';
import { useState, useRef, useEffect, useCallback } from 'react';

import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

// ---------------------------------------------------------------------------
// Built-in demo tools
// ---------------------------------------------------------------------------

const DEMO_TOOLS: { def: ToolDefinition; executor: Parameters<typeof ToolCalling.registerTool>[1] }[] = [
  {
    def: {
      name: 'get_weather',
      description: 'Gets the current weather for a city. Returns temperature in Fahrenheit and a short condition.',
      parameters: [
        { name: 'location', type: 'string', description: 'City name (e.g. "San Francisco")', required: true },
      ],
      category: 'Utility',
    },
    executor: async (args) => {
      const city = getStringArg(args, 'location') ?? 'Unknown';
      const conditions = ['Sunny', 'Partly Cloudy', 'Overcast', 'Rainy', 'Windy', 'Foggy'];
      const temp = Math.round(45 + Math.random() * 50);
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      return {
        location: toToolValue(city),
        temperature_f: toToolValue(temp),
        condition: toToolValue(condition),
        humidity_pct: toToolValue(Math.round(30 + Math.random() * 60)),
      };
    },
  },
  {
    def: {
      name: 'calculate',
      description: 'Evaluates a mathematical expression and returns the numeric result.',
      parameters: [
        { name: 'expression', type: 'string', description: 'Math expression (e.g. "2 + 3 * 4")', required: true },
      ],
      category: 'Math',
    },
    executor: async (args): Promise<Record<string, ToolValue>> => {
      const expr = getStringArg(args, 'expression') ?? '0';
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s^]/g, '');
        const val = Function(`"use strict"; return (${sanitized})`)();
        return { result: toToolValue(Number(val)), expression: toToolValue(expr) };
      } catch {
        return { error: toToolValue(`Invalid expression: ${expr}`) };
      }
    },
  },
  {
    def: {
      name: 'get_time',
      description: 'Returns the current date and time, optionally for a specific timezone.',
      parameters: [
        { name: 'timezone', type: 'string', description: 'IANA timezone (e.g. "America/New_York"). Defaults to UTC.', required: false },
      ],
      category: 'Utility',
    },
    executor: async (args): Promise<Record<string, ToolValue>> => {
      const tz = getStringArg(args, 'timezone') ?? 'UTC';
      try {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
        return { datetime: toToolValue(formatted), timezone: toToolValue(tz) };
      } catch {
        return { datetime: toToolValue(new Date().toISOString()), timezone: toToolValue('UTC'), note: toToolValue('Fell back to UTC — invalid timezone') };
      }
    },
  },
  {
    def: {
      name: 'random_number',
      description: 'Generates a random integer between min and max (inclusive).',
      parameters: [
        { name: 'min', type: 'number', description: 'Minimum value', required: true },
        { name: 'max', type: 'number', description: 'Maximum value', required: true },
      ],
      category: 'Math',
    },
    executor: async (args) => {
      const min = getNumberArg(args, 'min') ?? 1;
      const max = getNumberArg(args, 'max') ?? 100;
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return { value: toToolValue(value), min: toToolValue(min), max: toToolValue(max) };
    },
  },
];

// ---------------------------------------------------------------------------
// Types for the execution trace
// ---------------------------------------------------------------------------

interface TraceStep {
  type: 'user' | 'tool_call' | 'tool_result' | 'response';
  content: string;
  detail?: ToolCall | ToolResult;
}

// ---------------------------------------------------------------------------
// Custom tool form state
// ---------------------------------------------------------------------------

interface ParamDraft {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

const EMPTY_PARAM: ParamDraft = { name: '', type: 'string', description: '', required: true };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolsTab() {
  const loader = useModelLoader(ModelCategory.Language);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [registeredTools, setRegisteredTools] = useState<ToolDefinition[]>([]);
  const [showToolForm, setShowToolForm] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const traceRef = useRef<HTMLDivElement>(null);

  // Custom tool form state
  const [toolName, setToolName] = useState('');
  const [toolDesc, setToolDesc] = useState('');
  const [toolParams, setToolParams] = useState<ParamDraft[]>([{ ...EMPTY_PARAM }]);

  // Register demo tools on mount
  useEffect(() => {
    ToolCalling.clearTools();
    for (const { def, executor } of DEMO_TOOLS) {
      ToolCalling.registerTool(def, executor);
    }
    setRegisteredTools(ToolCalling.getRegisteredTools());
    return () => { ToolCalling.clearTools(); };
  }, []);

  // Auto-scroll trace
  useEffect(() => {
    traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight, behavior: 'smooth' });
  }, [trace]);

  const refreshRegistry = useCallback(() => {
    setRegisteredTools(ToolCalling.getRegisteredTools());
  }, []);

  // -------------------------------------------------------------------------
  // Generate with tools
  // -------------------------------------------------------------------------

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setInput('');
    setGenerating(true);
    setTrace([{ type: 'user', content: text }]);

    try {
      const result: ToolCallingResult = await ToolCalling.generateWithTools(text, {
        autoExecute,
        maxToolCalls: 5,
        temperature: 0.3,
        maxTokens: 512,
        format: ToolCallFormat.Default,
      });

      // Build trace from result
      const steps: TraceStep[] = [{ type: 'user', content: text }];

      for (let i = 0; i < result.toolCalls.length; i++) {
        const call = result.toolCalls[i];
        const argSummary = Object.entries(call.arguments)
          .map(([k, v]) => `${k}=${JSON.stringify('value' in v ? v.value : v)}`)
          .join(', ');
        steps.push({
          type: 'tool_call',
          content: `${call.toolName}(${argSummary})`,
          detail: call,
        });

        if (result.toolResults[i]) {
          const res = result.toolResults[i];
          const resultStr = res.success && res.result
            ? JSON.stringify(Object.fromEntries(Object.entries(res.result).map(([k, v]) => [k, 'value' in v ? v.value : v])), null, 2)
            : res.error ?? 'Unknown error';
          steps.push({
            type: 'tool_result',
            content: res.success ? resultStr : `Error: ${resultStr}`,
            detail: res,
          });
        }
      }

      if (result.text) {
        steps.push({ type: 'response', content: result.text });
      }

      setTrace(steps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTrace((prev) => [...prev, { type: 'response', content: `Error: ${msg}` }]);
    } finally {
      setGenerating(false);
    }
  }, [input, generating, autoExecute, loader]);

  // -------------------------------------------------------------------------
  // Register custom tool
  // -------------------------------------------------------------------------

  const addParam = () => setToolParams((p) => [...p, { ...EMPTY_PARAM }]);

  const updateParam = (idx: number, field: keyof ParamDraft, value: string | boolean) => {
    setToolParams((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removeParam = (idx: number) => {
    setToolParams((prev) => prev.filter((_, i) => i !== idx));
  };

  const registerCustomTool = () => {
    const name = toolName.trim().replace(/\s+/g, '_').toLowerCase();
    const desc = toolDesc.trim();
    if (!name || !desc) return;

    const params = toolParams
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        type: p.type as 'string' | 'number' | 'boolean',
        description: p.description.trim() || p.name.trim(),
        required: p.required,
      }));

    const def: ToolDefinition = { name, description: desc, parameters: params, category: 'Custom' };

    // Mock executor that returns the args back as acknowledgement
    const executor = async (args: Record<string, ToolValue>): Promise<Record<string, ToolValue>> => {
      const result: Record<string, ToolValue> = {
        status: toToolValue('executed'),
        tool: toToolValue(name),
      };
      for (const [k, v] of Object.entries(args)) {
        result[`input_${k}`] = v;
      }
      return result;
    };

    ToolCalling.registerTool(def, executor);
    refreshRegistry();
    setToolName('');
    setToolDesc('');
    setToolParams([{ ...EMPTY_PARAM }]);
    setShowToolForm(false);
  };

  const unregisterTool = (name: string) => {
    ToolCalling.unregisterTool(name);
    refreshRegistry();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="tab-panel tools-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      {/* Toolbar */}
      <div className="tools-toolbar">
        <button
          className={`btn btn-sm ${showRegistry ? 'btn-primary' : ''}`}
          onClick={() => { setShowRegistry(!showRegistry); setShowToolForm(false); }}
        >
          🔧 Tools ({registeredTools.length})
        </button>
        <button
          className={`btn btn-sm ${showToolForm ? 'btn-primary' : ''}`}
          onClick={() => { setShowToolForm(!showToolForm); setShowRegistry(false); }}
        >
          + Add Tool
        </button>
        <label className="tools-toggle">
          <input type="checkbox" checked={autoExecute} onChange={(e) => setAutoExecute(e.target.checked)} />
          Auto-execute
        </label>
      </div>

      {/* Tool registry panel */}
      {showRegistry && (
        <div className="tools-registry">
          <h4>Registered Tools</h4>
          {registeredTools.length === 0 && <p className="text-muted">No tools registered</p>}
          {registeredTools.map((t) => (
            <div key={t.name} className="tool-card">
              <div className="tool-card-header">
                <strong>{t.name}</strong>
                {t.category && <span className="tool-category">{t.category}</span>}
                <button className="btn btn-sm tool-remove" onClick={() => unregisterTool(t.name)}>×</button>
              </div>
              <p className="tool-card-desc">{t.description}</p>
              {t.parameters.length > 0 && (
                <div className="tool-params">
                  {t.parameters.map((p) => (
                    <span key={p.name} className="tool-param">
                      {p.name}: {p.type}{p.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Custom tool form */}
      {showToolForm && (
        <div className="tools-form">
          <h4>Register Custom Tool</h4>
          <input
            className="tools-input"
            placeholder="Tool name (e.g. search_web)"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
          />
          <input
            className="tools-input"
            placeholder="Description (e.g. Searches the web for a query)"
            value={toolDesc}
            onChange={(e) => setToolDesc(e.target.value)}
          />
          <div className="tools-form-section">
            <span className="tools-form-label">Parameters</span>
            {toolParams.map((p, i) => (
              <div key={i} className="tools-param-row">
                <input
                  className="tools-input tools-input-sm"
                  placeholder="name"
                  value={p.name}
                  onChange={(e) => updateParam(i, 'name', e.target.value)}
                />
                <select
                  className="tools-input tools-input-sm"
                  value={p.type}
                  onChange={(e) => updateParam(i, 'type', e.target.value)}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
                <input
                  className="tools-input tools-input-sm"
                  placeholder="description"
                  value={p.description}
                  onChange={(e) => updateParam(i, 'description', e.target.value)}
                />
                <label className="tools-checkbox">
                  <input type="checkbox" checked={p.required} onChange={(e) => updateParam(i, 'required', e.target.checked)} />
                  req
                </label>
                {toolParams.length > 1 && (
                  <button className="btn btn-sm" onClick={() => removeParam(i)}>×</button>
                )}
              </div>
            ))}
            <button className="btn btn-sm" onClick={addParam}>+ Param</button>
          </div>
          <div className="tools-form-actions">
            <button className="btn btn-primary btn-sm" onClick={registerCustomTool} disabled={!toolName.trim() || !toolDesc.trim()}>
              Register Tool
            </button>
            <button className="btn btn-sm" onClick={() => setShowToolForm(false)}>Cancel</button>
          </div>
          <p className="tools-form-hint">
            Custom tools use a mock executor that echoes back the arguments. Replace with real logic in code.
          </p>
        </div>
      )}

      {/* Execution trace */}
      <div className="tools-trace" ref={traceRef}>
        {trace.length === 0 && (
          <div className="empty-state">
            <h3>Tool Calling</h3>
            <p>{'Ask a question that requires tools — e.g. "What\'s the weather in Tokyo?" or "What is 42 * 17?"'}</p>
            <div className="tools-examples">
              <button className="btn btn-sm" onClick={() => setInput('What is the weather in San Francisco?')}>🌤️ Weather</button>
              <button className="btn btn-sm" onClick={() => setInput('What is 123 * 456 + 789?')}>🧮 Calculate</button>
              <button className="btn btn-sm" onClick={() => setInput('What time is it in Tokyo?')}>🕐 Time</button>
              <button className="btn btn-sm" onClick={() => setInput('Give me a random number between 1 and 1000')}>🎲 Random</button>
            </div>
          </div>
        )}
        {trace.map((step, i) => (
          <div key={i} className={`trace-step trace-${step.type}`}>
            <div className="trace-label">
              {step.type === 'user' && '👤 User'}
              {step.type === 'tool_call' && '🔧 Tool Call'}
              {step.type === 'tool_result' && '📦 Result'}
              {step.type === 'response' && '🤖 Response'}
            </div>
            <div className="trace-content">
              <pre>{step.content}</pre>
            </div>
          </div>
        ))}
        {generating && (
          <div className="trace-step trace-loading">
            <div className="trace-label">⏳ Generating...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          type="text"
          placeholder="Ask something that needs tools..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={generating}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || generating}>
          {generating ? 'Running...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
