"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl } from "../lib/api";
import { Mic, Square, Play, Pause, RotateCcw, FileText, Download, AlertCircle, CheckCircle2, FileCode } from "lucide-react";

const DOC_TYPES = [
  "Report", "Assignment", "Study Notes", "Formal Letter",
  "Email", "Resume", "Project Proposal", "Article",
  "Essay", "Meeting Notes", "General Document"
];

export default function VoiceWorkspace() {
  const { user, profile, refreshProfile } = useAuth();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [docType, setDocType] = useState("General Document");
  const [outputFormat, setOutputFormat] = useState("docx");
  const [transcriptText, setTranscriptText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      setError(null);
    } catch (err: any) {
      setError("Microphone permission denied or not available in your browser.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    stopRecording();
    setAudioUrl(null);
    setRecordingTime(0);
    setTranscriptText("");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptText.trim() && !audioUrl) {
      setError("Voice transcription service is not configured yet. Please enter or record speech transcript text.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("transcript_text", transcriptText);
    formData.append("doc_type", docType);
    formData.append("output_format", outputFormat);

    try {
      const data = await processToolApi("voice-to-document", formData, user?.uid);
      setResult(data);
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      setError(err.message || "Voice document generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-8">
        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
          VOICE & DOCUMENT
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Voice → Document</h1>
        <p className="mt-2 text-slate-600 text-sm max-w-xl mx-auto">
          Record audio using your browser microphone to create formal reports, assignments, or notes in DOCX, PDF, or TXT.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-6">
        {/* Real Microphone Recording UI */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="text-3xl font-black text-slate-800 font-mono">{formatTime(recordingTime)}</div>

          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-red-500/20 flex items-center gap-2 transition"
              >
                <Mic className="w-5 h-5 animate-pulse" />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <Square className="w-4 h-4 text-red-400" />
                  Stop Recording
                </button>
              </>
            )}

            {audioUrl && (
              <button
                type="button"
                onClick={resetRecording}
                className="p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Audio Playback Player */}
          {audioUrl && (
            <div className="pt-2">
              <audio controls src={audioUrl} className="mx-auto w-full max-w-md h-10 rounded-lg" />
            </div>
          )}
        </div>

        {/* Options & Transcript Form */}
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Output Format</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                <option value="docx">Word (.docx)</option>
                <option value="pdf">PDF Document (.pdf)</option>
                <option value="txt">Text File (.txt)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Voice Transcript / Text Content
            </label>
            <textarea
              rows={5}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Speak or type transcript content here (e.g. 'Project Proposal summary: We are building DocFlow document suite...')"
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-2xl text-base transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate {docType} ({outputFormat.toUpperCase()})
              </>
            )}
          </button>
        </form>

        {/* Download Result */}
        {result && result.download_key && (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Document Created!</h4>
                <p className="text-xs text-slate-600">Your voice transcript has been formatted into a valid {outputFormat.toUpperCase()} document.</p>
              </div>
            </div>
            <a
              href={getDownloadUrl(result.download_key)}
              download={result.filename}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition"
            >
              <Download className="w-5 h-5" />
              Download {result.filename}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
