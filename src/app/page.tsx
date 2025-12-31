'use client';
import { useState } from 'react';

const parseMarkdownJson = (markdown: string) => {
  try {
    // Remove markdown code blocks if present
    const cleanJson = markdown.replace(/```json\n|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse markdown JSON:", e);
    return null;
  }
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Mengambil URL dari .env.local
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');     // Reset error saat pilih file baru
      setResult(null);  // Reset hasil sebelumnya
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("⚠️ Please select a document first.");
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Panggil Endpoint Backend
      const res = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Server Error: ${res.status}`);
      }

      const data = await res.json();

      if (data.status === "success") {
        setResult(data);
      } else {
        setResult(data.data || data);
      }

    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to BAD CORE Server.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 font-sans">

      {/* Background Decor (Glow Effect) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-slate-800 p-8">

        {/* HEADER: Updated Branding */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tight">
            BAD CORE
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide uppercase leading-relaxed">
            Business Automated Docs <br /> Character Optical Recognition Engine
          </p>
        </div>

        {/* INPUT SECTION */}
        <div className="space-y-6">

          {/* PRIVACY WARNING */}
          <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <p className="text-amber-200/80 text-xs font-medium leading-relaxed">
              <span className="font-bold text-amber-500 uppercase mr-1">Important:</span>
              Do not upload real KTP documents. This environment is for testing purposes only.
            </p>
          </div>

          {/* File Input */}
          <div className="relative group">
            <input
              type="file"
              accept="image/*, application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400
                file:mr-4 file:py-3 file:px-6
                file:rounded-xl file:border-0
                file:text-sm file:font-bold
                file:bg-slate-800 file:text-blue-400
                file:border border-slate-700
                hover:file:bg-slate-700
                cursor-pointer border border-dashed border-slate-700 rounded-xl p-4 transition-all"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all duration-300
              ${loading
                ? 'bg-slate-700 cursor-wait opacity-70'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/25 transform hover:-translate-y-0.5'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Intelligence...
              </span>
            ) : (
              'Extract Data'
            )}
          </button>
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* RESULT DISPLAY */}
        {result && result.status === "success" && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-green-400 font-semibold text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Extraction Success
              </h3>
              {result.source && (
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                  Source: {result.source}
                </span>
              )}
            </div>

            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-inner group">
              <table className="w-full text-sm text-left border-collapse">
                <tbody className="divide-y divide-slate-800/50">
                  {Object.entries(result.data).map(([key, value]) => (
                    <tr key={key} className="hover:bg-blue-500/5 transition-colors group/row">
                      <td className="px-4 py-3.5 font-mono text-slate-500 uppercase tracking-tight text-[10px] w-1/3 border-r border-slate-800/50">
                        {key.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-200 group-hover/row:text-blue-300 transition-colors">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-[10px] text-slate-600 mt-6 font-medium italic">
              Data successfully processed and validated.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 text-slate-600 text-xs">
        &copy; 2025 BAD CORE System.
      </footer>
    </main>
  );
}