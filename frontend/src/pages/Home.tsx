import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  LogOut,
  Database,
  TrendingUp,
  ShoppingCart,
  MapPin,
  Users,
  Terminal,
  Activity,
  ShieldAlert,
  Gauge,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Code,
  Lock,
  ArrowRight,
  Cpu,
  Shield,
  Layers,
  CheckCircle2,
  Sliders,
  Settings,
  HelpCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";

const suggestedQuestions = [
  {
    icon: TrendingUp,
    question: "按类别显示总销售额",
    category: "销售业绩大盘",
  },
  {
    icon: ShoppingCart,
    question: "交易额排名前五的产品",
    category: "产品销售贡献分析",
  },
  {
    icon: MapPin,
    question: "与去年相比，哪些产品类别的销售额增长最为显著？",
    category: "YoY 同比增长率分析",
  },
  {
    icon: Users,
    question: "显示每个门店的库存水平",
    category: "仓储物流监控",
  },
];

interface APMTrace {
  trace_id: string;
  api_endpoint: string;
  http_method: string;
  sql_statement: string;
  execution_time_ms: number;
  db_instance: string;
  caller_file: string;
  caller_line: number;
  caller_function: string;
  timestamp: number;
}

const Home = () => {
  const [activeView, setActiveTab] = useState<"nl2sql" | "apm" | "tuner" | "datasource">("nl2sql");
  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("管理员");
  const navigate = useNavigate();

  // APM state
  const [traces, setTraces] = useState<APMTrace[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  // Tuning Copilot state
  const [tuningSql, setTuningSql] = useState(
    "SELECT s.category_name, s.transaction_amount, p.item_name \nFROM causal_inference.sales s \nJOIN causal_inference.product p ON s.item_id = p.item_id \nLIMIT 5000;"
  );
  const [tuningResult, setTuningResult] = useState<any>(null);
  const [tuningLoading, setTuningLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Dynamic Database Connection States
  const [dbDialect, setDbDialect] = useState<"postgresql" | "mysql">("postgresql");
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState(5432);
  const [dbName, setDbName] = useState("postgres");
  const [dbUser, setDbUser] = useState("postgres");
  const [dbPassword, setDbPassword] = useState("");
  const [dbTesting, setDbTesting] = useState(false);
  const [currentDbStatus, setCurrentDbStatus] = useState<any>(null);
  const [dbMetadata, setDbMetadata] = useState<any>(null);

  // Anti-Pattern Auditor States
  const [antiPatternSql, setAntiPatternSql] = useState(
    "SELECT * \nFROM causal_inference.sales s \nWHERE s.category_name LIKE '%Electronic%';"
  );
  const [antiPatternResult, setAntiPatternResult] = useState<any>(null);
  const [antiPatternLoading, setAntiPatternLoading] = useState(false);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, [navigate]);

  // Fetch Sensor Action Logs and output to browser console
  const fetchSensorLogs = async () => {
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/apm/sensor-logs");
      if (response.ok) {
        const logs = await response.json();
        console.clear(); // Keep developer console neat and clean!
        console.group("%c📊 futureOS APM 数据库拦截日志监控器 (Realtime)", "color: #8b5cf6; font-weight: bold; font-size: 13px; padding: 4px; border-bottom: 1px solid #d8b4fe;");
        if (logs.length === 0) {
          console.log("%c[System] 目前暂无捕获日志，后台拦截线程处于待命状态...", "color: #94a3b8; font-style: italic;");
        } else {
          logs.forEach((log: string) => {
            if (log.includes("SUCCESS")) {
              console.log(`%c✨ ${log}`, "color: #10b981; font-weight: bold;");
            } else if (log.includes("failed") || log.includes("Error") || log.includes("skipped")) {
              console.log(`%c❌ ${log}`, "color: #ef4444; font-weight: bold;");
            } else {
              console.log(`%c⚙️ ${log}`, "color: #475569;");
            }
          });
        }
        console.groupEnd();
      }
    } catch (e) {
      console.error("Failed to stream sensor activity logs:", e);
    }
  };

  // Fetch APM Traces
  const fetchTraces = async () => {
    setLoadingTraces(true);
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/apm/traces");
      if (response.ok) {
        const data = await response.json();
        setTraces(data);
        // Direct console output streaming!
        fetchSensorLogs();
      } else {
        toast.error("拉取 APM 慢 SQL 日志失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("网络连接异常，拉取 traces 失败");
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    if (activeView === "apm") {
      fetchTraces();
    }
  }, [activeView]);

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    navigate("/");
  };

  // Run AI SQL Tuning and Sandbox Harness
  const handleRunTuning = async () => {
    if (!tuningSql.trim()) {
      toast.error("请先输入需要优化的 SQL 代码");
      return;
    }
    setTuningLoading(true);
    setTuningResult(null);
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/tuning/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql_query: tuningSql }),
      });
      if (response.ok) {
        const data = await response.json();
        setTuningResult(data);
        toast.success("大模型事务沙盒调优评测完成！");
      } else {
        const err = await response.json();
        toast.error(err.detail?.error || "AI 调优沙箱执行异常");
      }
    } catch (error) {
      console.error(error);
      toast.error("网络连接超时，事务沙箱测试失败");
    } finally {
      setTuningLoading(false);
    }
  };

  // Load Dynamic DB Connection status and table metadata
  const fetchDbStatus = async () => {
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/db/status");
      if (response.ok) {
        const data = await response.json();
        setCurrentDbStatus(data);
        if (data.dialect) {
          setDbDialect(data.dialect);
          setDbHost(data.host);
          setDbPort(data.port);
          setDbName(data.dbname);
          setDbUser(data.username);
          if (data.dialect === "mysql" && data.port === 13306) {
            setDbPassword("Ajajnb187!");
          }
        }
      }
    } catch (error) {
      console.error("Failed to load db status:", error);
    }
  };

  const fetchDbMetadata = async () => {
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/db/tables");
      if (response.ok) {
        const data = await response.json();
        setDbMetadata(data);
      }
    } catch (error) {
      console.error("Failed to load db schema:", error);
    }
  };

  useEffect(() => {
    fetchDbStatus();
    fetchDbMetadata();
  }, [activeView]);

  const handleTestAndConnectDb = async () => {
    setDbTesting(true);
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialect: dbDialect,
          host: dbHost,
          port: Number(dbPort),
          dbname: dbName,
          username: dbUser,
          password: dbPassword
        }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "成功连接并激活多数据源数据库环境！");
        fetchDbStatus();
        fetchDbMetadata();
      } else {
        const err = await response.json();
        toast.error(err.detail?.error || "连接测试失败，请检查账号密码及端口防火墙设置。");
      }
    } catch (error) {
      console.error(error);
      toast.error("网络连接异常，无法访问数据源测试端口。");
    } finally {
      setDbTesting(false);
    }
  };

  const handleResetDb = async () => {
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/db/reset", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setDbDialect("postgresql");
        setDbHost("localhost");
        setDbPort(5432);
        setDbName("postgres");
        setDbUser("postgres");
        setDbPassword("");
        fetchDbStatus();
        fetchDbMetadata();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAuditAntiPatterns = async () => {
    if (!antiPatternSql.trim()) {
      toast.error("请先输入待审计的 SQL 代码语句。");
      return;
    }
    setAntiPatternLoading(true);
    setAntiPatternResult(null);
    try {
      const response = await fetch("/api/text2sql_lg_code/enterprise/tuning/anti-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql_query: antiPatternSql }),
      });
      if (response.ok) {
        const data = await response.json();
        setAntiPatternResult(data);
        toast.success("SQL 反模式 & 核心索引深度审核完成！");
      } else {
        toast.error("审计执行失败，请检查语法结构。");
      }
    } catch (error) {
      console.error(error);
      toast.error("调优引擎响应超时，请重试。");
    } finally {
      setAntiPatternLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success("已复制到剪贴板");
  };

  // Chart data for tuning latency comparison
  const performanceChartData = useMemo(() => {
    if (!tuningResult?.performance_report) return [];
    const report = tuningResult.performance_report;
    return [
      { name: "原查询 SQL", 耗时: Number(report.original_latency_ms.toFixed(2)), color: "#ef4444" },
      { name: "AI 优化沙盒", 耗时: Number(report.optimized_latency_ms.toFixed(2)), color: "#10b981" },
    ];
  }, [tuningResult]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative flex">
      {/* 2026 顶配企业级：左侧固定侧边栏 Navigation Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col z-50 overflow-hidden shadow-[5px_0_30px_rgba(0,0,0,0.02)]">
        {/* LOGO 区域 */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Database className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-slate-900 text-base">futureOS 智能大屏</span>
            <span className="text-[9px] text-purple-600 font-extrabold tracking-wider uppercase">企业级 AI 协同平台 v2.0</span>
          </div>
        </div>

        {/* 侧边栏导航列表 */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-3 mb-3">核心业务系统</p>
          <button
            onClick={() => setActiveTab("nl2sql")}
            className={`w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 ${
              activeView === "nl2sql"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <Search className="w-4.5 h-4.5" />
            AI 智能数据问答 (Chat)
          </button>
          <button
            onClick={() => setActiveTab("apm")}
            className={`w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 ${
              activeView === "apm"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <Activity className="w-4.5 h-4.5" />
            APM 全链路慢SQL监控
          </button>
          <button
            onClick={() => setActiveTab("tuner")}
            className={`w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 ${
              activeView === "tuner"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <Terminal className="w-4.5 h-4.5" />
            AI 数据库调优沙盒
          </button>
          <button
            onClick={() => setActiveTab("datasource")}
            className={`w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 ${
              activeView === "datasource"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <Sliders className="w-4.5 h-4.5" />
            数据源与系统接入
          </button>

          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-3 pt-6 mb-3">系统运行状态</p>
          <div className="px-3 space-y-2.5 font-mono text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100/60">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${currentDbStatus?.is_dynamic_override ? "bg-purple-400 animate-pulse" : "bg-emerald-400 animate-ping"}`} />
              <span>数据连接：{currentDbStatus?.is_dynamic_override ? `🔮 ${currentDbStatus.dialect.toUpperCase()}` : "🟢 默认 Postgres"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>智能引擎：R1 (免计费)</span>
            </div>
          </div>
        </nav>

        {/* 侧边底部个人信息 */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{username}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">系统管理员</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0"
            title="安全登出"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 右侧主视口 Content Space (ml-64 留出侧边栏) */}
      <main className="flex-1 ml-64 p-8 min-h-screen relative overflow-y-auto">
        {/* Glow 发光粒子效果背景 */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />
        
        {/* 全局顶级监控看板 Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
                <Database className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">数据库宿主</p>
                <p className="text-xs font-black text-slate-800 mt-0.5">
                  {currentDbStatus ? `${currentDbStatus.dialect === "mysql" ? "MySQL" : "PostgreSQL"} (${currentDbStatus.dbname})` : "PostgreSQL 17.2"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Cpu className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">主机CPU负载</p>
                <p className="text-xs font-black text-emerald-600 mt-0.5">24.5% (🟢 安全)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Activity className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">全链路 APM 拦截</p>
                <p className="text-xs font-black text-purple-600 mt-0.5">🟢 已捕获 {traces.length} 条 SQL</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">合规审计状态</p>
                <p className="text-xs font-black text-slate-800 mt-0.5">🛡️ GDPR 合规扫描</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 视口 1: NL2SQL 智能数据问答 */}
        {activeView === "nl2sql" && (
          <div className="space-y-12 animate-fade-in">
            {/* 宣传语 */}
            <div className="relative pt-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                大模型驱动的高性能 NL2SQL 自然语言数据库协同
              </div>
              <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                用自然语言，提问您的 <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                  企业级商业智能(BI)数据库。
                </span>
              </h1>
              <p className="text-slate-500 max-w-2xl text-sm leading-relaxed">
                搭载 2026 全新限免 **DeepSeek-R1-8B** 深度推理引擎，智能纠错、智能关联表单、一秒即可将口语文字转化为完美可执行的 SQL 查询并呈现可视化图表。
              </p>
            </div>

            {/* 3D 霓虹搜索框 */}
            <div className="relative group max-w-4xl">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-15 group-hover:opacity-30 transition duration-1000 group-hover:duration-300" />
              <div className="relative bg-white border border-slate-200/90 shadow-xl rounded-2xl p-2.5 flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
                <Input
                  type="text"
                  placeholder="请输入您的提问，例如：与去年相比，哪些产品类别的销售额增长最为显著？"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                  className="flex-1 h-14 text-sm border-0 focus-visible:ring-0 bg-transparent text-slate-800 placeholder-slate-400"
                />
                <Button
                  size="lg"
                  onClick={() => handleSearch(query)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold h-14 px-8 rounded-xl shadow-lg shadow-purple-500/15 shrink-0 border-0"
                >
                  解析数据
                </Button>
              </div>
            </div>

            {/* 推荐探索探索数据集卡片 */}
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-6">
                <span className="w-16 h-[1px] bg-slate-200" />
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                  推荐探索的数据集问答
                </h2>
                <span className="w-16 h-[1px] bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestedQuestions.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(item.question)}
                    className="bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 text-left transition-all duration-300 group hover:shadow-[0_10px_30px_rgba(99,102,241,0.06)] hover:border-indigo-300 hover:scale-[1.01] shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-100/60 transition-colors">
                        <item.icon className="w-4.5 h-4.5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                          {item.question}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold">{item.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 视口 2: APM 慢 SQL 全链路时序监控 */}
        {activeView === "apm" && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2.5">
                  <Activity className="w-7 h-7 text-indigo-500 animate-pulse" />
                  APM 全链路慢 SQL 监控大屏
                </h1>
                <p className="text-slate-500 text-xs mt-1.5">
                  实时拦截抓取系统服务接口，并向下关联解析具体执行的慢 SQL 耗时与代码上下文。
                </p>
              </div>
              <Button
                onClick={fetchTraces}
                disabled={loadingTraces}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-2 self-start text-xs rounded-xl h-11 font-bold shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTraces ? "animate-spin" : ""}`} />
                刷新监控日志
              </Button>
            </div>

            {loadingTraces ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 bg-slate-200/50 animate-pulse border border-slate-200 rounded-xl" />
                ))}
              </div>
            ) : traces.length === 0 ? (
              <Card className="bg-white border-slate-200 p-12 text-center border-dashed">
                <Gauge className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="font-bold text-slate-600 text-sm">暂无捕获的 traces 日志</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto font-medium">
                  一旦某个接口或底层数据库持久层被触发，调用链路与执行 SQL 将实时录入于此。
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {traces.map((trace) => {
                  const isExpanded = expandedTraceId === trace.trace_id;
                  const isSlow = trace.execution_time_ms >= 100;
                  return (
                    <div
                      key={trace.trace_id}
                      className={`border rounded-xl transition-all duration-300 shadow-sm ${
                        isExpanded ? "bg-white border-indigo-500/30" : "bg-white hover:bg-slate-50/50 border-slate-200/80"
                      }`}
                    >
                      <div
                        onClick={() => setExpandedTraceId(isExpanded ? null : trace.trace_id)}
                        className="p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Method Badge */}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded tracking-widest ${
                            trace.http_method === "POST" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {trace.http_method}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800 truncate">{trace.api_endpoint}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-lg font-bold">{trace.sql_statement}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                          {/* Latency badge */}
                          <div className="text-right">
                            <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                              isSlow 
                                ? "bg-red-50 text-red-700 border-red-100" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isSlow ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
                              {trace.execution_time_ms.toFixed(1)} ms
                            </span>
                          </div>
                          
                          {/* Timestamp */}
                          <span className="text-[10px] text-slate-400 font-mono font-semibold">
                            {new Date(trace.timestamp * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 p-5 bg-slate-50/50 rounded-b-xl space-y-4 font-mono text-[11px]">
                          {/* Stack Frame details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                            <div>
                              <p className="text-purple-600 font-extrabold text-xs uppercase tracking-wider mb-2">🎯 代码调用上下文 (反射栈捕获)</p>
                              <p className="text-slate-500">调用文件: <span className="text-slate-800 font-bold">{trace.caller_file}</span></p>
                              <p className="text-slate-500 mt-1">代码行号: <span className="text-slate-800 font-bold">{trace.caller_line}</span></p>
                              <p className="text-slate-500 mt-1">调用函数: <span className="text-indigo-600 font-bold">{trace.caller_function}()</span></p>
                            </div>
                            <div>
                              <p className="text-indigo-600 font-extrabold text-xs uppercase tracking-wider mb-2">🗄️ 物理数据库参数</p>
                              <p className="text-slate-500">数据库名称: <span className="text-slate-800 font-bold">{trace.db_instance}</span></p>
                              <p className="text-slate-500 mt-1">会话 ID: <span className="text-slate-400 font-semibold">{trace.trace_id}</span></p>
                            </div>
                          </div>

                          {/* Raw SQL block */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-indigo-600 font-extrabold text-xs uppercase tracking-wider">📜 拦截捕获的 SQL 语句</p>
                              <button
                                onClick={() => copyToClipboard(trace.sql_statement, trace.trace_id)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                {copiedText === trace.trace_id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed text-xs shadow-inner">
                              <code>{trace.sql_statement}</code>
                            </pre>
                          </div>

                          {/* Action Button */}
                          <div className="flex justify-end pt-2">
                            <Button
                              onClick={() => {
                                setTuningSql(trace.sql_statement);
                                setActiveTab("tuner");
                                setTuningResult(null);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 text-xs h-10 px-4 rounded-xl font-bold border-0 shadow-md shadow-indigo-500/15"
                            >
                              <Terminal className="w-4 h-4" />
                              一键载入 AI 调优沙盒
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 视口 3: AI 调优与合规审计沙盒控制台 */}
        {activeView === "tuner" && (
          <div className="space-y-8 animate-fade-in">
            <div className="border-b border-slate-200 pb-6">
              <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2.5">
                <Terminal className="w-7 h-7 text-indigo-500" />
                AI 数据库调优沙盒控制台
              </h1>
              <p className="text-slate-500 text-xs mt-1.5 font-medium">
                深度拆解慢 SQL 性能物理瓶颈，智能重写重构代码，对高危泄漏或 GDPR 违规进行隐私脱敏，并实施安全的“无污染事务级沙箱评测”。
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* 控制台左侧：输入区 */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="bg-white shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800 rounded-2xl relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold text-indigo-600 flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-500" />
                      SQL 代码执行终端
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-500 font-bold">
                      在此处输入需要进行物理调优及合规审查的 SQL 语句：
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={tuningSql}
                      onChange={(e) => setTuningSql(e.target.value)}
                      placeholder="SELECT * FROM causal_inference.sales s WHERE ..."
                      className="min-h-[220px] font-mono text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                    />
                    <Button
                      onClick={handleRunTuning}
                      disabled={tuningLoading}
                      className="w-full h-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-purple-500/10 text-xs border-0"
                    >
                      {tuningLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          事务级评估沙盒真机执行中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          立即运行 3D 沙盒深度评测
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* 控制台右侧：展示区 */}
              <div className="lg:col-span-7 space-y-6">
                {tuningLoading ? (
                  <Card className="bg-white border-slate-200/90 p-12 text-center h-[420px] flex flex-col items-center justify-center space-y-6 border-dashed shadow-sm rounded-2xl">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-4 border-indigo-500/10 border-t-indigo-400 animate-spin" />
                      <Sparkles className="w-5 h-5 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">正在加载 PostgreSQL 执行计划并运行评估马车...</h3>
                      <p className="text-slate-500 text-[10px] font-semibold mt-2 max-w-sm mx-auto leading-relaxed">
                        系统正在执行 EXPLAIN、大模型智能代码逻辑推重写、PII 合规字段扫描、并在专享只读沙盒事务中尝试应用临时索引以校验提升率。大语言模型推理约耗时 10-15s。
                      </p>
                    </div>
                  </Card>
                ) : !tuningResult ? (
                  <Card className="bg-white border-slate-200/90 shadow-sm p-12 text-center border-dashed h-[420px] flex flex-col items-center justify-center rounded-2xl">
                    <Terminal className="w-10 h-12 text-slate-400 mb-4 animate-pulse" />
                    <h3 className="font-bold text-slate-700 text-sm">等待调优终端唤醒</h3>
                    <p className="text-slate-500 text-[10px] font-semibold mt-1.5 max-w-xs">
                      在左侧输入需要调优的代码并运行，大模型将在此完美生成媲美专家级 DBA 的诊断面板。
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-6 animate-fade-in text-slate-800">
                    {/* 三大评测大屏选项卡 Tabs */}
                    <Tabs defaultValue="performance" className="w-full">
                      <TabsList className="grid grid-cols-3 bg-slate-100 border border-slate-200/80 p-1 rounded-xl shadow-inner">
                        <TabsTrigger value="performance" className="text-xs font-bold flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                          <Gauge className="w-3.5 h-3.5" />
                          事务沙盒实测
                        </TabsTrigger>
                        <TabsTrigger value="tuning" className="text-xs font-bold flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                          <Code className="w-3.5 h-3.5" />
                          DBA 专家诊断
                        </TabsTrigger>
                        <TabsTrigger value="privacy" className="text-xs font-bold flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                          <Lock className="w-3.5 h-3.5" />
                          GDPR 安全合规
                        </TabsTrigger>
                      </TabsList>

                      {/* 选项卡 1：沙盒真机耗时实测 */}
                      <TabsContent value="performance" className="space-y-6 mt-4">
                        <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold text-indigo-600">只读事务隔离性能压测结果</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* KPI 框组 */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 text-center shadow-inner">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">调优前耗时</p>
                                <p className="text-base font-black text-slate-700 mt-1">{tuningResult.performance_report.original_latency_ms.toFixed(2)} ms</p>
                              </div>
                              <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 text-center shadow-inner">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">调优后耗时</p>
                                <p className="text-base font-black text-emerald-600 mt-1">{tuningResult.performance_report.optimized_latency_ms.toFixed(2)} ms</p>
                              </div>
                              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">响应延迟改善</p>
                                <p className="text-base font-black text-emerald-600 mt-1">
                                  {tuningResult.performance_report.latency_reduction_pct > 0 ? "+" : ""}
                                  {tuningResult.performance_report.latency_reduction_pct.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            {/* 耗时柱状图 Recharts */}
                            {performanceChartData.length > 0 && (
                              <div className="h-44 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={performanceChartData} layout="vertical" barSize={16}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" stroke="#64748b" fontSize={9} unit="ms" />
                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} width={90} />
                                    <ChartTooltip
                                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#1e293b", fontSize: "11px" }}
                                    />
                                    <Bar dataKey="耗时">
                                      {performanceChartData.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={entry.color} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}

                            {/* 指标红绿灯组 */}
                            <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                <CheckCircle2 className={`w-3.5 h-3.5 ${tuningResult.performance_report.ddl_applied_successfully ? "text-emerald-500" : "text-slate-400"}`} />
                                <span className="text-slate-500 font-semibold">DDL 模拟索引建立：</span>
                                <span className="text-slate-700 font-extrabold ml-auto">
                                  {tuningResult.performance_report.ddl_applied_successfully ? "建立成功" : "无需建立"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                <CheckCircle2 className={`w-3.5 h-3.5 ${tuningResult.performance_report.semantic_equivalence_verified ? "text-emerald-500 animate-pulse" : "text-red-500"}`} />
                                <span className="text-slate-500 font-semibold">物理语义等价校验：</span>
                                <span className="text-slate-700 font-extrabold ml-auto">
                                  {tuningResult.performance_report.semantic_equivalence_verified ? "100% 吻合" : "校验失败"}
                                </span>
                              </div>
                            </div>

                            {/* 裁决书面板 */}
                            <Alert className="bg-slate-50 border-slate-200">
                              <Terminal className="h-4 w-4 text-purple-600" />
                              <AlertTitle className="text-purple-700 font-extrabold text-[10px] uppercase tracking-widest">沙箱物理性能裁决</AlertTitle>
                              <AlertDescription className="text-xs text-slate-600 font-semibold leading-relaxed mt-1">
                                {tuningResult.performance_report.performance_verdict}
                              </AlertDescription>
                            </Alert>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* 选项卡 2：DBA 诊断详情 */}
                      <TabsContent value="tuning" className="space-y-4 mt-4">
                        <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
                          <CardContent className="p-6 space-y-4 text-xs">
                            {/* 瓶颈分析 */}
                            <div>
                              <p className="text-purple-600 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">🚨 PostgreSQL 物理执行计划瓶颈拆解</p>
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 leading-relaxed font-semibold">
                                {tuningResult.tuning_recommendation.bottleneck_analysis}
                              </div>
                            </div>

                            {/* 重构手段 */}
                            <div>
                              <p className="text-indigo-600 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">⚡ AI 架构优化重写手段</p>
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 leading-relaxed font-semibold">
                                {tuningResult.tuning_recommendation.optimization_strategy}
                              </div>
                            </div>

                            {/* 推荐索引 */}
                            {tuningResult.tuning_recommendation.suggested_indexes?.length > 0 && (
                              <div>
                                <p className="text-emerald-600 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">🛠️ 建议建立的物理索引 DDL (已在沙箱中回滚验证)</p>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between font-mono text-[11px] text-emerald-600 select-all font-bold">
                                  <span>{tuningResult.tuning_recommendation.suggested_indexes[0]}</span>
                                  <button
                                    onClick={() => copyToClipboard(tuningResult.tuning_recommendation.suggested_indexes[0], "ddl")}
                                    className="text-slate-400 hover:text-emerald-600 ml-2 shrink-0 transition-colors"
                                  >
                                    {copiedText === "ddl" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 优化后 SQL */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-indigo-600 font-extrabold text-[10px] uppercase tracking-widest">🌟 AI 重写架构后的极速 SQL</p>
                                <button
                                  onClick={() => copyToClipboard(tuningResult.tuning_recommendation.optimized_sql, "opt_sql")}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {copiedText === "opt_sql" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-900 text-slate-200 overflow-x-auto text-[11px] whitespace-pre-wrap font-mono leading-relaxed">
                                <code>{tuningResult.tuning_recommendation.optimized_sql}</code>
                              </pre>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* 选项卡 3：数据安全审计 */}
                      <TabsContent value="privacy" className="space-y-4 mt-4">
                        <Card className="bg-white border-slate-200/90 shadow-sm rounded-2xl">
                          <CardContent className="p-6 space-y-4 text-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                              <div className="flex items-center gap-2.5">
                                <ShieldAlert className={`w-5 h-5 ${tuningResult.privacy_report.is_safe ? "text-emerald-500" : "text-red-500 animate-bounce"}`} />
                                <div>
                                  <h4 className="font-extrabold text-slate-800 text-sm">GDPR / PIPEDA 数据隐私审计评估</h4>
                                  <p className="text-[10px] text-slate-400 font-bold">基于零信任安全架构对执行 SQL 进行前置审查。</p>
                                </div>
                              </div>
                              <div className={`px-4 py-1.5 rounded-xl text-center border ${
                                tuningResult.privacy_report.is_safe 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : "bg-red-50 text-red-700 border-red-100"
                              }`}>
                                <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">高危泄漏评级</p>
                                <p className="text-base font-black mt-0.5">{tuningResult.privacy_report.risk_score} / 100</p>
                              </div>
                            </div>

                            {/* 暴露的 PII 列 */}
                            <div>
                              <p className="text-purple-600 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">🔍 检测到的明文敏感隐私数据列</p>
                              <div className="flex flex-wrap gap-1.5">
                                {tuningResult.privacy_report.PII_columns_exposed?.length > 0 ? (
                                  tuningResult.privacy_report.PII_columns_exposed.map((col: string, idx: number) => (
                                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 font-mono text-[11px] font-bold shadow-sm">
                                      {col} (高危明文)
                                    </span>
                                  ))
                                ) : (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono text-[11px] font-bold shadow-sm">
                                    未检测到明文敏感列暴露
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 漏洞原因列表 */}
                            <div>
                              <p className="text-red-500 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">❌ 隐私违规项诊断</p>
                              <ul className="space-y-2">
                                {tuningResult.privacy_report.compliance_issues?.map((issue: string, idx: number) => (
                                  <li key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-slate-700 font-bold flex items-start gap-2 shadow-sm">
                                    <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* remediation 脱敏重写建议 */}
                            <div>
                              <p className="text-indigo-600 font-extrabold text-[10px] uppercase tracking-widest mb-1.5">💡 安全架构师脱敏纠错重写建议</p>
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 leading-relaxed font-semibold shadow-inner">
                                {tuningResult.privacy_report.recommended_remediation}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 视口 4: 数据源与外部业务系统接入 */}
        {activeView === "datasource" && (
          <div className="space-y-8 animate-fade-in text-slate-200">
            <div className="border-b border-slate-900 pb-6">
              <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2.5">
                <Sliders className="w-7 h-7 text-indigo-500" />
                数据源与外部系统集成中心
              </h1>
              <p className="text-slate-400 text-xs mt-1.5">
                一键切换并连接您的本地、服务器或远程 MySQL / PostgreSQL 物理数据库。提供“零侵入”系统接入探针，深度排查每个应用服务的 API 接口执行的 SQL 质量。
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              {/* 左半区：数据源连接与结构可视化 (7列) */}
              <div className="xl:col-span-6 space-y-6">
                <Card className="bg-white shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800 relative overflow-hidden rounded-2xl">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-extrabold text-indigo-600 flex items-center gap-2">
                      <Settings className="w-5 h-5 animate-spin-slow text-indigo-500" />
                      数据源连接配置控制台
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">
                      支持快速切换到您的本地或云上数据库实例，一经连接，AI 协同大屏将自动映射并分析其表结构：
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Dialect Tabs */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">数据库类型</label>
                      <div className="flex gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 max-w-xs shadow-inner">
                        <button
                          onClick={() => { setDbDialect("postgresql"); setDbPort(5432); }}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                            dbDialect === "postgresql" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                          }`}
                        >
                          PostgreSQL
                        </button>
                        <button
                          onClick={() => { setDbDialect("mysql"); setDbPort(3306); }}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                            dbDialect === "mysql" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                          }`}
                        >
                          MySQL
                        </button>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-extrabold">主机 IP / 域名</label>
                        <Input
                          value={dbHost}
                          onChange={(e) => setDbHost(e.target.value)}
                          placeholder="localhost"
                          className="h-10 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-extrabold">端口 Port</label>
                        <Input
                          type="number"
                          value={dbPort}
                          onChange={(e) => setDbPort(Number(e.target.value))}
                          placeholder={dbDialect === "mysql" ? "3306" : "5432"}
                          className="h-10 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-extrabold">数据库名称</label>
                        <Input
                          value={dbName}
                          onChange={(e) => setDbName(e.target.value)}
                          placeholder="postgres"
                          className="h-10 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-extrabold">数据库用户名</label>
                        <Input
                          value={dbUser}
                          onChange={(e) => setDbUser(e.target.value)}
                          placeholder="root"
                          className="h-10 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-extrabold">密码 Password</label>
                        <Input
                          type="password"
                          value={dbPassword}
                          onChange={(e) => setDbPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-10 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-2">
                      <Button
                        onClick={handleTestAndConnectDb}
                        disabled={dbTesting}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-11 px-5 rounded-xl shadow-lg shadow-indigo-500/20 border-0"
                      >
                        {dbTesting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            正在连接测试中...
                          </>
                        ) : (
                          "测试连接并立即启用"
                        )}
                      </Button>
                      <Button
                        onClick={handleResetDb}
                        variant="outline"
                        className="bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-400 text-xs h-11 px-5 rounded-xl shadow-sm font-bold"
                      >
                        恢复默认 PostgreSQL
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* DB Metadata Catalog View */}
                <Card className="bg-white shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800 overflow-hidden rounded-2xl">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-500" />
                      当前活跃数据库物理表结构目录 (Schema Catalog)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">
                      由系统元数据模块自动导出，显示您已连接数据库中的所有表与列名称：
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {dbMetadata?.success && dbMetadata?.tables ? (
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 font-mono text-[11px] bg-slate-50/50">
                        {Object.keys(dbMetadata.tables).map((tblName) => (
                          <div key={tblName} className="p-4 hover:bg-slate-100/50 transition-colors">
                            <p className="font-extrabold text-indigo-600 text-xs flex items-center gap-1.5 mb-2.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {tblName}
                              <span className="text-[10px] text-slate-400 font-normal">({dbMetadata.tables[tblName].length} 个字段)</span>
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {dbMetadata.tables[tblName].map((col: any) => (
                                <div key={col.column_name} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200/60 text-[10px] shadow-sm">
                                  <span className="truncate text-slate-700 font-semibold" title={col.column_name}>{col.column_name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">{col.data_type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400 bg-slate-50/50">
                        <Database className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                        <p className="text-xs font-bold text-slate-600">暂无加载的表结构元数据</p>
                        <p className="text-[10px] mt-1 text-slate-500">请输入正确的数据库连接参数并点击保存启用。</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 右半区：外部系统接入 APM “零侵入”集成指南 (5列) */}
              <div className="xl:col-span-6 space-y-6">
                <Card className="bg-white shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800 relative overflow-hidden rounded-2xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-extrabold text-indigo-600 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-500" />
                      外部业务系统 APM “零侵入” 接入指南
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">
                      您可以通过在我们平台注册一个拦截探针，实时、全面、无感地抓取并诊断您本地或者远程业务系统执行的每一个 SQL：
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-slate-700 leading-relaxed font-semibold">
                      💥 <strong className="text-indigo-900 font-bold">原理机制</strong>：
                      当您的业务系统接口运行时，底层 ORM 框架或 DB 连接池会将执行的 SQL 异步上报给本平台的 <code className="text-indigo-600 font-mono bg-indigo-100/50 px-1 py-0.5 rounded">/enterprise/apm/collect</code> 接口。本控制台将针对上报的 SQL 自动进行死锁碰撞、反模式不规范写法、覆盖索引缺失、和敏感数据泄露扫描！
                    </div>

                    <Tabs defaultValue="python" className="w-full">
                      <TabsList className="bg-slate-100 border border-slate-200 grid grid-cols-3 h-10 p-0.5 rounded-xl shadow-inner">
                        <TabsTrigger value="python" className="text-[10px] font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900">Python (FastAPI)</TabsTrigger>
                        <TabsTrigger value="node" className="text-[10px] font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900">Node.js (Express)</TabsTrigger>
                        <TabsTrigger value="java" className="text-[10px] font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900">Java (Spring Boot)</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="python" className="mt-3">
                        <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wide">在 SQLAlchmey / FastAPI 注册事件拦截器：</p>
                        <pre className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-[10px] font-mono text-indigo-400 overflow-x-auto leading-relaxed">
{`import time, requests, traceback
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, exec_legend):
    # 自动拦截拦截捕获 SQL 与耗时
    exec_time_ms = (time.time() - context.start_time) * 1000
    tb = traceback.extract_stack()[-3] # 获取行号与代码文件
    
    # 异步上报至 futureOS APM 底座
    try:
        requests.post("http://localhost:8090/api/text2sql_lg_code/enterprise/apm/collect", json={
            "endpoint": "/api/v1/user/query", # 关联路由
            "method": "POST",
            "sql_statement": statement,
            "execution_time_ms": exec_time_ms,
            "db_instance": "your_db",
            "caller_file": tb.filename,
            "caller_line": tb.lineno,
            "caller_function": tb.name
        }, timeout=1.0)
    except Exception:
        pass`}
                        </pre>
                      </TabsContent>

                      <TabsContent value="node" className="mt-3">
                        <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wide">在 Sequelize ORM 注入 Logging 回调：</p>
                        <pre className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-[10px] font-mono text-indigo-400 overflow-x-auto leading-relaxed">
{`const { Sequelize } = require('sequelize');
const axios = require('axios');

const sequelize = new Sequelize('db', 'user', 'pass', {
  host: 'localhost',
  dialect: 'mysql',
  logging: (sql, timing) => {
    // 异步上报至本平台
    axios.post('http://localhost:8090/api/text2sql_lg_code/enterprise/apm/collect', {
      endpoint: '/api/v1/orders/list',
      method: 'GET',
      sql_statement: sql,
      execution_time_ms: timing || 1.5,
      db_instance: 'order_db',
      caller_file: 'routes/orders.js',
      caller_line: 42,
      caller_function: 'listOrders'
    }).catch(() => {});
  },
  benchmark: true // 开启耗时测量
});`}
                        </pre>
                      </TabsContent>

                      <TabsContent value="java" className="mt-3">
                        <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wide">在 Spring MyBatis 注入 Interceptor：</p>
                        <pre className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-[10px] font-mono text-indigo-400 overflow-x-auto leading-relaxed">
{`@Intercepts({@Signature(type = Executor.class, method = "query", args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class})})
public class APMInterceptor implements Interceptor {
    public Object intercept(Invocation invocation) throws Throwable {
        long start = System.currentTimeMillis();
        Object proceed = invocation.proceed();
        long elapsed = System.currentTimeMillis() - start;
        
        MappedStatement ms = (MappedStatement) invocation.getArgs()[0];
        String sql = ms.getBoundSql(invocation.getArgs()[1]).getSql();
        
        // 异步发送 telemetry 耗时上报 API
        reportAPM(ms.getId(), "POST", sql, elapsed);
        return proceed;
    }
}`}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 下半区：静态与 AI 双引擎 SQL 反模式审计终端 */}
            <Card className="bg-white shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200/90 text-slate-800 overflow-hidden rounded-2xl relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-500 animate-pulse" />
                  静态 & AI 双引擎高级 SQL 质量与索引反模式审计终端
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  不局限于慢查询评估，深度审计不规范 SQL 写法、大表全表扫描隐患、覆盖索引失效以及悲观锁/死锁高危漏洞：
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* 输入终端 (5列) */}
                  <div className="lg:col-span-5 space-y-4">
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">在下方粘贴您需要深度审计的 SQL 语句：</p>
                    <Textarea
                      value={antiPatternSql}
                      onChange={(e) => setAntiPatternSql(e.target.value)}
                      rows={8}
                      className="bg-slate-50 border border-slate-200 font-mono text-xs text-indigo-900 leading-relaxed rounded-xl focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 transition-all shadow-inner"
                      placeholder="SELECT * FROM causal_inference.sales WHERE date LIKE '%2026' FOR UPDATE;"
                    />
                    <Button
                      onClick={handleAuditAntiPatterns}
                      disabled={antiPatternLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs h-12 rounded-xl shadow-lg shadow-purple-500/20 border-0"
                    >
                      {antiPatternLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          正在调用双引擎分析中...
                        </>
                      ) : (
                        "一键执行静态与 AI DBA 深度性能诊断"
                      )}
                    </Button>
                  </div>

                  {/* 审计报告展现 (7列) */}
                  <div className="lg:col-span-7">
                    {antiPatternLoading ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                          <span>AI 正在以 Principal DBA 专家身份逐行审查您的不规范语法与高危设计模式...</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        <div className="h-20 bg-slate-100 rounded animate-pulse" />
                        <div className="h-10 bg-slate-100 rounded animate-pulse" />
                      </div>
                    ) : antiPatternResult ? (
                      <div className="space-y-4">
                        {/* Health Score Gauge */}
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shadow-inner">
                          <div className="relative w-16 h-16 rounded-full border-4 border-indigo-100 flex items-center justify-center font-black text-lg text-indigo-600 bg-white shrink-0 shadow-sm">
                            {antiPatternResult.overall_health_score}
                            <span className="text-[8px] text-slate-400 absolute bottom-1 font-bold">健康分</span>
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-slate-800">数据库索引与反模式诊断完成！</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              共检测出 <span className="text-red-500 font-bold">{antiPatternResult.static_issues?.length || 0} 项</span> 物理不合规/性能风险。请参照下方整改。
                            </p>
                          </div>
                        </div>

                        {/* Audit Details */}
                        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                          {/* Static issues */}
                          {antiPatternResult.static_issues?.map((issue: any, idx: number) => (
                            <div key={idx} className="p-4 rounded-xl bg-red-50/70 border border-red-100 flex items-start gap-3 shadow-sm">
                              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                              <div className="text-xs">
                                <p className="font-extrabold text-red-700 flex items-center gap-2">
                                  {issue.rule}
                                  <span className="text-[9px] px-2 py-0.5 rounded-lg bg-red-100 text-red-700 font-black tracking-wider uppercase">{issue.severity}</span>
                                </p>
                                <p className="text-slate-600 font-semibold mt-1 leading-relaxed">{issue.description}</p>
                              </div>
                            </div>
                          ))}

                          {/* AI recommendations */}
                          {antiPatternResult.ai_issues?.map((issue: any, idx: number) => (
                            <div key={idx} className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 shadow-sm">
                              <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                              <div className="text-xs">
                                <p className="font-extrabold text-indigo-900 flex items-center gap-2">
                                  {issue.title}
                                  <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black tracking-wider uppercase ${
                                    issue.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"
                                  }`}>{issue.severity}</span>
                                </p>
                                <p className="text-slate-600 font-semibold mt-1 leading-relaxed">{issue.solution}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-60 rounded-2xl bg-slate-50/60 border border-slate-200 border-dashed flex items-center justify-center text-slate-500 font-bold text-xs">
                        <div className="text-center font-semibold">
                          <Terminal className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                          <p className="text-slate-700 font-bold">待执行性能诊断与语法审计</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-1">请输入需要审核的 SQL 代码并点击一键分析。</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 底部信息 */}
        <div className="mt-24 pt-6 border-t border-slate-900/60 text-center">
          <p className="text-xs text-slate-600 font-semibold">
            futureOS 智能大语言模型数据库协同底座 • 基于 Model Context Protocol (MCP) 标准通信协议 • 本地 PostgreSQL 17 全力驱动
          </p>
        </div>
      </main>
    </div>
  );
};

export default Home;
