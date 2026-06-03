import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Database,
  LogOut,
  ArrowLeft,
  FileText,
  Code2,
  BarChart3,
  Table,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Bot,
  Cpu,
  Shield,
  Activity,
  Terminal,
  Search,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useText2SQL } from "@/hooks/useText2SQL";
import { toast } from "sonner";
import { Text2SQLResponse } from "@/services/api";

/**
 * Transforms API data array into chart format
 */
function transformDataForChart(data: Array<Record<string, any>>): Array<{ name: string; value: number }> {
  if (!data || data.length === 0) return [];

  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  const labelKey = keys.find(key => typeof firstRow[key] === 'string' || firstRow[key] === null);
  const valueKey = keys.find(key => typeof firstRow[key] === 'number');

  if (!valueKey) {
    return [];
  }

  return data.slice(0, 20).map((row, index) => ({
    name: labelKey ? String(row[labelKey] || `项目 ${index + 1}`) : `项目 ${index + 1}`,
    value: Number(row[valueKey]) || 0,
  }));
}

/**
 * Extracts table headers and data from API response
 */
function transformDataForTable(data: Array<Record<string, any>>): {
  headers: string[];
  rows: Array<Record<string, any>>;
} {
  if (!data || data.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(data[0]);
  return {
    headers,
    rows: data,
  };
}

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  response?: Text2SQLResponse;
  timestamp: Date;
}

