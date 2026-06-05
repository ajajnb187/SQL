<template>
  <div class="resume-wrapper">
    <div class="toolbar">
      <button @click="exportPDF" class="btn btn-primary">导出PDF</button>
    </div>

    <div id="resumeContent" class="resume-container tpl-sidebar">
      <aside class="sidebar">
        <h1 class="sidebar-name">庞业祺</h1>
        <div class="sidebar-photo" @click="triggerFileInput">
          <img v-if="photoUrl" :src="photoUrl" alt="证件照" class="photo-img" />
          <div v-else class="photo-placeholder">
            <div>点击上传</div>
            <div class="photo-hint">2寸证件照</div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" @change="handlePhotoUpload" style="display: none;" />
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-title">联系方式</h3>
          <div class="sidebar-item">电话：18894799021</div>
          <div class="sidebar-item">邮箱：1870723427@qq.com</div>
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-title">基本信息</h3>
          <div class="sidebar-item">年龄：22</div>
          <div class="sidebar-item">学历：本科</div>
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-title">专业技能</h3>
          <ul class="sidebar-skill-list">
            <li>熟悉 Java、Python，掌握 Spring Boot / FastAPI 后端接口开发，具备接口设计、异常处理和日志排查能力</li>
            <li>熟悉大模型应用开发，了解 Prompt 设计、工具调用、流式输出、上下文管理和多轮对话链路</li>
            <li>熟悉 RAG 基础流程，了解文档分块、向量检索、关键词召回、重排序和回答质量优化思路</li>
            <li>了解 LangChain / LangGraph 工作流编排，能够完成任务拆分、节点流转和结果汇总</li>
            <li>熟悉 MySQL/PostgreSQL、Redis 常用开发场景，了解索引、分页、缓存和慢查询排查基础</li>
            <li>熟练使用 Codex、Claude Code 等 AI 编程工具辅助代码编写、调试与重构，提高开发效率</li>
          </ul>
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-title">荣誉证书</h3>
          <div class="sidebar-item">蓝桥杯省三等奖</div>
        </div>
      </aside>

      <main class="main-content">
        <section class="main-section">
          <h2 class="main-section-title"><span class="section-icon">&#9670;</span> 教育背景</h2>
          <div class="main-edu">
            <div class="main-edu-row">
              <span class="main-edu-school">梧州学院 · 软件工程（本科）</span>
              <span class="main-edu-time">2022.09 - 2026.06</span>
            </div>
            <div class="main-edu-course">主修：数据结构与算法、数据库原理、操作系统、计算机网络、Java 程序设计</div>
          </div>
        </section>

        <section class="main-section">
          <h2 class="main-section-title"><span class="section-icon">&#9670;</span> 实习经历</h2>

          <div class="main-project">
            <div class="main-project-head">
              <span class="main-project-name">广州智链信息科技有限公司 · AI 应用开发（AI Agent 方向）实习生</span>
              <span class="main-edu-time">2025.11 - 2026.01</span>
            </div>
            <p class="main-project-desc">参与电商客服 AI Agent 原型的开发与测试，主要负责工具调用模块、RAG 知识库数据治理和提示词优化，让 Agent 能自动处理订单、物流、退换货等高频咨询</p>
            <ol class="main-project-list">
              <li>基于 <strong>Python + LangChain</strong> 开发客服 Agent 的<strong>工具调用（Function Calling）</strong>模块，独立完成<strong>订单查询、物流跟踪、退换货指引</strong> 3 个工具的开发与联调，覆盖约 60% 的标准化咨询场景</li>
              <li>负责 <strong>RAG 知识库数据治理</strong>，清洗 3 家淘宝店铺约 <strong>1.8 万条</strong>历史客服对话，落地「<strong>去重 → 无效过滤 → 分段标准化</strong>」三级流程，知识库有效问答匹配率从 <strong>57% 提升到 83%</strong></li>
              <li>做<strong>提示词策略对比实验</strong>（零样本 / 少样本 / CoT 思维链），最终采用「<strong>少样本 + 场景化引导</strong>」方案，问答<strong>准确率提升约 13%</strong>，平均响应时间缩短约 0.5 秒</li>
              <li>编写 <strong>86 条功能测试用例</strong>，覆盖常规、模糊表述、异常输入等边界场景，定位并协助修复 <strong>16 个</strong>工具调用与话术 bug，将版本自测周期从 2 天压缩到 1 天</li>
              <li>整理 <strong>12 位</strong>试用店主的反馈，按「功能缺陷 / 体验优化 / 新增需求」分类输出分析文档，其中 <strong>3 项</strong>需求被纳入内测版本</li>
            </ol>
          </div>
        </section>

        <section class="main-section">
          <h2 class="main-section-title"><span class="section-icon">&#9670;</span> 项目经历</h2>

          <div class="main-project">
            <div class="main-project-head">
              <span class="main-project-name">水稻病虫害检测防治APP</span>
            </div>
            <p class="main-project-desc">基于 Spring AI + HarmonyOS 的智能农业诊断应用，采用端侧离线检测 + 云端大模型 RAG 诊断双通路架构，解决农田弱网/断网场景下病虫害实时识别与防治方案生成的工程难题</p>
            <div class="main-project-tech"><strong>技术栈：</strong>HarmonyOS ArkTS、C++ NAPI/NCNN、Spring Boot 3.x、Spring AI、WebFlux/SSE、PostgreSQL/PGVector、Redis、MCP</div>
            <ol class="main-project-list">
              <li>针对农田弱网环境，通过 <strong>C++ NAPI 桥接 NCNN 推理引擎</strong>将 YOLOv8 模型部署到鸿蒙端侧，实现<strong>断网状态下毫秒级病害识别</strong>；设计云端降级策略，端侧失败转为云端检测，提高系统可用性</li>
              <li>云端基于 <strong>Spring AI + PGVector 向量知识库</strong>构建 RAG 诊断链路，通过 <strong>WebFlux SSE 流式推送</strong>实现诊断结果逐字输出；在知识库层面实施<strong>语义分块、向量/关键词双路召回与重排序</strong>，检索准确率由约 60% 提升至约 90%</li>
              <li>针对大模型调用成本高的问题，设计 <strong>Redis 语义缓存</strong>与长文档分层摘要压缩策略，实测单次请求 Token 消耗降低近一半，同时回答准确率提升约 25%</li>
              <li>基于 <strong>MCP 协议</strong>封装天气 API、农药配比数据库等工具服务，使大模型按诊断场景动态调用所需工具，减少无关工具描述对上下文窗口和生成质量的干扰</li>
            </ol>
          </div>
        </section>

        <section class="main-section">
          <h2 class="main-section-title"><span class="section-icon">&#9670;</span> 自我评价</h2>
          <p class="main-summary">对 AI 应用开发保持持续学习兴趣，能从需求出发完成后端接口、模型调用、工具集成和前端页面落地。习惯通过源码阅读、官方文档和实际项目验证新技术，具备较强的问题拆解、工程实现和快速学习能力。</p>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import html2pdf from 'html2pdf.js'

