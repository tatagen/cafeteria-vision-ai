import { useState, useEffect, useRef, useCallback, ReactNode, useMemo } from "react";
import { 
  Camera, 
  Trash2, 
  AlertCircle, 
  Clock, 
  History,
  LayoutDashboard,
  Timer,
  RefreshCw,
  CameraOff,
  Settings,
  Monitor,
  Lock,
  ChevronRight,
  Download,
  BarChart2,
  LogOut,
  Pause,
  Play,
  Save,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from "recharts";
import { CafeteriaAnalysis } from "./services/gemini";
import { analyzeLocalCafeteriaFrame } from "./services/localVision";
import { db } from "./lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  Timestamp, 
  serverTimestamp,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  addDoc
} from "firebase/firestore";

// --- Types & Constants ---

interface AnalysisRecord extends CafeteriaAnalysis {
  id: string;
  timestamp: string; 
  snapshot?: string;
}

const INTERVAL_SECONDS = 90;
const ADMIN_ID = "admin";
const ADMIN_PW = "admin123";
const DEFAULT_STORE_CAPACITY = 120;

type ViewMode = "public" | "admin" | "login" | "dashboard";

const createClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getCongestionColor = (level: string) => {
  switch (level) {
    case "空席あり": return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", bar: "bg-emerald-500" };
    case "やや混雑": return { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", bar: "bg-blue-500" };
    case "混雑": return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", bar: "bg-amber-500" };
    case "満席": return { text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", bar: "bg-rose-500" };
    default: return { text: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200", bar: "bg-slate-300" };
  }
};

// --- Main Component ---

export default function App() {
  const [view, setView] = useState<ViewMode>("public");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Local state for this specific node
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisRecord | null>(null);
  
  // Aggregate state from all active nodes
  const [aggregateAnalysis, setAggregateAnalysis] = useState<AnalysisRecord | null>(null);
  
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [storeCapacity, setStoreCapacity] = useState(() => {
    const stored = Number(localStorage.getItem("cafeteria_store_capacity"));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_STORE_CAPACITY;
  });

  // Unique ID for this device/session
  const [nodeId] = useState(() => {
    let id = localStorage.getItem("cafeteria_node_id");
    if (!id) {
      id = createClientId();
      localStorage.setItem("cafeteria_node_id", id);
    }
    return id;
  });

  const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState(true);
  const [countdown, setCountdown] = useState(INTERVAL_SECONDS);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // REMOVED: Local storage sync for history is no longer needed as we use Firestore
  // useEffect(() => {
  //   localStorage.setItem("cafeteria_last_analysis", JSON.stringify(lastAnalysis));
  //   localStorage.setItem("cafeteria_history", JSON.stringify(history));
  // }, [lastAnalysis, history]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      streamRef.current = mediaStream;
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setIsCameraActive(true);
      setError(null);
    } catch (err) {
      setError("カメラの権限が拒否されたか、デバイスが見つかりません。 ブラウザの設定でカメラの使用を許可してください。");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const performAnalysis = useCallback(async () => {
    if (isAnalyzing || !videoRef.current || !isCameraActive) return;
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL("image/jpeg", 0.7).split(",")[1];
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeLocalCafeteriaFrame(canvasRef.current, storeCapacity);

      const record: AnalysisRecord = {
        ...result,
        id: createClientId(),
        timestamp: new Date().toISOString(),
        snapshot: `data:image/jpeg;base64,${base64}`
      };
      setLastAnalysis(record);
      
      // Update this node's data in Firebase
      await setDoc(doc(db, "nodes", nodeId), {
        ...result,
        id: nodeId,
        lastUpdate: serverTimestamp()
      });

      setError(null);
    } catch (err) {
      setError("ローカルAI解析中にエラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
      setCountdown(INTERVAL_SECONDS);
    }
  }, [isAnalyzing, isCameraActive, nodeId, storeCapacity]);

  // Sync effect: Listen to all active nodes and aggregate data
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "nodes"), (snapshot) => {
      const now = Date.now();
      const nodes: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only consider nodes active in the last 10 minutes
        const lastUpdate = data.lastUpdate?.toDate()?.getTime() || 0;
        if (now - lastUpdate < 10 * 60 * 1000) {
          nodes.push(data);
        }
      });

      if (nodes.length === 0) {
        setAggregateAnalysis(null);
        return;
      }

      const totalPeople = nodes.reduce((sum, n) => sum + (n.personCount || 0), 0);
      const hasQueue = nodes.some(n => n.hasQueue);
      
      // Occupancy and congestion are based on store capacity configured in admin.
      const occupancyRate = Math.floor((totalPeople / Math.max(1, storeCapacity)) * 100);
      let level = "空席あり";
      if (occupancyRate > 90) level = "満席";
      else if (occupancyRate > 70) level = "混雑";
      else if (occupancyRate > 40) level = "やや混雑";

      const agg: AnalysisRecord = {
        id: "aggregate",
        timestamp: new Date().toISOString(),
        personCount: totalPeople,
        occupancyRate,
        congestionLevel: level as any,
        hasQueue,
        reasoning: `${nodes.length}台のカメラ合計。定員${storeCapacity}名基準で算出。`
      };
      
      setAggregateAnalysis(agg);
    });

    return () => unsubscribe();
  }, [storeCapacity]);

  useEffect(() => {
    localStorage.setItem("cafeteria_store_capacity", String(storeCapacity));
  }, [storeCapacity]);

  // Listen to history
  useEffect(() => {
    const q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const h: AnalysisRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firebase Timestamp to ISO string for the UI
        const timestamp = data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate().toISOString() 
          : new Date().toISOString();
        h.push({ ...data, id: doc.id, timestamp } as AnalysisRecord);
      });
      setHistory(h);
    });
    return () => unsubscribe();
  }, []);

  // One node (the longest active or a specific "leader") saves aggregated history every INTERVAL
  useEffect(() => {
    if (!autoAnalysisEnabled || !aggregateAnalysis || !isLoggedIn) return; // For now only logged in admin nodes save history to prevent spam
    
    const saveToHistory = async () => {
      try {
        await addDoc(collection(db, "history"), {
          ...aggregateAnalysis,
          timestamp: serverTimestamp()
        });
      } catch (e) {
        console.error("History save failed", e);
      }
    };

    const interval = setInterval(saveToHistory, INTERVAL_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [autoAnalysisEnabled, aggregateAnalysis, isLoggedIn]);

  useEffect(() => {
    if (autoAnalysisEnabled && isCameraActive) {
      timerRef.current = setInterval(performAnalysis, INTERVAL_SECONDS * 1000);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => (prev <= 1 ? INTERVAL_SECONDS : prev - 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setCountdown(INTERVAL_SECONDS); // Reset countdown in manual mode
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [autoAnalysisEnabled, isCameraActive, performAnalysis]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive, view]);

  const handleManualOverride = (updates: Partial<CafeteriaAnalysis>) => {
    if (!lastAnalysis) {
      const initial: AnalysisRecord = {
        personCount: 0,
        congestionLevel: "空席あり",
        occupancyRate: 0,
        hasQueue: false,
        id: createClientId(),
        timestamp: new Date().toISOString(),
      };
      setLastAnalysis({ ...initial, ...updates });
      return;
    }
    const updated = { ...lastAnalysis, ...updates };
    setLastAnalysis(updated);
  };

  const exportCSV = () => {
    const exportedAt = new Date();
    const exportedAtText = exportedAt.toLocaleString("ja-JP");
    const headers = ["日時", "人数", "混雑度", "占有率"];
    const rows = history.map(h => [
      new Date(h.timestamp).toLocaleString("ja-JP"),
      h.personCount,
      h.congestionLevel,
      h.occupancyRate,
    ]);
    const csvBody = [
      ["出力日時", exportedAtText],
      [],
      headers,
      ...rows,
    ].map((e) => e.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvBody], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    const fileTimestamp = exportedAt.toISOString().replace(/[:.]/g, "-");
    link.download = `cafeteria_report_${fileTimestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("public")}>
            <h1 className="font-extrabold text-lg tracking-tight">食堂なう</h1>
          </div>
          <nav className="flex items-center gap-1">
            {isLoggedIn ? (
              <>
                <button onClick={() => setView("admin")} className={`px-4 py-2 rounded-none text-sm font-bold ${view === "admin" ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-500"}`}>管理</button>
                <button onClick={() => setView("dashboard")} className={`px-4 py-2 rounded-none text-sm font-bold ${view === "dashboard" ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-500"}`}>統計</button>
                <button onClick={() => setIsLoggedIn(false)} className="p-2 text-slate-400 hover:text-rose-500"><LogOut size={18} /></button>
              </>
            ) : (
              <button onClick={() => setView("login")} className="px-4 py-2 bg-slate-100 text-slate-900 rounded-none font-bold text-sm">管理ログイン</button>
            )}
          </nav>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {view === "public" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="text-center py-6">
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-2">混雑状況</h2>
                <p className="text-slate-500 font-medium whitespace-pre-wrap font-mono uppercase tracking-widest text-xs">AI リアルタイム 統合フィード</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-none border border-slate-200 shadow-sm space-y-8">
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className={`p-10 rounded-none border-2 flex flex-col items-center justify-center min-w-[200px] flex-1 ${aggregateAnalysis ? getCongestionColor(aggregateAnalysis.congestionLevel).bg + " " + getCongestionColor(aggregateAnalysis.congestionLevel).border : "bg-slate-50 border-slate-100"}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">状況</p>
                      <h3 className={`text-5xl font-black ${aggregateAnalysis ? getCongestionColor(aggregateAnalysis.congestionLevel).text : "text-slate-300"}`}>
                         {aggregateAnalysis?.congestionLevel ?? "待機中"}
                      </h3>
                    </div>
                    <div className="flex-1 w-full space-y-6">
                      <div>
                        <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-500">占有率</span><span className="text-xl font-black">{aggregateAnalysis?.occupancyRate ?? 0}%</span></div>
                        <div className="h-3 bg-slate-100 rounded-none overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, aggregateAnalysis?.occupancyRate ?? 0)}%` }} className={`h-full ${aggregateAnalysis ? getCongestionColor(aggregateAnalysis.congestionLevel).bar : "bg-slate-300"}`} />
                        </div>
                      </div>
                      <div className="flex p-4 bg-slate-50 rounded-none border border-slate-100">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">合計人数</p><p className="text-lg font-black">{Math.floor(aggregateAnalysis?.personCount ?? 0).toLocaleString()} 名</p></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-none text-white space-y-6">
                  <h4 className="text-xl font-bold flex items-center gap-2 text-blue-400"><AlertCircle size={20} /> システム状態</h4>
                  <p className="text-slate-400 text-sm italic leading-relaxed">
                    {aggregateAnalysis?.reasoning ?? "複数のカメラノードからのデータを待機しています。"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {view === "login" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center flex-col items-center min-h-[60vh] gap-6">
              <div className="bg-white p-8 rounded-none shadow-xl border border-slate-100 w-full max-w-sm">
                <h2 className="text-2xl font-black text-center mb-6">管理者ログイン</h2>
                <form className="space-y-4" onSubmit={e => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  if (fd.get("id") === ADMIN_ID && fd.get("pw") === ADMIN_PW) { setIsLoggedIn(true); setView("admin"); }
                  else { setError("認証に失敗しました。"); }
                }}>
                  <input name="id" type="text" placeholder="ID" className="w-full p-4 bg-slate-50 rounded-none border border-slate-200" required />
                  <input name="pw" type="password" placeholder="Password" className="w-full p-4 bg-slate-50 rounded-none border border-slate-200" required />
                  {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}
                  <button className="w-full py-4 bg-blue-600 text-white rounded-none font-bold shadow-lg shadow-blue-100">ログイン</button>
                </form>
              </div>
              <button onClick={() => setView("public")} className="text-slate-400 text-sm font-bold">戻る</button>
            </motion.div>
          )}

          {view === "admin" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-black">管理パネル</h2>
                <div className="flex bg-slate-100 p-1 rounded-none border border-slate-200">
                  <button 
                    onClick={() => setAutoAnalysisEnabled(true)} 
                    className={`flex items-center gap-2 px-6 py-2 rounded-none text-xs font-black uppercase tracking-widest transition-all ${autoAnalysisEnabled ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <RefreshCw className={autoAnalysisEnabled ? "animate-spin" : ""} size={14} />
                    自動解析: ON ({countdown}s)
                  </button>
                  <button 
                    onClick={() => setAutoAnalysisEnabled(false)} 
                    className={`flex items-center gap-2 px-6 py-2 rounded-none text-xs font-black uppercase tracking-widest transition-all ${!autoAnalysisEnabled ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <Pause size={14} />
                    手動モード
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-none border border-slate-200 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> パラメータ調整</h3>
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-tighter bg-white text-blue-600 shadow-sm border border-slate-200">
                      Local (Free Vision)
                    </div>
                    <button onClick={performAnalysis} disabled={isAnalyzing} className="px-6 py-2 bg-blue-600 text-white rounded-none font-bold text-xs shadow-lg shadow-blue-100 flex items-center gap-2 uppercase tracking-widest active:scale-95 disabled:opacity-50">
                      <Camera size={14} /> 今すぐスキャン
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                    <div className="space-y-4">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">人数</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleManualOverride({ personCount: Math.max(0, (lastAnalysis?.personCount ?? 0) - 1) })}
                          disabled={autoAnalysisEnabled}
                          className="w-10 h-10 bg-slate-100 rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={lastAnalysis?.personCount ?? 0}
                          onChange={e => handleManualOverride({ personCount: parseInt(e.target.value) || 0 })}
                          disabled={autoAnalysisEnabled}
                          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-none text-center font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={() => handleManualOverride({ personCount: (lastAnalysis?.personCount ?? 0) + 1 })}
                          disabled={autoAnalysisEnabled}
                          className="w-10 h-10 bg-slate-100 rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                      {autoAnalysisEnabled && (
                        <p className="text-[10px] font-bold text-slate-400">自動解析ON中は人数を編集できません。</p>
                      )}
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">店の定員 (人)</label>
                      <input
                        type="number"
                        min="1"
                        value={storeCapacity}
                        onChange={(e) => setStoreCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none font-bold"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">現在の占有率 (%)</label>
                      <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none text-center font-bold text-blue-600">
                        {aggregateAnalysis?.occupancyRate ?? 0}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-900 aspect-video rounded-none overflow-hidden border border-slate-800 relative">
                    <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover opacity-60 ${!isCameraActive && "hidden"}`} />
                    {!isCameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-700 bg-slate-900/40">
                        <CameraOff size={40} />
                        <button 
                          onClick={startCamera}
                          className="px-6 py-2 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest"
                        >
                          カメラを起動する
                        </button>
                        <p className="text-[10px] font-bold uppercase tracking-widest">待機中</p>
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4"><button onClick={() => isCameraActive ? stopCamera() : startCamera()} className={`p-2 rounded-none border ${isCameraActive ? 'border-rose-500/50 text-rose-500' : 'border-emerald-500/50 text-emerald-500'}`}>{isCameraActive ? <CameraOff size={16} /> : <Camera size={16} />}</button></div>
                  </div>
                  <div className="bg-white p-6 rounded-none border border-slate-200 flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">解析履歴</span><Trash2 size={14} className="text-slate-300 hover:text-rose-500 cursor-pointer" onClick={() => { if(confirm("履歴を削除しますか？")) setHistory([]); }} /></div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 select-none">
                      {history.length > 0 ? history.slice(0, 50).map(h => (
                        <div key={h.id} className="p-3 bg-slate-50 border border-slate-100 rounded-none text-xs flex justify-between items-center">
                          <div className="flex flex-col"><span className="text-[9px] text-slate-400 font-mono">{new Date(h.timestamp).toLocaleTimeString([], { hour12: false })}</span><span className="font-bold">{Math.floor(h.personCount).toLocaleString()}名</span></div>
                          <span className={`${getCongestionColor(h.congestionLevel).text} font-bold`}>{h.congestionLevel}</span>
                        </div>
                      )) : <p className="text-center text-slate-400 py-10 text-xs">データなし</p>}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "dashboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div><h2 className="text-3xl font-black">活用状況レポート</h2><p className="text-slate-400 font-medium">混雑傾向の可視化</p></div>
                <button onClick={exportCSV} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-none font-bold"><Download size={18} /> CSV出力</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-none border border-slate-200 shadow-sm h-[400px]">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">利用人数推移</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.map(h => ({ time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), val: h.personCount })).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => Math.floor(val).toLocaleString()} />
                      <Tooltip formatter={(val: number) => [Math.floor(val).toLocaleString() + "名", "人数"]} />
                      <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={0.1} fill="#3b82f6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-none border border-slate-200 shadow-sm h-[400px]">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">占有率推移</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history.map(h => ({ time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), rate: h.occupancyRate })).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-slate-100 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           <p>SmartCafé センサーノード: TYO-01</p>
           <p>© 2026 Vision Systems / 内部使用限定</p>
        </div>
      </footer>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
