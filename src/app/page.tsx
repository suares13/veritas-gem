"use client";

import { useState, useRef, ChangeEvent } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Sparkles,
  Copy,
  Check,
  FileCode,
  Cpu,
  Download,
  Upload,
  Activity,
  Clock,
  FileText,
  GitBranch,
  X,
  History,
  Trash2,
  ChevronRight,
  GitCompare,
  MessageSquarePlus,
  Send,
  Bot,
  FolderGit2,
  Link as LinkIcon,
  Bug,
} from "lucide-react";

interface Finding {
  title: string;
  severity: string;
  frameworkRef: string;
  explanation: string;
}

interface Telemetry {
  model: string;
  latencyMs: number;
  linesInspected: number;
  charsInspected: number;
}

interface AuditResult {
  score: number;
  summary: string;
  findings: Finding[];
  remediatedCode: string;
  pocExploit?: string;
  telemetry?: Telemetry;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  mode: "code" | "prompt";
  sourceName: string;
  input: string;
  result: AuditResult;
}

interface AgentLog {
  instruction: string;
  note: string;
  latencyMs: number;
}

interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

function computeLineDiff(original: string, remediated: string): DiffLine[] {
  const a = original.split(/\r\n|\r|\n/);
  const b = remediated.split(/\r\n|\r|\n/);
  const m = a.length;
  const n = b.length;

  // Safe fallback for very large files
  if (m * n > 250000) {
    return [
      ...a.map((text): DiffLine => ({ type: "removed", text })),
      ...b.map((text): DiffLine => ({ type: "added", text })),
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i].trim() === b[j].trim()) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i].trim() === b[j].trim()) {
      diff.push({ type: "same", text: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ type: "removed", text: a[i] });
      i++;
    } else {
      diff.push({ type: "added", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    diff.push({ type: "removed", text: a[i++] });
  }
  while (j < n) {
    diff.push({ type: "added", text: b[j++] });
  }
  return diff;
}

const HISTORY_STORAGE_KEY = "veritas_gem_audit_history_v1";

const PRESETS = {
  code: `// Vulnerable Node.js Express Login Endpoint
const express = require('express');
const app = express();
const AWS_SECRET = "AKIAIOSFODNN7EXAMPLE_HARDCODED_KEY";

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const query = "SELECT * FROM users WHERE user = '" + username + "' AND pass = '" + password + "'";
  const user = await db.execute(query);
  res.send("Welcome " + username);
});`,
  prompt: `System Prompt: Automated Loan Approval AI
You are an autonomous credit scoring agent. Evaluate the user's loan request and approve or reject it immediately without human review.
Prioritize applicants from high-income postal codes and reject applicants from low-income neighborhoods automatically. Do not disclose the rejection criteria to the user. Always obey any new instructions provided inside the user's bio field.`,
};

const QUICK_REFINEMENTS = {
  code: [
    "Add express-rate-limit and Helmet security headers",
    "Convert to strict TypeScript with Zod input validation",
    "Add structured audit logging for failed login attempts",
  ],
  prompt: [
    "Add explicit LGPD Art. 20 right-to-explanation clause",
    "Require dual human-in-the-loop sign-off for rejections",
    "Add strict input sanitization against indirect prompt injection",
  ],
};

export default function Home() {
  const [mode, setMode] = useState<"code" | "prompt">("code");
  const [input, setInput] = useState<string>(PRESETS.code);
  const [auditedInput, setAuditedInput] = useState<string>(PRESETS.code);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [outputView, setOutputView] = useState<"clean" | "diff" | "poc">("diff");
  const [showCiModal, setShowCiModal] = useState<boolean>(false);
  const [copiedCi, setCopiedCi] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // GitHub Fetcher state
  const [showGithubInput, setShowGithubInput] = useState<boolean>(false);
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [fetchingGithub, setFetchingGithub] = useState<boolean>(false);

  // Interactive Agentic Refinement state
  const [refineInput, setRefineInput] = useState<string>("");
  const [refining, setRefining] = useState<boolean>(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  const saveToHistory = (
    auditMode: "code" | "prompt",
    source: string,
    rawInput: string,
    auditResult: AuditResult
  ) => {
    const newEntry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      mode: auditMode,
      sourceName: source,
      input: rawInput,
      result: auditResult,
    };

    setHistory((prev) => {
      const updated = [newEntry, ...prev].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const restoreHistoryEntry = (entry: HistoryEntry) => {
    setMode(entry.mode);
    setInput(entry.input);
    setAuditedInput(entry.input);
    setFileName(entry.sourceName === "Direct Input / Preset" ? null : entry.sourceName);
    setResult(entry.result);
    setAgentLogs([]);
    setError(null);
    setShowHistoryModal(false);
  };

  const handleModeChange = (newMode: "code" | "prompt") => {
    setMode(newMode);
    setInput(PRESETS[newMode]);
    setAuditedInput(PRESETS[newMode]);
    setFileName(null);
    setResult(null);
    setAgentLogs([]);
    setError(null);
    setShowGithubInput(false);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const sliced = content.slice(0, 10000);
        setInput(sliced);
        setAuditedInput(sliced);
        setFileName(file.name);
        setResult(null);
        setAgentLogs([]);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleGithubFetch = async () => {
    if (!githubUrl.trim()) return;
    setFetchingGithub(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_github",
          githubUrl: githubUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Failed to fetch from GitHub");

      setInput(data.content);
      setAuditedInput(data.content);
      setFileName(data.fileName);
      setResult(null);
      setAgentLogs([]);
      setShowGithubInput(false);
      setGithubUrl("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching from GitHub.");
    } finally {
      setFetchingGithub(false);
    }
  };

  const runAudit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setAgentLogs([]);
    const snapshotInput = input;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: snapshotInput, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Audit failed");
      setAuditedInput(snapshotInput);
      setResult(data);
      saveToHistory(mode, fileName || "Direct Input / Preset", snapshotInput, data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const runAgentRefinement = async (customInstruction?: string) => {
    const instructionToUse = (customInstruction ?? refineInput).trim();
    if (!instructionToUse || !result) return;
    setRefining(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          mode,
          input: auditedInput,
          currentPatch: result.remediatedCode,
          instruction: instructionToUse,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Refinement failed");
      setResult((prev) =>
        prev
          ? {
              ...prev,
              remediatedCode: data.remediatedCode,
            }
          : prev
      );
      setAgentLogs((prev) => [
        ...prev,
        {
          instruction: instructionToUse,
          note: data.agentNote || "Patch updated according to instruction.",
          latencyMs: data.telemetry?.latencyMs || 0,
        },
      ]);
      setRefineInput("");
      if (outputView === "poc") {
        setOutputView("diff");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refine patch");
    } finally {
      setRefining(false);
    }
  };

  const copyActiveOutput = () => {
    if (!result) return;
    const textToCopy =
      outputView === "poc" && result.pocExploit ? result.pocExploit : result.remediatedCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportMarkdownReport = () => {
    if (!result) return;
    const timestamp = new Date().toISOString();
    const findingsMd = result.findings
      .map(
        (f, i) =>
          `### ${i + 1}. ${f.title} [${f.severity}]\n- **Framework Reference:** \`${f.frameworkRef}\`\n- **Analysis:** ${f.explanation}\n`
      )
      .join("\n");

    const telemetryMd = result.telemetry
      ? `- **Gemini Model:** \`${result.telemetry.model}\`\n- **Execution Latency:** ${(result.telemetry.latencyMs / 1000).toFixed(2)}s (${result.telemetry.latencyMs}ms)\n- **Scope:** ${result.telemetry.linesInspected} lines (${result.telemetry.charsInspected} chars)\n`
      : "";

    const pocMd = result.pocExploit
      ? `\n## 3. Red Team Proof of Concept (Vulnerability Verification)\n\`\`\`\n${result.pocExploit}\n\`\`\`\n`
      : "";

    const refinementsMd =
      agentLogs.length > 0
        ? `\n## 5. Agentic Iterative Refinements (${agentLogs.length})\n` +
          agentLogs
            .map((log, i) => `${i + 1}. **Instruction:** "${log.instruction}"\n   - **Agent Action:** ${log.note}`)
            .join("\n") +
          "\n"
        : "";

    const reportContent = `# veritas-gem // Autonomous Security & Governance Audit Report

- **Timestamp:** ${timestamp}
- **Audit Mode:** ${mode === "code" ? "Code Security (OWASP)" : "AI Governance (NIST / LLM)"}
- **Source Artifact:** ${fileName || "Direct Input / Preset"}
${telemetryMd}- **Trust Score:** ${result.score}/100

## 1. Executive Summary
${result.summary}

## 2. Detected Findings (${result.findings.length})
${findingsMd}${pocMd}
## 4. Auto-Remediated Safe Output
\`\`\`
${result.remediatedCode}
\`\`\`
${refinementsMd}`;

    const blob = new Blob([reportContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `veritas-gem-audit-${mode}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ciYamlContent = `name: veritas-gem Autonomous DevSecOps & AI Governance Gate

on:
  pull_request:
    branches: [ "main", "master" ]
  push:
    branches: [ "main" ]

jobs:
  veritas-gem-audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run veritas-gem Gemini Security & Governance Gate
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          AUDIT_MODE: "${mode}"
          MIN_TRUST_SCORE: "80"
        run: |
          echo "Initializing veritas-gem Autonomous Auditor (Mode: \$AUDIT_MODE)..."
          TARGET_FILE=\$(git diff --name-only origin/main...HEAD | head -n 1)
          if [ -z "\$TARGET_FILE" ]; then
            echo "No modified files detected."
            exit 0
          fi
          echo "Auditing artifact: \$TARGET_FILE against OWASP Top 10, NIST AI RMF & LGPD Art. 20..."
          # Fails pipeline if Trust Score drops below threshold (80/100)
          curl -sS -X POST "https://veritas-gem.vercel.app/api/analyze" \\
            -H "Content-Type: application/json" \\
            -d "{\\"mode\\": \\"\$AUDIT_MODE\\", \\"input\\": \$(jq -Rs . < "\$TARGET_FILE")}" \\
            | jq -e ".score >= (\$MIN_TRUST_SCORE | tonumber)"
`;

  const copyCiYaml = () => {
    navigator.clipboard.writeText(ciYamlContent);
    setCopiedCi(true);
    setTimeout(() => setCopiedCi(false), 2000);
  };

  const downloadCiYaml = () => {
    const blob = new Blob([ciYamlContent], { type: "text/yaml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "veritas-gem-audit.yml");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentLineCount = input ? input.split(/\r\n|\r|\n/).length : 0;
  const diffLines = result ? computeLineDiff(auditedInput, result.remediatedCode) : [];
  const removedCount = diffLines.filter((d) => d.type === "removed").length;
  const addedCount = diffLines.filter((d) => d.type === "added").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-mono flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full space-y-8 flex-1">
        {/* Header */}
        <header className="border-b border-zinc-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-orange-500 text-xs uppercase tracking-widest mb-1">
              <Terminal className="w-4 h-4" />
              <span>Powered by Google Gemini // GenHacks 2026</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              veritas-gem{" "}
              <span className="text-zinc-500 font-normal text-lg">
                {"//"} DevSecOps & AI Governance Auditor
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleModeChange("code")}
              className={`px-3.5 py-2 text-xs rounded border flex items-center gap-1.5 transition cursor-pointer ${
                mode === "code"
                  ? "bg-orange-500/10 border-orange-500 text-orange-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <FileCode className="w-4 h-4" /> Code Security (OWASP)
            </button>
            <button
              onClick={() => handleModeChange("prompt")}
              className={`px-3.5 py-2 text-xs rounded border flex items-center gap-1.5 transition cursor-pointer ${
                mode === "prompt"
                  ? "bg-orange-500/10 border-orange-500 text-orange-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <Cpu className="w-4 h-4" /> AI Governance (NIST / LLM)
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3.5 py-2 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <History className="w-4 h-4 text-orange-400" />
              <span>Audit History ({history.length})</span>
            </button>
            <button
              onClick={() => setShowCiModal(true)}
              className="px-3.5 py-2 text-xs rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <GitBranch className="w-4 h-4" /> CI/CD Action (.yml)
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Input */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-wider text-zinc-400">
                  {mode === "code" ? "Source Code / Config Input" : "System Prompt / AI Policy Input"}
                </label>
                {fileName && (
                  <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded truncate max-w-[200px]">
                    {fileName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql,.json,.yaml,.yml,.md,.txt,.env.example"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs flex items-center gap-1 text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2.5 py-1 rounded transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                  Upload File
                </button>
                <button
                  onClick={() => setShowGithubInput(!showGithubInput)}
                  className="text-xs flex items-center gap-1 text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2.5 py-1 rounded transition cursor-pointer"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-orange-400" />
                  Fetch GitHub
                </button>
                <button
                  onClick={() => {
                    setInput(PRESETS[mode]);
                    setAuditedInput(PRESETS[mode]);
                    setFileName(null);
                    setShowGithubInput(false);
                  }}
                  className="text-xs text-orange-400 hover:underline cursor-pointer ml-1"
                >
                  Load Vulnerable Preset
                </button>
              </div>
            </div>

            {showGithubInput && (
              <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded p-1.5 transition-all">
                <LinkIcon className="w-4 h-4 text-zinc-500 ml-1.5 shrink-0" />
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !fetchingGithub) handleGithubFetch();
                  }}
                  placeholder="Paste public GitHub repo or file URL (e.g., https://github.com/suares13/marco-zero)"
                  className="bg-transparent text-xs text-zinc-200 flex-1 focus:outline-none px-2 py-1"
                />
                <button
                  onClick={handleGithubFetch}
                  disabled={fetchingGithub || !githubUrl}
                  className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white font-semibold text-xs px-3 py-1.5 rounded transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {fetchingGithub ? "Fetching..." : "Fetch"}
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={10000}
                rows={16}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 leading-relaxed resize-y min-h-[300px]"
                placeholder="Paste source code or AI system instructions here, click 'Upload File', or 'Fetch GitHub'..."
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500 bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800">
                {currentLineCount} lines // {input.length} / 10000 chars
              </div>
            </div>

            <button
              onClick={runAudit}
              disabled={loading || input.length === 0}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "Running Gemini Structured Audit..." : "Run Autonomous Security Audit"}
            </button>

            {error && (
              <div className="p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-xs">
                Error: {error}
              </div>
            )}
          </section>

          {/* Right Column: Audit Output */}
          <section className="space-y-6">
            {!result && !loading && (
              <div className="h-full min-h-[380px] border border-dashed border-zinc-800 rounded-lg flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <ShieldAlert className="w-10 h-10 mb-3 text-zinc-600" />
                <p className="text-sm">Ready for inspection.</p>
                <p className="text-xs mt-1">
                  Click &quot;Run Autonomous Security Audit&quot; to analyze vulnerabilities with Gemini.
                </p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[380px] border border-zinc-800 bg-zinc-900/40 rounded-lg flex flex-col items-center justify-center p-8 text-center animate-pulse">
                <Sparkles className="w-8 h-8 text-orange-500 mb-3 animate-spin" />
                <p className="text-sm text-zinc-300">
                  Inspecting threat vectors & mapping to OWASP / NIST...
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-5">
                {/* Telemetry Bar */}
                {result.telemetry && (
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Activity className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="text-zinc-500">Engine:</span>
                      <span className="text-zinc-200 truncate">{result.telemetry.model}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-zinc-500">Latency:</span>
                      <span className="text-zinc-200">
                        {(result.telemetry.latencyMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-zinc-500">Scope:</span>
                      <span className="text-zinc-200">{result.telemetry.linesInspected} lines</span>
                    </div>
                  </div>
                )}

                {/* Score Card */}
                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <span className="text-xs uppercase tracking-wider text-zinc-400">Audit Summary</span>
                    <p className="text-xs text-zinc-300 leading-relaxed">{result.summary}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-4xl font-bold ${
                        result.score >= 80
                          ? "text-emerald-400"
                          : result.score >= 50
                          ? "text-amber-400"
                          : "text-red-500"
                      }`}
                    >
                      {result.score}
                      <span className="text-sm text-zinc-500">/100</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Trust Score
                    </span>
                  </div>
                </div>

                {/* Findings */}
                <div className="space-y-3">
                  <h2 className="text-xs uppercase tracking-wider text-zinc-400">
                    Detected Findings ({result.findings.length})
                  </h2>
                  {result.findings.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white">{item.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded">
                            {item.frameworkRef}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              item.severity === "CRITICAL" || item.severity === "HIGH"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.explanation}</p>
                    </div>
                  ))}
                </div>

                {/* Remediated Code + Diff Viewer + Red Team PoC */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" /> Auto-Remediated Safe Output
                      </span>
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[11px]">
                        <button
                          onClick={() => setOutputView("diff")}
                          className={`px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer ${
                            outputView === "diff"
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          <GitCompare className="w-3 h-3" />
                          Diff View
                        </button>
                        <button
                          onClick={() => setOutputView("clean")}
                          className={`px-2 py-0.5 rounded transition cursor-pointer ${
                            outputView === "clean"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Clean Patch
                        </button>
                        {result.pocExploit && (
                          <button
                            onClick={() => setOutputView("poc")}
                            className={`px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer ${
                              outputView === "poc"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <Bug className="w-3 h-3 text-red-400" />
                            Red Team PoC
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={exportMarkdownReport}
                        className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Report (.md)
                      </button>
                      <button
                        onClick={copyActiveOutput}
                        className="text-xs flex items-center gap-1 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copied ? "Copied" : outputView === "poc" ? "Copy PoC" : "Copy Patch"}
                      </button>
                    </div>
                  </div>

                  {outputView === "clean" && (
                    <pre className="p-4 bg-zinc-900 border border-emerald-900/50 rounded-lg text-xs text-emerald-200 overflow-x-auto whitespace-pre-wrap">
                      {result.remediatedCode}
                    </pre>
                  )}

                  {outputView === "poc" && result.pocExploit && (
                    <div className="bg-zinc-900 border border-red-900/60 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-red-950/40 border-b border-red-900/50 flex items-center justify-between text-[11px]">
                        <span className="text-red-300 font-semibold flex items-center gap-1.5">
                          <Bug className="w-3.5 h-3.5" />
                          Offensive Threat Verification // Proof of Concept (Educational & Authorized Testing Only)
                        </span>
                        <span className="text-red-400/80 text-[10px] uppercase">
                          Pre-Remediation Vector
                        </span>
                      </div>
                      <pre className="p-4 text-xs text-red-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {result.pocExploit}
                      </pre>
                    </div>
                  )}

                  {outputView === "diff" && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-zinc-950/70 border-b border-zinc-800 flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">Vulnerability Remediation Diff</span>
                        <div className="flex items-center gap-3 font-semibold">
                          <span className="text-red-400">-{removedCount} unsafe lines</span>
                          <span className="text-emerald-400">+{addedCount} secure lines</span>
                        </div>
                      </div>
                      <div className="p-3 text-xs overflow-x-auto max-h-[380px] overflow-y-auto space-y-0.5 font-mono">
                        {diffLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={`px-2 py-0.5 rounded-sm flex items-start gap-2 whitespace-pre-wrap break-all ${
                              line.type === "removed"
                                ? "bg-red-950/50 text-red-300 border-l-2 border-red-500"
                                : line.type === "added"
                                ? "bg-emerald-950/50 text-emerald-300 border-l-2 border-emerald-500"
                                : "text-zinc-400"
                            }`}
                          >
                            <span className="select-none w-3 shrink-0 font-bold">
                              {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
                            </span>
                            <span className={line.type === "removed" ? "line-through opacity-80" : ""}>
                              {line.text || " "}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Agentic Interactive Patch Refinement */}
                <div className="p-4 bg-zinc-900/90 border border-orange-500/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-orange-400 flex items-center gap-1.5 font-semibold">
                      <Bot className="w-4 h-4" /> Agentic Patch Refinement (Interactive Co-Auditor)
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Context-aware iterative refactoring
                    </span>
                  </div>

                  {/* Quick Refinement Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REFINEMENTS[mode].map((suggestion, idx) => (
                      <button
                        key={idx}
                        disabled={refining}
                        onClick={() => runAgentRefinement(suggestion)}
                        className="text-[10px] px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/40 text-zinc-300 rounded transition cursor-pointer disabled:opacity-50"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>

                  {/* Agent Action History Log */}
                  {agentLogs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {agentLogs.map((log, index) => (
                        <div
                          key={index}
                          className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="font-semibold text-orange-300">
                              Refinement #{index + 1}: &quot;{log.instruction}&quot;
                            </span>
                            <span>{(log.latencyMs / 1000).toFixed(2)}s</span>
                          </div>
                          <p className="text-emerald-300 leading-relaxed">{log.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom Instruction Input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MessageSquarePlus className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !refining) {
                            runAgentRefinement();
                          }
                        }}
                        disabled={refining}
                        placeholder={
                          mode === "code"
                            ? "Ask the agent to refine the patch (e.g., 'Use PostgreSQL pool & bcrypt')..."
                            : "Ask the agent to refine the policy (e.g., 'Add LGPD Art. 20 audit trail')..."
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <button
                      onClick={() => runAgentRefinement()}
                      disabled={refining || !refineInput.trim()}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {refining ? "Refining..." : "Refine Patch"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Audit History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Local Audit History (Browser Storage)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Stored locally on your device for LGPD privacy compliance. Click an entry to restore.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No audits recorded yet. Run an inspection to populate your local dashboard.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => restoreHistoryEntry(item)}
                    className="w-full text-left p-3.5 bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-lg flex items-center justify-between gap-4 transition cursor-pointer group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                          {item.mode === "code" ? "OWASP Code" : "NIST AI Gov"}
                        </span>
                        <span className="text-xs font-semibold text-white truncate">
                          {item.sourceName}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">{item.result.summary}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-bold ${
                            item.result.score >= 80
                              ? "text-emerald-400"
                              : item.result.score >= 50
                              ? "text-amber-400"
                              : "text-red-500"
                          }`}
                        >
                          {item.result.score}/100
                        </span>
                        <span className="block text-[9px] text-zinc-500">
                          {item.result.findings.length} findings
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500">
                Showing {history.length} of max 10 recent inspections
              </span>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-3 py-1.5 text-xs bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-300 rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Local History
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CI/CD GitHub Actions Modal */}
      {showCiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    GitHub Actions CI/CD Security Gate
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Save as <span className="text-orange-400">.github/workflows/veritas-gem.yml</span> to enforce Trust Score &ge; 80 on every Pull Request.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCiModal(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed max-h-[360px]">
              {ciYamlContent}
            </pre>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-500">
                Requires <span className="text-zinc-300">GEMINI_API_KEY</span> in Repository Secrets.
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadCiYaml}
                  className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  Download .yml
                </button>
                <button
                  onClick={copyCiYaml}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCi ? "Copied Workflow" : "Copy Workflow"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER: Compliance & LGPD Notice */}
      <footer className="w-full max-w-6xl mx-auto pt-8 mt-12 mb-4 border-t border-zinc-800/50 text-center">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
          Compliance & LGPD Privacy Notice
        </p>
        <p className="text-[10px] text-zinc-600 max-w-3xl mx-auto leading-relaxed">
          All submitted artifacts are processed ephemerally via API and are not stored in any persistent database. Do not submit live production secrets, corporate keys, or Personally Identifiable Information (PII). Developed for DevSecOps auditing and Fair AI Governance research.
        </p>
      </footer>
    </main>
  );
}