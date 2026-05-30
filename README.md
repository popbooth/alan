# TIPS — Alan's Future Plan

> 个人专属 AI 升学规划系统 | 高一跟踪至 2028 高考
> 在线地址: https://popbooth.github.io/alan/
> 最后更新: 2026-05-29

---

## 项目概况

| 项目 | 说明 |
|------|------|
| 目标用户 | Alan（江苏扬州扬大附中高一 → 2028高考）|
| AI 助手 | **TIPS**（原名知衡）|
| 技术栈 | 纯前端 PWA + DeepSeek API + SerpAPI/Bing Search + IndexedDB + Chart.js |
| 部署方式 | GitHub Pages（HTTPS），PAD 可直接添加到桌面 |
| 代码总量 | 约 2,400 行（核心 JS）|
| 数据存储 | 全部在 PAD 本地 IndexedDB，不外传 |

---

## 界面布局

4 个底部 Tab：

| Tab | 功能 |
|-----|------|
| 💬 对话 | DeepSeek 风格左侧历史列表 + 右侧聊天，支持多会话切换 |
| 📊 学情 | 科目卡片网格 + 成绩趋势折线图 + 能力雷达图 + 总分趋势 + 波动柱状图 |
| 📋 报告 | 全链路分析报告，Markdown 渲染（表格/代码/列表）|
| 👤 我的 | 个人信息编辑 + 统计 + 记忆状态 + 配置导出导入 + 检查更新 |

---

## 功能清单

### 日常功能
- ✅ 聊天对话（TIPS 专属升学顾问，带表情和情感表达）
- ✅ 多会话管理（左侧历史列表，可切换/删除对话）
- ✅ 成绩导入（CSV 上传 / 拍照识别 DeepSeek Vision）
- ✅ 成绩修正（孩子可通过对话改分，原始分后台保留）
- ✅ 全链路分析（A2→A4→A3→A4→A1，5 Agent 流水线）
- ✅ 学情图表（Chart.js 四张图表，深色模式自适应）

### 智能功能
- ✅ 联网搜索（SerpAPI/Bing，搜索百度，缓存 24h）
- ✅ 知识库（高考政策、赋分规则、985/211/双一流院校专业、产业趋势）
- ✅ 知识新鲜度检查（过期自动提醒，有 Key 则自动搜索刷新）
- ✅ 后台情绪观察（TIPS 不知情，定期分析对话记录，家长查看）
- ✅ 成绩波动检测（≥15% 自动告警 + 推送通知）

### 家长功能
- ✅ 家长面板（6 位 PIN 锁定）
- ✅ 月度 Token 预算 + 用量图表
- ✅ 数据导出/导入/清除
- ✅ 配置导出/导入（PC 配好→PAD 一键导入）
- ✅ Webhook 通知（成绩波动/报告生成推送到微信）
- ✅ 家长模式开关（关闭后孩子看不到家长入口）

### 安全功能
- ✅ API Key 加密存储（AES-GCM，非默认 PIN 时自动加密）
- ✅ PWA 离线缓存（Service Worker，断网也能看历史）
- ✅ 双视角切换（家长/孩子模式）

---

## 知识库

```
memory/knowledge/
├── policy/
│   ├── 江苏新高考3+1+2.md       — 考试模式、选科要求、物化生覆盖率
│   ├── 赋分规则.md              — A~E 五等赋分、化学vs生物赋分差异
│   └── 青春期心理参考.md         — 高一~高三全阶段心理特点、沟通策略、预警信号
├── universities/
│   ├── 985高校优势专业.md        — 39所985完整名单+王牌专业（按地区分组）
│   ├── 211高校王牌专业.md        — 211大学王牌专业+行业分类推荐
│   └── 江苏院校录取数据.md       — 省内16所双一流+投档线参考
├── majors/
│   └── 物化生可报专业.md         — 6大方向+推荐排序
└── industry/
    ├── 国家重点产业.md           — 六大科技赛道+需供比+薪资
    └── 江苏优势产业.md           — 南京AI/苏州机器人/新能源/生物医药
```

每条知识带过期时间，到期后自动触发刷新。

---

