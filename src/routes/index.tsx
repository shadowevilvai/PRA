import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Cpu,
  RotateCcw,
  Sparkles,
  Trash2,
  Waypoints,
  Activity,
  Timer,
  Download,
  History,
  X
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  parseReferences,
  runAlgorithms,
  type AlgorithmId,
  type AlgorithmResult,
} from "@/lib/page-replacement";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Page Replacement Simulator — COOS Mini Project" },
      {
        name: "description",
        content: "Run and compare FIFO, LRU, and Optimal page replacement with an interactive step-by-step memory simulator.",
      },
      { property: "og:title", content: "Page Replacement Simulator — COOS Mini Project" },
      {
        property: "og:description",
        content: "Explore page faults, hits, and frame changes with a step-by-step operating systems simulator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulatorPage,
});

const algorithms: {
  id: AlgorithmId;
  name: string;
  short: string;
  description: string;
  icon: typeof Clock3;
}[] = [
  {
    id: "fifo",
    name: "FIFO",
    short: "First in, first out",
    description: "Evicts the page that entered memory first.",
    icon: Clock3,
  },
  {
    id: "lru",
    name: "LRU",
    short: "Least recently used",
    description: "Evicts the page that has gone unused longest.",
    icon: RotateCcw,
  },
  {
    id: "optimal",
    name: "Optimal",
    short: "Farthest next use",
    description: "Evicts the page needed farthest in the future.",
    icon: Waypoints,
  },
  {
    id: "lfu",
    name: "LFU",
    short: "Least frequently used",
    description: "Evicts the page with the lowest access frequency.",
    icon: Activity,
  },
  {
    id: "clock",
    name: "Clock",
    short: "Second chance",
    description: "Evicts pages using a circular buffer and a use bit.",
    icon: Timer,
  },
];

const exampleInput = "1 2 3 2 4 1 5 2 1 3";

type RunHistory = {
  id: string;
  frameText: string;
  referenceText: string;
  timestamp: Date;
  winner?: string;
};