const photoUrl = ref('')
const fileInput = ref(null)

const applyOnePageFit = async () => {
  await nextTick()
}

const triggerFileInput = () => {
  fileInput.value.click()
}

const handlePhotoUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = async (e) => {
    photoUrl.value = e.target.result
    await applyOnePageFit()
  }
  reader.readAsDataURL(file)
}

const exportPDF = async () => {
  await applyOnePageFit()
  const element = document.getElementById('resumeContent')
  const opt = {
    margin: [0, 0, 0, 0],
    filename: '庞业祺_AI应用开发_AIAgent方向_简历.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 794, windowWidth: 794, scrollY: 0, scrollX: 0, y: 0, x: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { before: '.pdf-page-break' }
  }
  html2pdf().set(opt).from(element).save()
}

onMounted(() => {
  applyOnePageFit()
  window.addEventListener('resize', applyOnePageFit)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', applyOnePageFit)
})
</script>

<style scoped>
.resume-wrapper { min-height: 100vh; background: #e5e7eb; padding: 30px 20px; }
.toolbar { max-width: 210mm; margin: 0 auto 15px; display: flex; justify-content: flex-end; }
.btn { padding: 8px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.btn-primary { background: #1e40af; color: white; }
.btn-primary:hover { background: #1e3a8a; }
.resume-container { width: 210mm; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.1); box-sizing: border-box; }
.tpl-sidebar { display: flex; font-size: 9.35pt; line-height: 1.48; color: #333; min-height: 297mm; }
.sidebar { width: 68mm; background: #1e3a5f; color: #e8edf2; padding: 20px 14px; flex-shrink: 0; display: flex; flex-direction: column; gap: 13px; font-size: 9pt; }
.sidebar-name { font-size: 22pt; font-weight: 800; color: #ffffff; margin: 0 0 8px; text-align: center; letter-spacing: 2px; }
.sidebar-photo { width: 40mm; height: 48mm; margin: 0 auto 4px; border-radius: 6px; overflow: hidden; border: 2px solid rgba(255,255,255,0.25); cursor: pointer; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); }
.sidebar-photo .photo-img { width: 100%; height: 100%; object-fit: cover; }
.photo-placeholder { text-align: center; color: rgba(255,255,255,0.6); font-size: 10pt; }
.photo-hint { margin-top: 3px; font-size: 9pt; color: rgba(255,255,255,0.4); }
.sidebar-section { border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; }
.sidebar-title { font-size: 10pt; font-weight: 700; color: #7eb8e0; margin-bottom: 5px; letter-spacing: 1px; text-transform: uppercase; }
.sidebar-item { font-size: 9pt; color: #dce4ec; margin-bottom: 4px; word-break: break-all; }
.sidebar-skill-list { margin: 0; padding-left: 13px; list-style: disc; color: #7eb8e0; }
.sidebar-skill-list li { font-size: 8.35pt; color: #dce4ec; margin-bottom: 5px; line-height: 1.42; }
.main-content { flex: 1; padding: 16px 19px 20px 21px; display: flex; flex-direction: column; gap: 4px; background: #fff; }
.main-section { margin-bottom: 7px; }
.main-section-title { font-size: 12pt; font-weight: 800; color: #1e3a5f; border-bottom: 2.2px solid #1e3a5f; padding-bottom: 3.5px; margin-bottom: 9px; letter-spacing: 1px; background: none; }
.section-icon { margin-right: 5.5px; font-size: 9.5pt; color: #1e3a5f; }
.main-edu { margin-bottom: 4px; }
.main-edu-row { display: flex; justify-content: space-between; align-items: center; }
.main-edu-school { font-weight: 700; font-size: 10.5pt; }
.main-edu-time { font-size: 9.5pt; color: #666; }
.main-edu-course { font-size: 9.5pt; color: #444; margin-top: 2.5px; }
.main-project { margin-bottom: 9px; padding-bottom: 7px; border-bottom: 1px solid #e0e6ec; }
.main-project:last-child { border-bottom: none; }
.main-project-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3.5px; }
.main-project-name { font-size: 11.5pt; font-weight: 800; color: #1e3a5f; }
.main-project-desc { font-size: 9.3pt; color: #444; line-height: 1.45; margin: 0 0 3.5px; }
.main-project-tech { font-size: 9.2pt; color: #555; margin-bottom: 4.5px; }
.main-project-list { margin: 2.5px 0 0 0; padding-left: 15px; }
.main-project-list li { font-size: 9.2pt; color: #333; line-height: 1.45; margin-bottom: 3.2px; }
.main-project-list li strong { color: #1e3a5f; font-weight: 700; }
.main-summary { font-size: 9.5pt; color: #333; line-height: 1.52; }
@page { size: A4 portrait; margin: 0; }
@media print {
  .toolbar { display: none; }
  .resume-wrapper { background: white; padding: 0; margin: 0; }
  .resume-container { box-shadow: none; margin: 0; width: 210mm; max-width: 210mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