## Agent 流水线

```
上传成绩/拍照 → A2(学情画像) → A4(产业趋势) → A3(组合策略) → A4(专业院校) → A1(总控报告)
                    ↑               ↑              ↑               ↑              ↑
               纯数据分析       国家产业方向    赋分优先级       院校推荐      整合输出
                                                               + 就业前景
```

5 个 Agent 全部在浏览器内通过 DeepSeek API 串行调用，数据以纯对象传递，无全局可变状态。

---

## 技术架构

```
PAD 浏览器 (PWA)
│
├── IndexedDB (TIPS_DB)
│   ├── settings         键值配置（API Key 加密存储）
│   ├── conversations    聊天消息（按 sessionId 分组）
│   ├── grades           成绩（每科目一条，含原始分→修正分轨迹）
│   ├── reports          分析报告
│   ├── memory           系统记忆（学科/兴趣/情绪/里程碑/家长观察）
│   ├── search_cache     搜索缓存 (24h TTL)
│   ├── usage_log        Token 用量日志
│   └── knowledge_index  知识库索引
│
├── DeepSeek API      对话 + 分析 + 视觉识别（成绩单拍照）
├── SerpAPI/Bing      联网搜索（可选，建议配）
├── Server酱          Webhook 通知推送到微信
└── GitHub Pages      知识同步源（PC 整理 → git push → PAD 自动拉取）
```

---

## 文件清单

```
d:/AI/Alan's Future Plan/
├── index.html          主界面，内嵌 CSS + HTML 结构
├── app.js              核心应用逻辑（聊天/分析/Tab/搜索/家长面板）
├── db.js               IndexedDB 封装层（8 store + CRUD）
├── prompts.js          5 个 Agent 系统提示词
├── charts.js           Chart.js v4 六种图表封装
├── crypto.js           Web Crypto API AES-GCM 加密
├── sw.js               Service Worker（缓存优先 + 离线）
├── manifest.json       PWA 清单
├── agent2.py           备用离线学情分析脚本（Python）
│
├── memory/
│   ├── index.json      知识新鲜度索引 + 过期规则
│   ├── knowledge/      政策/院校/专业/产业/心理知识库
│   ├── profile/        孩子画像（自动积累）
│   ├── conversations/  聊天归档
│   └── exports/        PC 同步知识包
│
├── .github/workflows/
│   └── deploy.yml      GitHub Actions 自动部署
│
├── reports/            历史分析报告
├── 成绩20260529.csv    成绩数据
├── 开发记录.md          开发历史记录
└── README.md           本文件
```

---

## 部署与更新

### 在线地址
```
https://popbooth.github.io/alan/
```

### PAD 添加到桌面
Safari → 打开网址 → 分享 → 添加到主屏幕

### 更新代码
```bash
cd "d:/AI/Alan's Future Plan"
git add -A
git commit -m "改动说明"
git push
```
GitHub Actions 自动部署，PAD 刷新即为新版。

### 配置迁移
「我的」Tab → 导出配置 → 传到 PAD → 导入配置

---

## 通知设置

支持 Webhook 推送重要事件到微信（通过 Server酱）：
1. 打开 https://sct.ftqq.com/ 微信扫码
2. 获取 SendKey
3. TIPS 设置 → 通知地址填入 `https://sct.ftqq.com/你的SendKey.send`

触发事件：成绩波动≥15%、全链路分析完成、情绪观察摘要

---

## 默认密码

- 家长面板: **292010**（6 位数字，可在设置中修改）

---

## 版本历史

| 版本 | 内容 | 状态 |
|------|------|------|
| v0.5 | 架构重构（IndexedDB + Tab + 改名 TIPS）| ✅ |
| v1.0 | MVP 核心（图表 + 全链路 + 学情Tab + 波动检测）| ✅ |
| v1.5 | 增强功能（PWA + 搜索 + 拍照识别 + 家长面板 + 预算）| ✅ |
| v2.0 | 生产准备（加密 + 双视角 + 性能优化）| ✅ |
| v2.1 | 侧边栏多会话 + 删除对话 + 后台观察 + 知识库 + 通知 | ✅ |
