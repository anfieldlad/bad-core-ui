'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

type ExtractResult = {
  status: string;
  source?: string;
  data: Record<string, unknown>;
};

// Human-friendly label + styling hint for the backend `source` value.
const describeSource = (source?: string): { label: string; cached: boolean } => {
  if (!source) return { label: 'Unknown', cached: false };
  const s = source.toLowerCase();
  if (s.includes('hash')) return { label: 'Cached · exact image', cached: true };
  if (s.includes('nik')) return { label: 'Cached · same NIK', cached: true };
  if (s.includes('cache')) return { label: 'Cached', cached: true };
  if (s === 'gemini') return { label: 'Google Gemini', cached: false };
  if (s === 'openai') return { label: 'OpenAI-compatible', cached: false };
  return { label: source, cached: false };
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const prettyKey = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showRaw, setShowRaw] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Mengambil URL dari .env.local
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'your_secret_api_key';

  // Revoke object URL when the preview changes/unmounts to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback(
    (f: File) => {
      setError('');
      setResult(null);
      setShowRaw(false);
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    },
    [previewUrl]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) selectFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError('');
    setShowRaw(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Health check with Render free tier wake-up handling
  const checkBackendHealth = async (): Promise<boolean> => {
    const HEALTH_TIMEOUT = 120000; // 120 seconds (2 minutes) max wait
    setLoadingMessage('🔌 Checking backend connection...');

    const wakeUpTimer = setTimeout(() => {
      setLoadingMessage('☕ Backend is waking up (Render Free Tier)... Please wait up to 1 minute.');
    }, 5000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

      const res = await fetch(`${API_URL}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearTimeout(wakeUpTimer);

      if (res.ok) {
        setLoadingMessage('✅ Backend ready! Processing your document...');
        return true;
      }
      throw new Error('Backend health check failed');
    } catch (err: unknown) {
      clearTimeout(wakeUpTimer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('⏱️ Backend took too long to respond (2 minutes timeout). Please try again later.');
      }
      if (err instanceof TypeError) {
        throw new Error('📡 Cannot connect to backend. Please check your connection or try again.');
      }
      throw err;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('⚠️ Please select a document first.');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingMessage('');

    try {
      // Step 1: Health check first
      await checkBackendHealth();

      // Step 2: Proceed with extraction
      setLoadingMessage('🧠 Extracting data with AI...');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Server Error: ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'success') {
        setResult(data);
      } else {
        // Backend returned an error envelope
        throw new Error(data.detail || 'Extraction failed.');
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sourceInfo = result ? describeSource(result.source) : null;
  const fieldCount = result ? Object.keys(result.data).length : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* Background Decor (Glow Effect) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-[-10%] right-1/4 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:py-16">
        {/* HEADER */}
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-400 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            Document Intelligence Engine
          </div>
          <h1 className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
            BAD CORE
          </h1>
          <p className="mt-2 text-xs font-medium uppercase leading-relaxed tracking-wide text-slate-500">
            Business Automated Docs · Character Optical Recognition Engine
          </p>
        </header>

        {/* MAIN GRID */}
        <div className="grid flex-1 gap-6 lg:grid-cols-2">
          {/* LEFT: UPLOAD PANEL */}
          <section className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-lg">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-500/15 text-blue-400">1</span>
              Upload Document
            </h2>

            {/* PRIVACY WARNING */}
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-900/20 p-3">
              <span className="text-lg text-amber-500">⚠️</span>
              <p className="text-xs font-medium leading-relaxed text-amber-200/80">
                <span className="mr-1 font-bold uppercase text-amber-500">Important:</span>
                Do not upload real KTP documents. This environment is for testing purposes only.
              </p>
            </div>

            {/* DROP ZONE */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
              }}
              className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all
                ${
                  isDragging
                    ? 'border-blue-400 bg-blue-500/10'
                    : 'border-slate-700 hover:border-blue-500/60 hover:bg-slate-800/40'
                }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*, application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {previewUrl ? (
                // Image preview
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-44 w-auto rounded-lg border border-slate-700 object-contain shadow-lg"
                />
              ) : file ? (
                // Non-image (PDF) card
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <svg className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
              ) : (
                <>
                  <svg className="h-12 w-12 text-slate-500 transition-colors group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      <span className="text-blue-400">Click to browse</span> or drag &amp; drop
                    </p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, or PDF</p>
                  </div>
                </>
              )}
            </div>

            {/* SELECTED FILE META */}
            {file && (
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-blue-400">📄</span>
                  <span className="truncate text-xs font-medium text-slate-300" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">{formatBytes(file.size)}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-slate-700 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}

            {/* ACTION BUTTON */}
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className={`w-full rounded-xl px-6 py-4 font-bold text-white shadow-lg transition-all duration-300
                ${
                  loading
                    ? 'cursor-wait bg-slate-700 opacity-70'
                    : !file
                    ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'transform bg-gradient-to-r from-blue-600 to-indigo-600 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/25'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">{loadingMessage || 'Processing...'}</span>
                </span>
              ) : (
                'Extract Data'
              )}
            </button>

            {/* ERROR DISPLAY */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-900/20 p-4">
                <span className="text-xl text-red-500">⚠️</span>
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
          </section>

          {/* RIGHT: RESULT PANEL */}
          <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-500/15 text-blue-400">2</span>
                Extracted Data
              </h2>
              {result && (
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                  {fieldCount} fields
                </span>
              )}
            </div>

            {result ? (
              <div className="flex flex-1 flex-col animate-fade-in-up">
                {/* STATUS ROW */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-green-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                    Success
                  </span>
                  {sourceInfo && (
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        sourceInfo.cached
                          ? 'border-purple-500/20 bg-purple-500/10 text-purple-300'
                          : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {sourceInfo.cached ? '⚡ ' : '🧠 '}
                      {sourceInfo.label}
                    </span>
                  )}
                </div>

                {/* TOOLBAR */}
                <div className="mb-3 flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                  >
                    {copied ? '✓ Copied' : '⧉ Copy JSON'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                  >
                    ↓ Download
                  </button>
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                  >
                    {showRaw ? 'Table view' : 'Raw JSON'}
                  </button>
                </div>

                {/* DATA */}
                {showRaw ? (
                  <pre className="max-h-[420px] flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-relaxed text-cyan-200">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                ) : (
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-inner">
                    <table className="w-full border-collapse text-left text-sm">
                      <tbody className="divide-y divide-slate-800/50">
                        {Object.entries(result.data).map(([key, value]) => (
                          <tr key={key} className="group/row transition-colors hover:bg-blue-500/5">
                            <td className="w-2/5 border-r border-slate-800/50 px-4 py-3 text-[11px] font-semibold uppercase tracking-tight text-slate-500">
                              {prettyKey(key)}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-200 transition-colors group-hover/row:text-blue-300">
                              {typeof value === 'string' ? value : JSON.stringify(value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-800/40 px-6 py-3 text-sm font-bold text-slate-300 transition-all hover:border-blue-500/50 hover:text-blue-300"
                >
                  ↺ Extract Another
                </button>
              </div>
            ) : (
              // IDLE / EMPTY STATE
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 py-16 text-center">
                <svg className="h-14 w-14 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                </svg>
                <p className="text-sm font-medium text-slate-500">No data yet</p>
                <p className="max-w-xs text-xs text-slate-600">
                  Upload a document and hit <span className="font-semibold text-slate-400">Extract Data</span> — the parsed fields will appear here.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-slate-600">
          &copy; 2025 BAD CORE System.
        </footer>
      </div>
    </main>
  );
}