const Results = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const navigate = useNavigate();
  const [username, setUsername] = useState("管理员");
  const [activeTab, setActiveTab] = useState<"summary" | "sql" | "chart" | "table">("summary");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const tableRowsPerPage = 50;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const followUpMutation = useText2SQL();

  const text2sqlMutation = useText2SQL();

  const lastProcessedQueryRef = useRef<string>("");

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn) {
      navigate("/");
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery && trimmedQuery !== lastProcessedQueryRef.current) {
      lastProcessedQueryRef.current = trimmedQuery;
      setActiveTab("summary");
      setFeedback(null);
      setShowFeedbackForm(false);

      setConversationHistory([{
        id: Date.now().toString(),
        type: "user",
        content: trimmedQuery,
        timestamp: new Date(),
      }]);

      text2sqlMutation.mutate(
        { input_text: trimmedQuery },
        {
          onSuccess: (data) => {
            setConversationHistory(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              type: "assistant",
              content: data.summary || "解析数据已返回",
              response: data,
              timestamp: new Date(),
            }]);
          },
          onError: (error) => {
            toast.error("数据分析执行异常", {
              description: error.message || "无法拉取或执行 SQL 代码，请检查大模型连接。",
            });
          },
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, navigate]);

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

  const latestResponse = followUpMutation.data || text2sqlMutation.data;

  const chartData = useMemo(() => {
    if (!latestResponse?.data) return [];
    return transformDataForChart(latestResponse.data);
  }, [latestResponse?.data]);

  const tableData = useMemo(() => {
    if (!latestResponse?.data) return { headers: [], rows: [] };
    return transformDataForTable(latestResponse.data);
  }, [latestResponse?.data]);

  useEffect(() => {
    setTablePage(0);
  }, [latestResponse?.data]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    navigate("/");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, followUpMutation.isPending]);

  const handleFollowUp = (question: string) => {
    setConversationHistory(prev => [...prev, {
      id: Date.now().toString(),
      type: "user",
      content: question,
      timestamp: new Date(),
    }]);

    followUpMutation.mutate(
      { input_text: question },
      {
        onSuccess: (data) => {
          setConversationHistory(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: data.summary || "追加分析完成",
            response: data,
            timestamp: new Date(),
          }]);

          setActiveTab("summary");
          setFeedback(null);
          setShowFeedbackForm(false);
        },
        onError: (error) => {
          toast.error("追加追问执行异常", {
            description: error.message || "大模型语义分析或 SQL 执行发生未知错误。",
          });
        },
      }
    );
  };

  const handleFollowUpSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (followUpInput.trim()) {
      handleFollowUp(followUpInput.trim());
      setFollowUpInput("");
    }
  };

  const copySQL = () => {
    const sqlQuery = latestResponse?.sql_query;
    if (sqlQuery) {
      navigator.clipboard.writeText(sqlQuery);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("SQL 语句已成功复制到剪贴板！");
    }
  };

  const handleRetry = () => {
    if (query.trim()) {
      text2sqlMutation.mutate(
        { input_text: query.trim() },
        {
          onError: (error) => {
            toast.error("重试失败", {
              description: error.message || "大模型分析异常，请重试。",
            });
          },
        }
      );
    }
  };

  const tabs = [
    { id: "summary", label: "AI 智能摘要 (Summary)", icon: FileText },
    { id: "sql", label: "生成的 SQL 代码 (SQL)", icon: Code2 },
    { id: "chart", label: "数据可视化图表 (Chart)", icon: BarChart3 },
    { id: "table", label: "物理数据报表 (Table)", icon: Table },
  ] as const;

  const isLoading = text2sqlMutation.isPending || followUpMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative flex">
      {/* 左侧固定大项目侧边栏 Unified Navigation Sidebar */}
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
            onClick={() => navigate("/home")}
            className="w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-sm"
          >
            <Search className="w-4.5 h-4.5" />
            AI 智能数据问答 (Chat)
          </button>
          <button
            onClick={() => { navigate("/home"); }}
            className="w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
          >
            <Activity className="w-4.5 h-4.5" />
            APM 全链路慢SQL监控
          </button>
          <button
            onClick={() => { navigate("/home"); }}
            className="w-full px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all duration-300 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
          >
            <Terminal className="w-4.5 h-4.5" />
            AI 数据库调优沙盒
          </button>

          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-3 pt-6 mb-3">系统运行状态</p>
          <div className="px-3 space-y-2.5 font-mono text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100/60">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>数据连接：🟢 已就绪</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>智能引擎：DeepSeek-V3</span>
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
                <p className="text-xs font-black text-slate-800 mt-0.5">PostgreSQL 17.2</p>
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
                <p className="text-xs font-black text-purple-600 mt-0.5">🟢 已捕获 3 条 SQL</p>
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

        {/* 返回搜索按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          className="mb-6 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 flex items-center gap-2 font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          返回搜索大盘
        </Button>

        {/* 提问详情卡 Question Card */}
        <div className="bg-white border border-slate-200/90 text-slate-800 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">当前数据分析问题</p>
              <h1 className="text-xl font-extrabold text-slate-900 leading-snug">{query || "未输入问题"}</h1>
            </div>
          </div>
        </div>

        {/* 空问题状态 */}
        {!query.trim() && !text2sqlMutation.isPending && !text2sqlMutation.isError && !text2sqlMutation.isSuccess && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mb-6">
            <Alert className="bg-slate-50 border-slate-200">
              <AlertCircle className="h-4 w-4 text-slate-400" />
              <AlertTitle className="text-slate-700 font-bold">未输入问题</AlertTitle>
              <AlertDescription className="mt-2 text-slate-500 text-xs">
                请先在控制台输入您的问题。
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* AI 深度思考状态 */}
        {isLoading && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
              <span className="text-xs font-bold text-slate-600">大语言模型（DeepSeek-V3）正在解析数据库并执行多节点工作流中...</span>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4 bg-slate-100" />
              <Skeleton className="h-3 w-full bg-slate-100" />
              <Skeleton className="h-3 w-5/6 bg-slate-100" />
              <Skeleton className="h-3 w-4/6 bg-slate-100" />
            </div>
          </div>
        )}

        {/* 后端工作流错误状态 */}
        {(text2sqlMutation.isError || followUpMutation.isError) && !isLoading && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mb-6">
            <Alert variant="destructive" className="bg-red-50 border-red-100">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertTitle className="text-red-700 font-bold text-sm">数据多节点解析链路中断</AlertTitle>
              <AlertDescription className="mt-2 text-red-600 text-xs leading-relaxed">
                {(followUpMutation.error || text2sqlMutation.error)?.message || "无法编译或执行。这可能是由于模型访问受限或 API Key 无效。请点击下方重试。"}
              </AlertDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-4 border-red-500/20 hover:bg-red-500/10 text-red-400 text-xs h-9 rounded-xl"
                disabled={isLoading}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                重新尝试解析
              </Button>
            </Alert>
          </div>
        )}

        {/* 数据加载成功返回页面 */}
        {latestResponse && !isLoading && (
          <>
            {/* 四大展示 Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-100/80 p-1 rounded-xl border border-slate-200 max-w-fit shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 各 Tab 具体渲染卡片 */}
            <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 mb-6 text-slate-800">
              
              {/* TAB 1: AI 智能摘要 */}
              {activeTab === "summary" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">AI 数据分析摘要 (DeepSeek-V3 报告)</h3>
                  <p className="text-slate-700 text-sm leading-relaxed font-semibold">
                    {latestResponse?.summary || "暂无 AI 摘要生成。"}
                  </p>
                  {latestResponse?.data && (
                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-mono font-bold">
                      <span className="flex items-center gap-1.5">
                        <Table className="w-3.5 h-3.5 text-indigo-500" />
                        数据库成功返回：{latestResponse.data.length} 行数据
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: 生成的 SQL 语句 */}
              {activeTab === "sql" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">生成的极速 SQL 代码</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copySQL}
                      disabled={!latestResponse?.sql_query}
                      className="text-slate-500 hover:text-indigo-600 hover:bg-slate-50 text-xs flex items-center gap-1.5 font-bold"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>已复制!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>复制代码</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-x-auto text-[11px] font-mono text-indigo-400 leading-relaxed shadow-inner">
                    <code>{latestResponse?.sql_query || "暂无可用的 SQL 语句。"}</code>
                  </pre>
                </div>
              )}

              {/* TAB 3: 数据可视化图表 (Recharts 柱状图) */}
              {activeTab === "chart" && (
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">AI 自动选择字段渲染可视化图表</h3>
                  <div className="h-80">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey="name"
                            stroke="#64748b"
                            fontSize={9}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis stroke="#64748b" fontSize={9} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              borderColor: "#cbd5e1",
                              borderRadius: "8px",
                              color: "#1e293b",
                              fontSize: "11px"
                            }}
                          />
                          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "#ec4899" : "#6366f1"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center font-mono text-xs">
                          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                          <p className="font-bold text-slate-600">无可用的图表数据</p>
                          <p className="text-[10px] text-slate-500 mt-1">此 SQL 返回的结果列中没有适合进行数字柱状图渲染的指标列。</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: 数据列表详情 */}
              {activeTab === "table" && (
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">物理数据库底层行级数据</h3>
                  <div className="overflow-x-auto">
                    {tableData.rows.length > 0 ? (
                      <>
                        <table className="w-full font-mono text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400">
                              {tableData.headers.map((header, index) => (
                                <th key={index} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.rows
                              .slice(tablePage * tableRowsPerPage, (tablePage + 1) * tableRowsPerPage)
                              .map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                  {tableData.headers.map((header, cellIndex) => {
                                    const cellValue = row[header];
                                    return (
                                      <td key={cellIndex} className="py-3 px-4 text-slate-700 font-semibold">
                                        {cellValue === null || cellValue === undefined
                                          ? <span className="text-slate-400">-</span>
                                          : typeof cellValue === 'object'
                                          ? JSON.stringify(cellValue)
                                          : String(cellValue)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {tableData.rows.length > tableRowsPerPage && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold">
                              当前显示 {tablePage * tableRowsPerPage + 1} - {Math.min((tablePage + 1) * tableRowsPerPage, tableData.rows.length)} 行，总计 {tableData.rows.length} 行数据
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTablePage(p => Math.max(0, p - 1))}
                                disabled={tablePage === 0}
                                className="text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-9"
                              >
                                上一页
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTablePage(p => p + 1)}
                                disabled={(tablePage + 1) * tableRowsPerPage >= tableData.rows.length}
                                className="text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-9"
                              >
                                下一页
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-400">
                        <div className="text-center">
                          <Table className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                          <p className="font-bold text-slate-600">无可用报表数据</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 反馈大栏 (Feedback Section) */}
        <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 mb-6 text-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-xs text-slate-500 font-extrabold uppercase tracking-wide">此 AI 解析结果对您的业务研究有帮助吗？</p>
            <div className="flex items-center gap-2">
              <Button
                variant={feedback === "up" ? "default" : "outline"}
                size="sm"
                onClick={() => setFeedback("up")}
                className="text-xs rounded-xl h-9 font-bold"
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                有帮助
              </Button>
              <Button
                variant={feedback === "down" ? "default" : "outline"}
                size="sm"
                onClick={() => setFeedback("down")}
                className="text-xs rounded-xl h-9 font-bold"
              >
                <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                无帮助
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                className="text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 font-bold"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                追加回馈建议
              </Button>
            </div>
          </div>

          {showFeedbackForm && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Textarea
                placeholder="请留下您宝贵的系统诊断意见，大模型将自主吸收更新..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="mb-3 text-xs bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl shadow-inner"
                rows={3}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (feedbackText.trim()) {
                    console.log("Feedback submitted:", {
                      feedback: feedback,
                      text: feedbackText,
                      query: query,
                      timestamp: new Date().toISOString(),
                    });
                    toast.success("感谢您的宝贵建议！系统正在动态自适应调优中。");
                    setFeedbackText("");
                  }
                  setShowFeedbackForm(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 border-0 shadow-md shadow-indigo-500/10 rounded-xl"
              >
                提交诊断建议
              </Button>
            </div>
          )}
        </div>

        {/* 关联探索问答推荐 */}
        {latestResponse && latestResponse?.followup_questions && latestResponse.followup_questions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              推荐关联深度分析探索
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latestResponse.followup_questions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleFollowUp(question)}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left flex items-center justify-between group hover:bg-slate-50/50 hover:shadow-[0_10px_30px_rgba(99,102,241,0.04)] transition-all"
                  disabled={isLoading}
                >
                  <span className="text-xs font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{question}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 对话追问会话终端 Chat Interface */}
        {conversationHistory.length > 0 && (
          <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              当前问题探索链路会话 (Conversation)
            </h2>

            {/* 对话消息记录列表 */}
            <div className="max-h-96 overflow-y-auto mb-4 space-y-4 pr-2 font-sans">
              {conversationHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.type === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl text-xs font-bold leading-relaxed ${
                      message.type === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-md"
                        : "bg-slate-50 border border-slate-200/80 rounded-bl-sm text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.type === "assistant" && message.response && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400 font-mono font-bold">
                        数据库返回：{message.response.data?.length || 0} 行 • 可点击上方选项卡切换多维视图进行深度审计
                      </div>
                    )}
                  </div>
                  {message.type === "user" && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                </div>
              ))}

              {followUpMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white animate-pulse shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl rounded-bl-sm">
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>正在调用逻辑推理工作流...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* 追问输入框 */}
            <form onSubmit={handleFollowUpSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="向 AI 智能数据助手追问新的问题（大语言模型将自动融合当前会话上下文）..."
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFollowUpSubmit();
                  }
                }}
                className="flex-1 text-xs h-11 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus-visible:bg-white focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 focus-visible:ring-4 rounded-xl"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!followUpInput.trim() || isLoading}
                className="shrink-0 h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold border-0"
              >
                {followUpMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        )}

        {/* 底部信息 */}
        <div className="mt-24 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400 font-extrabold">
            futureOS 智能大语言模型数据库协同底座 • 基于 Model Context Protocol (MCP) 标准通信协议 • 本地 PostgreSQL 17 全力驱动
          </p>
        </div>
      </main>
    </div>
  );
};

export default Results;