function SimulatorPage() {
  const [frameText, setFrameText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<AlgorithmId[]>(["fifo", "lru", "optimal", "lfu", "clock"]);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AlgorithmResult[] | null>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playbackStep, setPlaybackStep] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1500);
  const [history, setHistory] = useState<RunHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const PRESETS = [
    { name: "Locality", value: "1 2 1 3 1 2 1 4 5 1 2", frames: "3" },
    { name: "Looping", value: "1 2 3 4 1 2 3 4 1 2 3 4", frames: "3" },
    { name: "Belady's (3 vs 4)", value: "1 2 3 4 1 2 5 1 2 3 4 5", frames: "3" },
    { name: "Random", value: "7 2 3 1 5 4 6 2 1 3 7 5", frames: "4" }
  ];

  useEffect(() => {
    if (isAnimating && results && playbackStep < pages.length) {
      const timer = setTimeout(() => {
        setPlaybackStep((prev) => prev + 1);
      }, playbackSpeed);
      return () => clearTimeout(timer);
    } else if (isAnimating && playbackStep >= pages.length) {
      setIsAnimating(false);
      setSelectedStep(pages.length - 1);
    }
  }, [isAnimating, playbackStep, pages.length, results]);

  function runSimulation(overrideFrames?: string | any, overrideReference?: string | any) {
    const framesToUse = typeof overrideFrames === 'string' ? overrideFrames : frameText;
    const refToUse = typeof overrideReference === 'string' ? overrideReference : referenceText;
    
    const trimmedFrames = framesToUse.trim();
    if (!trimmedFrames || !/^\d+$/.test(trimmedFrames)) {
      setError("Enter a valid whole number of frames.");
      return;
    }
    const parsedFrames = Number(trimmedFrames);
    if (!Number.isSafeInteger(parsedFrames) || parsedFrames <= 0) {
      setError("Please enter a valid positive number of frames.");
      return;
    }
    const parsed = parseReferences(refToUse);
    if (parsed.error || !parsed.pages) {
      setError(parsed.error ?? "Enter a valid page reference string.");
      return;
    }

    setError("");
    setPages(parsed.pages);
    setFrameCount(parsedFrames);
    const newResults = runAlgorithms(parsed.pages, parsedFrames, selectedAlgorithms);
    
    // Determine winner for history
    const bestAlgorithm = newResults.reduce((best, current) => (current.faults < best.faults ? current : best));
    const winnerName = algorithms.find(a => a.id === bestAlgorithm.id)?.name || bestAlgorithm.id;

    setHistory(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      frameText: trimmedFrames,
      referenceText: parsed.pages!.join(" "),
      timestamp: new Date(),
      winner: winnerName
    }, ...prev].slice(0, 10));

    setResults(newResults);
    setPlaybackStep(0);
    setIsAnimating(true);
  }

  function appendNumber(num: number) {
    setReferenceText(prev => prev.trim() ? `${prev} ${num}` : `${num}`);
  }

  function exportCSV() {
    if (!results || !pages.length) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Step,Page," + results.map(r => r.id.toUpperCase() + " Hit/Fault," + r.id.toUpperCase() + " Frames," + r.id.toUpperCase() + " Reason").join(",") + "\\n";
    
    pages.forEach((page, index) => {
      let row = `${index + 1},${page}`;
      results.forEach(r => {
        const step = r.steps[index];
        row += `,${step.hit ? "HIT" : "FAULT"},"${step.frames.join(" ")}","${step.reason || ""}"`;
      });
      csvContent += row + "\\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "page_replacement_simulation.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Toggle an algorithm in the run set; always keep at least one selected.
  function toggleAlgorithm(id: AlgorithmId) {
    setSelectedAlgorithms((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((item) => item !== id);
      }
      return algorithms.filter((algorithm) => algorithm.id === id || current.includes(algorithm.id)).map((item) => item.id);
    });
  }

  function resetAll() {
    setFrameText("");
    setReferenceText("");
    setError("");
    setResults(null);
    setPages([]);
    setFrameCount(0);
    setSelectedStep(0);
    setIsAnimating(false);
    setPlaybackStep(0);
  }

  function clearResults() {
    setError("");
    setResults(null);
    setPages([]);
    setFrameCount(0);
    setSelectedStep(0);
    setIsAnimating(false);
    setPlaybackStep(0);
  }

  const resultList = results ?? [];
  // All algorithms that share the fewest faults are winners — ties included.
  const winner = resultList.length
    ? resultList.reduce((best, current) => (current.faults < best.faults ? current : best))
    : null;
  const winners = winner ? resultList.filter((result) => result.faults === winner.faults) : [];
  const chartData = resultList.map((result) => ({
    name: algorithms.find((algorithm) => algorithm.id === result.id)?.name ?? result.id,
    faults: result.faults,
    hits: result.hits,
    fill: result.id === "optimal" ? "var(--chart-optimal)" : "var(--chart-standard)",
  }));

  return (
    <main className="sim-app min-h-screen">
      <header className="app-header">
        <div className="page-shell header-inner">
          <a href="#top" className="brand-mark" aria-label="Page replacement simulator home">
            <span className="brand-icon"><Cpu aria-hidden="true" /></span>
            <span>MEMORY<span className="brand-mark-light">LAB</span></span>
          </a>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[var(--muted-foreground)] hover:text-white"
            onClick={() => setShowHistory(true)}
          >
            <History className="w-4 h-4 mr-2" /> History
          </Button>
        </div>
      </header>

      <div id="top" className="page-shell main-shell">
        <section className="intro-section" aria-labelledby="page-title">
          <div className="intro-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> OPERATING SYSTEMS · MINI PROJECT</span>
            <h1 id="page-title">Page replacement,<br /><span>made visible.</span></h1>
            <p>Watch memory frames change one reference at a time. Compare the decisions behind FIFO, LRU, and Optimal.</p>
          </div>
          <div className="intro-note" aria-label="Simulator summary">
            <span className="intro-note-icon"><Waypoints aria-hidden="true" /></span>
            <span className="intro-note-label">FIVE POLICIES</span>
            <span className="intro-note-value">One reference string</span>
          </div>
        </section>

        <section className="input-section" aria-labelledby="input-title">
          <div className="section-heading">
            <div className="section-heading-main">
              <span className="section-number">01</span>
              <div>
                <h2 id="input-title">Set up a run</h2>
                <p>Choose your memory size and page sequence.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="example-button"
              onClick={() => {
                setFrameText("3");
                setReferenceText(exampleInput);
                setError("");
              }}
            >
              <Sparkles aria-hidden="true" /> Try example
            </Button>
          </div>

          <div className="input-panel">
            <div className="form-fields">
              <div className="frame-field">
                <Label htmlFor="frame-count" className="field-label">Number of frames</Label>
                <div className="frame-input-wrap">
                  <Input
                    id="frame-count"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={frameText}
                    onChange={(event) => setFrameText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") runSimulation(); }}
                    placeholder="e.g. 3"
                    aria-describedby={error ? "simulation-error" : undefined}
                    className="frame-input"
                  />
                  <span className="input-suffix">FRAMES</span>
                </div>
              </div>
              <div className="reference-field">
                <Label htmlFor="reference-string" className="field-label">Page reference string</Label>
                <Textarea
                  id="reference-string"
                  value={referenceText}
                  onChange={(event) => setReferenceText(event.target.value)}
                  placeholder="1  2  3  2  4  1  5  2  1  3"
                  aria-describedby={error ? "simulation-error" : "input-hint"}
                  className="reference-textarea"
                  rows={1}
                />
                <span id="input-hint" className="field-hint">Separate pages with a space or comma · up to 100 references</span>
                
                <div className="mt-3 bg-[var(--surface-muted)] p-2 rounded-lg border border-[var(--border)] max-w-[280px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Number Pad</span>
                    <button 
                      type="button"
                      onClick={() => setReferenceText(prev => prev.trim().split(" ").slice(0, -1).join(" "))}
                      className="text-[10px] text-[var(--blue-ink)] hover:text-[var(--blue-soft)]"
                    >
                      ⌫ Backspace
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0,1,2,3,4,5,6,7,8,9].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => appendNumber(num)}
                        className="h-8 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-white hover:bg-[var(--blue-soft)] hover:border-[var(--blue-ink)] transition-colors text-xs font-bold"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="text-xs text-[var(--muted-foreground)] flex items-center mr-2 font-bold tracking-wider uppercase">Presets:</span>
                  {PRESETS.map(p => (
                    <button 
                      key={p.name}
                      type="button"
                      className="text-[10px] px-3 py-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--blue-soft)] hover:border-[var(--blue-ink)] hover:text-white transition-all font-medium shadow-sm"
                      onClick={() => {
                        setReferenceText(p.value);
                        setFrameText(p.frames);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p id="simulation-error" role="alert" className="input-error"><CircleHelp aria-hidden="true" />{error}</p>}
            <div className="input-actions">
              <Button type="button" onClick={runSimulation} size="lg" className="run-button">
                Run simulation <ArrowRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={resetAll} className="clear-button">
                <Trash2 aria-hidden="true" /> Clear
              </Button>
              <span className="input-footnote">No data leaves this browser</span>
            </div>
          </div>
        </section>

        <section className="algorithm-section" aria-labelledby="algorithm-title">
          <div className="section-heading compact-heading">
            <div className="section-heading-main">
              <span className="section-number">02</span>
              <div><h2 id="algorithm-title">Choose your replacement policies</h2></div>
            </div>
            <span className="section-side-label">TAP TO SELECT · AT LEAST ONE</span>
          </div>
          <div className="algorithm-grid">
            {algorithms.map((algorithm, index) => {
              const Icon = algorithm.icon;
              const isActive = selectedAlgorithms.includes(algorithm.id);
              return (
                <button
                  key={algorithm.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${algorithm.name}: ${isActive ? "included in" : "excluded from"} the simulation`}
                  className={`algorithm-card algorithm-${algorithm.id} ${isActive ? "algorithm-selected" : "algorithm-muted"}`}
                  onClick={() => toggleAlgorithm(algorithm.id)}
                >
                  <div className="algorithm-topline">
                    <span className="algorithm-index">0{index + 1}</span>
                    <span className="algorithm-icon"><Icon aria-hidden="true" /></span>
                  </div>
                  <div className="algorithm-heading-row">
                    <h3>{algorithm.name}</h3>
                    <span className={`algorithm-check ${isActive ? "algorithm-check-on" : ""}`} aria-hidden="true"><Check /></span>
                  </div>
                  <span className="algorithm-short">{algorithm.short}</span>
                  <p>{algorithm.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {isAnimating ? (
          <section className="py-12 border-b border-[var(--border)]" aria-live="assertive">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" /> Live Simulation in Progress
              </h2>
              <p className="text-[var(--muted-foreground)]">Processing page reference {playbackStep + 1} of {pages.length}</p>
            </div>
            
            <div className="flex flex-col items-center gap-12">
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl px-4">
                {pages.map((p, i) => (
                  <div key={i} className={`w-10 h-10 border flex items-center justify-center font-mono font-bold rounded-md transition-all duration-300 ${
                    i === playbackStep ? 'border-primary bg-[var(--blue-soft)] text-primary scale-125 shadow-md z-10' : 
                    i < playbackStep ? 'opacity-40 border-[var(--border)] bg-transparent' : 'opacity-100 border-[var(--border)] bg-[var(--surface-raised)]'
                  }`}>
                    {p}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-8 w-full max-w-6xl">
                {selectedAlgorithms.map(algo => {
                  const result = results?.find(r => r.id === algo);
                  const currentStepData = result?.steps[playbackStep];
                  if (!currentStepData) return null;
                  
                  const frames = Array.from({ length: frameCount }, (_, i) => currentStepData.frames[i]);
                  const runningFaults = result.steps.slice(0, playbackStep + 1).filter(s => !s.hit).length;
                  const runningHits = result.steps.slice(0, playbackStep + 1).filter(s => s.hit).length;
                  const algoInfo = algorithms.find(a => a.id === algo);
                  
                  return (
                    <div key={algo} className="border border-[var(--border)] rounded-xl p-6 bg-[var(--surface-raised)] shadow-sm w-72 flex flex-col items-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-[var(--algorithm-accent)] opacity-50"></div>
                      <h3 className="font-bold text-lg mb-6 uppercase tracking-wider">{algoInfo?.name}</h3>
                      
                      <div className="flex gap-3 mb-8">
                        {frames.map((f, i) => {
                          const isJustUpdated = f === pages[playbackStep];
                          return (
                            <div key={i} className="relative w-14 h-16">
                              <AnimatePresence>
                                {f !== undefined ? (
                                  <motion.div
                                    key={f}
                                    initial={{ y: -40, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 40, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`absolute inset-0 border-2 flex items-center justify-center font-mono text-2xl font-bold rounded-lg z-10 ${
                                      isJustUpdated && currentStepData.hit ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green-ink)] shadow-md' :
                                      isJustUpdated && !currentStepData.hit ? 'border-[var(--red)] bg-[var(--red-soft)] text-[var(--red-ink)] shadow-md' :
                                      'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--foreground)]'
                                    }`}
                                  >
                                    {f}
                                  </motion.div>
                                ) : (
                                  <motion.div 
                                    key="empty"
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 border-2 border-dashed border-[var(--border)] bg-transparent rounded-lg flex items-center justify-center text-[var(--muted-foreground)]"
                                  >
                                    -
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              
                              {/* Overlay animation for hits: a ghost string falling down and merging */}
                              {isJustUpdated && currentStepData.hit && (
                                <motion.div
                                  key={`ghost-${playbackStep}`}
                                  initial={{ y: -60, opacity: 1, scale: 1.5 }}
                                  animate={{ y: 0, opacity: 0, scale: 1 }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                  className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold text-[var(--green-ink)] z-20 pointer-events-none"
                                >
                                  {f}
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-8 w-full justify-center">
                        <div className="text-center">
                          <span className="block text-[10px] text-[var(--muted-foreground)] font-bold tracking-widest mb-1">FAULTS</span>
                          <div className="text-2xl font-bold text-[var(--red-ink)] leading-none">{runningFaults}</div>
                        </div>
                        <div className="text-center">
                          <span className="block text-[10px] text-[var(--muted-foreground)] font-bold tracking-widest mb-1">HITS</span>
                          <div className="text-2xl font-bold text-[var(--green-ink)] leading-none">{runningHits}</div>
                        </div>
                      </div>
                      
                      <div className={`mt-6 p-3 rounded-lg font-bold text-[11px] tracking-wide transition-all duration-300 w-full text-center flex flex-col ${
                        currentStepData.hit ? 'bg-[var(--green-soft)] text-[var(--green-ink)]' : 'bg-[var(--red-soft)] text-[var(--red-ink)]'
                      }`}>
                        <span className="uppercase mb-1">{currentStepData.hit ? "Page Hit" : "Page Fault"}</span>
                        {currentStepData.reason && (
                          <span className="text-[10px] font-medium opacity-80 normal-case leading-tight">
                            {currentStepData.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-16 pt-8 border-t border-white/5">
              <div className="flex bg-[var(--surface-muted)] rounded-lg p-1 border border-[var(--border)] shadow-md backdrop-blur-md">
                {[
                  { label: "0.5x", value: 3000 },
                  { label: "1x", value: 1500 },
                  { label: "2x", value: 750 },
                  { label: "Fast", value: 300 }
                ].map(speed => (
                  <button
                    key={speed.label}
                    onClick={() => setPlaybackSpeed(speed.value)}
                    className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                      playbackSpeed === speed.value 
                        ? 'bg-[var(--blue-ink)] text-white shadow-lg scale-105' 
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5'
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsAnimating(false); setSelectedStep(pages.length - 1); }}
                className="border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--surface-raised)] hover:text-white transition-colors"
              >
                Skip Animation
              </Button>
            </div>
          </section>
        ) : results ? (
          <>
            <section className="results-section" aria-labelledby="results-title">
              <div className="section-heading">
                <div className="section-heading-main">
                  <span className="section-number">03</span>
                  <div><h2 id="results-title">Simulation results</h2><p>{pages.length} references · {frameCount} {frameCount === 1 ? "frame" : "frames"}</p></div>
                </div>
                <Button type="button" variant="outline" size="sm" className="reset-button" onClick={resetAll}>
                  <RotateCcw aria-hidden="true" /> Reset
                </Button>
              </div>

              <div className="results-grid">
                {resultList.map((result) => {
                  const config = algorithms.find((algorithm) => algorithm.id === result.id);
                  const faultRatio = (result.faults / pages.length) * 100;
                  const hitRatio = (result.hits / pages.length) * 100;
                  const isWinner = winners.some((item) => item.id === result.id);
                  return (
                    <article key={result.id} className={`result-card result-${result.id} ${isWinner ? "result-winner" : ""}`}>
                      <div className="result-card-heading">
                        <div><span className="result-algorithm-tag">{config?.name}</span><h3>{config?.short}</h3></div>
                        {isWinner && <span className="best-badge"><Check aria-hidden="true" /> FEWEST FAULTS</span>}
                      </div>
                      <div className="result-primary-metric"><span className="result-number">{result.faults}</span><span className="result-metric-label">page faults</span></div>
                      <div className="result-secondary-metrics">
                        <div><span className="metric-caption">PAGE HITS</span><strong>{result.hits}</strong></div>
                        <div><span className="metric-caption">FAULT RATIO</span><strong>{faultRatio.toFixed(1)}<small>%</small></strong></div>
                        <div><span className="metric-caption">HIT RATIO</span><strong>{hitRatio.toFixed(1)}<small>%</small></strong></div>
                      </div>
                      <div className="ratio-track" aria-label={`${result.hits} hits and ${result.faults} faults`}>
                        <span className="ratio-hit" style={{ width: `${hitRatio}%` }} />
                        <span className="ratio-fault" style={{ width: `${faultRatio}%` }} />
                      </div>
                      <div className="ratio-legend"><span><i className="legend-hit" />Hits</span><span><i className="legend-fault" />Faults</span></div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="comparison-section" aria-labelledby="comparison-title">
              <div className="section-heading">
                <div className="section-heading-main">
                  <span className="section-number">04</span>
                  <div><h2 id="comparison-title">Fault comparison</h2><p>Fewer faults means fewer trips to secondary storage.</p></div>
                </div>
                <BarChart3 className="comparison-heading-icon" aria-hidden="true" />
              </div>
              <div className="comparison-content">
                <div className="chart-area" role="img" aria-label={`Page faults by algorithm: ${chartData.map((item) => `${item.name} ${item.faults}`).join(", ")}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: -16, bottom: 4 }} barCategoryGap="38%">
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12, fontWeight: 600 }} dy={10} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} width={34} />
                      <Tooltip cursor={{ fill: "var(--chart-cursor)" }} contentStyle={{ backgroundColor: "var(--chart-tooltip)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--foreground)", fontSize: 12 }} formatter={(value) => [value, "Page faults"]} />
                      <Bar dataKey="faults" radius={[4, 4, 0, 0]} maxBarSize={62}>
                        {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="comparison-verdict">
                  <span className="verdict-icon"><ArrowDownRight aria-hidden="true" /></span>
                  <span className="verdict-label">{winners.length > 1 ? "TIED RESULT" : "BEST RESULT"}</span>
                  {(() => {
                    const names = winners.map((result) => algorithms.find((algorithm) => algorithm.id === result.id)?.name ?? result.id);
                    const joined = names.length > 2 ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}` : names.join(" and ");
                    return (
                      <p>
                        {winners.length > 1
                          ? `${names.length === 2 ? "Both " : ""}${joined} produced the same number of page faults for this reference string.`
                          : `${joined} produced the fewest page faults for this reference string.`}
                      </p>
                    );
                  })()}
                  <span className="verdict-caption">{winner?.faults} faults across {pages.length} page references</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 border-[var(--border)] text-xs bg-[var(--surface-muted)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue-ink)] transition-all"
                    onClick={exportCSV}
                  >
                    <Download className="w-3 h-3 mr-2" /> Export to CSV
                  </Button>
                </div>
              </div>
            </section>

            <section className="steps-section" aria-labelledby="steps-title">
              <div className="section-heading steps-heading">
                <div className="section-heading-main">
                  <span className="section-number">05</span>
                  <div><h2 id="steps-title">Step-by-step simulation</h2><p>Choose a row to inspect memory at that moment.</p></div>
                </div>
                <span className="steps-counter">{String(selectedStep + 1).padStart(2, "0")} <span>/</span> {String(pages.length).padStart(2, "0")}</span>
              </div>
              <div className="selected-step-summary">
                <span className="selected-step-label">SELECTED REFERENCE</span>
                <span className="selected-page">{pages[selectedStep]}</span>
                <span className="selected-step-divider" />
                <div className="flex flex-col gap-1 ml-2">
                  {selectedAlgorithms.map((algorithm) => {
                    const stepInfo = results.find(r => r.id === algorithm)?.steps[selectedStep];
                    if (!stepInfo || !stepInfo.reason) return null;
                    return (
                      <span key={algorithm} className="text-[10px] text-[var(--muted-foreground)]">
                        <strong className={`uppercase text-[var(--${algorithm}-ink, var(--primary))] mr-1`}>{algorithms.find(a => a.id === algorithm)?.name}:</strong> 
                        {stepInfo.reason}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="table-scroll" role="region" aria-label="Step-by-step frame states" tabIndex={0}>
                <table className="simulation-table">
                  <thead>
                    <tr>
                      <th className="step-col" rowSpan={2}>STEP</th>
                      <th className="page-col" rowSpan={2}>PAGE</th>
                      {selectedAlgorithms.map((algorithm) => <th key={algorithm} className={`algorithm-header header-${algorithm}`} colSpan={2}>{algorithms.find((item) => item.id === algorithm)?.name}</th>)}
                    </tr>
                    <tr>{selectedAlgorithms.flatMap((algorithm) => [
                      <th key={`${algorithm}-frames`} className="sub-header">MEMORY FRAMES</th>,
                      <th key={`${algorithm}-status`} className="sub-header status-sub-header">STATUS</th>,
                    ])}</tr>
                  </thead>
                  <tbody>
                    {pages.map((page, index) => {
                      const active = selectedStep === index;
                      return (
                        <tr key={`${index}-${page}`} className={active ? "selected-row" : ""} onClick={() => setSelectedStep(index)} aria-selected={active}>
                          <td className="step-cell"><Button type="button" variant="ghost" size="sm" className="step-select" aria-label={`Inspect step ${index + 1}`} aria-pressed={active} onClick={(event) => { event.stopPropagation(); setSelectedStep(index); }}>{String(index + 1).padStart(2, "0")}</Button></td>
                          <td className="page-cell"><span>{page}</span></td>
                          {selectedAlgorithms.map((algorithm) => {
                            const algorithmResult = results.find((item) => item.id === algorithm);
                            const step = algorithmResult?.steps[index];
                            if (!step) return null;
                            const slots = Array.from({ length: Math.min(frameCount, 100) }, (_, slot) => step.frames[slot]);
                            return (
                              <FragmentStepCells key={algorithm} algorithm={algorithm} frames={slots} hit={step.hit} />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="table-legend"><span><i className="legend-hit" /> HIT <span className="legend-detail">· page already in memory</span></span><span><i className="legend-fault" /> FAULT <span className="legend-detail">· page loaded into a frame</span></span></div>
            </section>
          </>
        ) : (
          <section className="empty-state" aria-live="polite">
            <span className="empty-icon"><Cpu aria-hidden="true" /></span>
            <div><h2>Your memory trace will appear here.</h2><p>Enter a frame count and reference string, pick the algorithms you want, then run a simulation.</p></div>
            <span className="empty-arrow"><ArrowDownRight aria-hidden="true" /></span>
          </section>
        )}

        <section className="how-section" aria-labelledby="how-title">
          <div className="how-heading">
            <span className="section-number">{results ? "06" : "03"}</span>
            <div><h2 id="how-title">A few useful terms</h2><p>The essentials behind each memory trace.</p></div>
          </div>
          <div className="definition-grid">
            <article className="definition-item"><span className="definition-mark mark-fault">F</span><div><h3>Page fault</h3><p>The requested page is not in a frame, so it must be loaded.</p></div></article>
            <article className="definition-item"><span className="definition-mark mark-hit">H</span><div><h3>Page hit</h3><p>The requested page is already in memory and can be reused.</p></div></article>
            <article className="definition-item"><span className="definition-mark mark-policy">↻</span><div><h3>Replacement policy</h3><p>When every frame is full, the policy decides which page leaves.</p></div></article>
            <article className="definition-item"><span className="definition-mark mark-study"><BookOpen aria-hidden="true" /></span><div><h3>What to compare</h3><p>Run the same references again to see how replacement choices affect faults.</p></div></article>
          </div>
        </section>

        <footer className="app-footer">
          <a href="#top" className="footer-brand">MEMORY<span>LAB</span></a>
          <span>PAGE REPLACEMENT ALGORITHM SIMULATOR</span>
          <span>COOS MINI PROJECT · B.TECH AIML</span>
        </footer>
      </div>

      {/* History Sidebar overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-sm bg-[var(--popover)] border-l border-[var(--border)] h-full shadow-2xl p-6 overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5 text-[var(--primary)]" /> Run History</h3>
                <button onClick={() => setShowHistory(false)} className="text-[var(--muted-foreground)] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center mt-10">No recent runs. Run a simulation to save it here!</p>
              ) : (
                <div className="space-y-4">
                  {history.map(run => (
                    <div key={run.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{run.timestamp.toLocaleTimeString()}</span>
                        {run.winner && <span className="text-[10px] font-bold text-white bg-[var(--primary)] px-2 py-0.5 rounded-full">Winner: {run.winner}</span>}
                      </div>
                      <div className="text-sm mb-1"><span className="text-[var(--muted-foreground)]">Frames:</span> <strong className="text-white">{run.frameText}</strong></div>
                      <div className="text-sm line-clamp-2"><span className="text-[var(--muted-foreground)]">String:</span> <span className="font-mono text-white">{run.referenceText}</span></div>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full mt-4 border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue-ink)]"
                        onClick={() => {
                          setFrameText(run.frameText);
                          setReferenceText(run.referenceText);
                          setShowHistory(false);
                          runSimulation(run.frameText, run.referenceText);
                        }}
                      >
                        <RotateCcw className="w-3 h-3 mr-2" /> Rerun Simulation
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function FragmentStepCells({ algorithm, frames, hit }: { algorithm: AlgorithmId; frames: (number | undefined)[]; hit: boolean }) {
  return (
    <>
      <td className={`memory-cell memory-${algorithm}`}>
        <div className="frame-slots">
          {frames.map((page, index) => <span key={index} className={`frame-slot ${page === undefined ? "frame-empty" : ""}`}>{page ?? "–"}</span>)}
        </div>
      </td>
      <td className="status-cell"><span className={`status-badge ${hit ? "status-hit" : "status-fault"}`}>{hit ? "HIT" : "FAULT"}</span></td>
    </>
  );
}