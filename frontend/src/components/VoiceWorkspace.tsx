"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { processToolApi, getDownloadUrl } from "../lib/api";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Sparkles,
  ArrowRight,
  Globe,
  RefreshCw,
  Trash2,
  Check,
  FileCheck2,
  Languages,
  ChevronRight
} from "lucide-react";

const DOC_TYPES = [
  "Report",
  "Assignment",
  "Study Notes",
  "Formal Letter",
  "Email",
  "Resume",
  "Project Proposal",
  "Article",
  "Essay",
  "Meeting Notes",
  "General Document"
];

const OUTPUT_FORMATS = [
  { id: "docx", label: "Word (.docx)", ext: "Word" },
  { id: "pdf", label: "PDF Document (.pdf)", ext: "PDF" },
  { id: "txt", label: "Text File (.txt)", ext: "TXT" }
];

const SPEECH_LANGUAGES = [
  { code: "en-IN", name: "English (India)", label: "English" },
  { code: "en-US", name: "English (US)", label: "English (US)" },
  { code: "hi-IN", name: "Hindi (हिन्दी)", label: "Hindi" },
  { code: "ta-IN", name: "Tamil (தமிழ்)", label: "Tamil" },
  { code: "te-IN", name: "Telugu (తెలుగు)", label: "Telugu" },
  { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", label: "Kannada" },
  { code: "ml-IN", name: "Malayalam (മലയാളം)", label: "Malayalam" },
  { code: "bn-IN", name: "Bengali (বাংলা)", label: "Bengali" },
  { code: "mr-IN", name: "Marathi (मराठी)", label: "Marathi" },
  { code: "gu-IN", name: "Gujarati (ગુજરાતી)", label: "Gujarati" },
  { code: "pa-IN", name: "Punjabi (ਪੰਜਾਬੀ)", label: "Punjabi" },
  { code: "ur-IN", name: "Urdu (اردو)", label: "Urdu" }
];

export default function VoiceWorkspace() {
  const { user, refreshProfile } = useAuth();

  // Recording State Machine: "idle" | "recording" | "paused" | "stopped"
  const [recordState, setRecordState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Form selections
  const [docType, setDocType] = useState("General Document");
  const [outputFormat, setOutputFormat] = useState("docx");
  const [transcriptText, setTranscriptText] = useState("");

  // Processing state
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Detect SpeechRecognition support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Format recording timer: mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start Speech Recognition
  const initSpeechRecognition = () => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setTranscriptText((prev) => (prev ? prev.trim() + " " + final.trim() : final.trim()));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setError("Microphone permission is required for live speech recognition.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      return recognition;
    } catch (e) {
      console.warn("Failed to create SpeechRecognition:", e);
      return null;
    }
  };

  // 1. Start Recording
  const startRecording = async () => {
    setError(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Collect slice every 250ms

      // Initialize & Start Speech Recognition
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (e) {
          console.warn("SpeechRecognition start error:", e);
        }
      }

      setRecordState("recording");
      setRecordingTime(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError("Microphone permission is required to record. Please allow microphone access in your browser.");
      setRecordState("idle");
    }
  };

  // 2. Pause Recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordState === "recording") {
      mediaRecorderRef.current.pause();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordState("paused");
      setIsListening(false);
    }
  };

  // 3. Resume Recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordState === "paused") {
      mediaRecorderRef.current.resume();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      setRecordState("recording");
    }
  };

  // 4. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && (recordState === "recording" || recordState === "paused")) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordState("stopped");
      setIsListening(false);
    }
  };

  // 5. Re-record / Reset
  const reRecord = () => {
    stopRecording();
    setRecordState("idle");
    setAudioUrl(null);
    setRecordingTime(0);
    setError(null);
  };

  // 6. Generate Document
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transcriptText.trim()) {
      setError("Please record or enter some text first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("transcript_text", transcriptText.trim());
    formData.append("doc_type", docType);
    formData.append("output_format", outputFormat);

    try {
      const data = await processToolApi("voice-to-document", formData, user?.uid);
      setResult(data);
    } catch (err: any) {
      let msg = typeof err === "string" ? err : err.message || "Unable to generate document. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async () => {
    if (!result?.download_key) return;
    setDownloading(true);
    try {
      const url = getDownloadUrl(result.download_key);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = result.filename || "voice_document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      window.open(getDownloadUrl(result.download_key), "_blank");
      if (refreshProfile) {
        setTimeout(refreshProfile, 1000);
      }
    } finally {
      setDownloading(false);
    }
  };

  // Dynamic button label
  const selectedFormatObj = OUTPUT_FORMATS.find((f) => f.id === outputFormat) || OUTPUT_FORMATS[0];
  const generateButtonLabel = `Generate ${docType} (${selectedFormatObj.ext})`;

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* 1. Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-6">
        <Link href="/" className="hover:text-indigo-600 transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Voice & AI</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 font-semibold">Voice → Document</span>
      </nav>

      {/* 2. Tool Hero Section */}
      <div className="relative text-center mb-8 sm:mb-10">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-40 rounded-full pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.07) 50%, transparent 80%)",
            filter: "blur(40px)",
          }}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center shadow-md shadow-indigo-500/10">
            <Mic className="w-7 h-7 text-indigo-600" />
          </div>

          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100/60">
            <Sparkles className="w-3 h-3" />
            AI VOICE TO DOCUMENT
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Voice → Document
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Speak into your microphone in 10+ languages to generate formatted Reports, Letters, Assignments, or Notes in DOCX, PDF, or TXT.
          </p>
        </div>
      </div>

      {/* 3. Main Voice Workspace Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xl shadow-slate-100/50 space-y-6">
        {/* Language & Browser Support Warning */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Languages className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Speech Recognition Language:</span>
          </div>

          <select
            value={selectedLang}
            disabled={recordState === "recording"}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="w-full sm:w-auto p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-600"
          >
            {SPEECH_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {!speechSupported && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Live speech recognition is not supported in this browser. You can record audio and type or paste your transcript below.</span>
          </div>
        )}

        {/* Recording Studio Panel */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50/70 to-slate-50/30 rounded-3xl border border-slate-200/80 text-center space-y-5">
          {/* Animated Microphone Icon */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto flex items-center justify-center">
            {recordState === "recording" && (
              <div
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                style={{ animationDuration: "1.5s" }}
              />
            )}
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                recordState === "recording"
                  ? "bg-red-600 text-white shadow-red-500/30 scale-105"
                  : recordState === "paused"
                  ? "bg-amber-500 text-white shadow-amber-500/25"
                  : "bg-indigo-600 text-white shadow-indigo-500/25"
              }`}
            >
              <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
          </div>

          {/* Real Recording Timer */}
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-wider">
              {formatTime(recordingTime)}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1.5">
              {recordState === "recording" && (
                <span className="flex items-center gap-1 text-red-600 font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Recording Live ({isListening ? "Listening..." : "Recording Audio"})
                </span>
              )}
              {recordState === "paused" && (
                <span className="text-amber-600 font-bold">Recording Paused</span>
              )}
              {recordState === "stopped" && (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Recording Complete ({formatTime(recordingTime)})
                </span>
              )}
              {recordState === "idle" && (
                <span>Ready to record from microphone</span>
              )}
            </div>
          </div>

          {/* Audio Player for Playback when stopped */}
          {audioUrl && (
            <div className="max-w-md mx-auto p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <audio ref={audioPlayerRef} controls src={audioUrl} className="w-full h-10" />
            </div>
          )}

          {/* Recording Action Buttons State Machine */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {recordState === "idle" && (
              <button
                type="button"
                onClick={startRecording}
                className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            )}

            {recordState === "recording" && (
              <>
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-red-500/25 transition"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Recording</span>
                </button>
              </>
            )}

            {recordState === "paused" && (
              <>
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume</span>
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Recording</span>
                </button>
              </>
            )}

            {recordState === "stopped" && (
              <button
                type="button"
                onClick={reRecord}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-record Audio</span>
              </button>
            )}
          </div>
        </div>

        {/* Document Configuration Form */}
        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Document Type & Output Format Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {OUTPUT_FORMATS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Voice Transcript / Text Content (Fully Editable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                3. Voice Transcript / Text Content
              </label>
              {transcriptText && (
                <button
                  type="button"
                  onClick={() => setTranscriptText("")}
                  className="text-xs font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Text
                </button>
              )}
            </div>

            <textarea
              rows={6}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Your spoken speech transcript will appear here in real time as you speak. You can also type, edit, or paste your text directly."
              className="w-full p-4 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition leading-relaxed"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-bold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Dynamic Generate Document Button */}
          <button
            type="submit"
            disabled={loading || !transcriptText.trim()}
            className={`w-full py-4 text-white font-bold rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all duration-300 ${
              loading || !transcriptText.trim()
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:via-violet-500 hover:to-indigo-600 shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generating your document...</span>
              </div>
            ) : (
              <>
                <span>{generateButtonLabel}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Success Result & Download Screen */}
        {result && (
          <div className="mt-8 p-6 sm:p-8 bg-emerald-50/90 border border-emerald-200 rounded-3xl space-y-5 animate-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900">Document Ready!</h4>
                <p className="text-xs text-slate-600">Your voice document has been successfully created and formatted.</p>
              </div>
            </div>

            {/* Ready Output File Card */}
            <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {result.filename || `DocFlow_${docType}.${outputFormat}`}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Ready for download
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {result.download_key && (
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={downloading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-80"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Downloading Document...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Download Document</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setTranscriptText("");
                  setRecordState("idle");
                  setAudioUrl(null);
                }}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <span>Create Another Document</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
