# TIPS 项目 BUG 修复 & 对话体验优化提示词

> 适用对象：开发者（POPbooth）
> 项目路径：F:\Claude Code\Alan's Future Plan\alan\
> 当前版本：v2.2

---

## 一、三个确认存在的 BUG

### BUG 1：右下角齿轮设置按钮点不开

**根因定位：**
`app.js` 初始化 IIFE 中，`settingsBtn` 的点击事件未正确绑定，或 DOM 未完成加载就执行了绑定。

**修复提示词：**
> 在 `app.js` 初始化 IIFE 末尾（约第 210 行后）加入：
> ```js
> $('settingsBtn').onclick = () => openSettings()
> ```
> 同时检查 `openSettings()` 函数中是否正确执行了 `settingsModal.classList.add('open')`，以及 CSS 中 `.modal-overlay.open { display:flex }` 是否已定义。

**自行验证方向：**
- 在 iPad Safari 中点齿轮 → Safari 远程调试看 console 是否报错
- 检查 `index.html` 第 317 行齿轮按钮 `id="settingsBtn"` 是否存在且唯一

---

### BUG 2：全链路分析长时间无响应，最终失败

**根因定位：**
`callDS()` 函数（约第 373 行）使用 `fetch()` 调用 DeepSeek API，但**未设置 timeout**，也未使用 `AbortController`。DeepSeek 处理 5 个 Agent 串行分析时容易超过 30 秒，网络层断开后直接进入 `catch`，**无重试逻辑**，只弹 `toast('出错了: ' + e.message)`。

**修复提示词：**
> 修改 `callDS()` 函数，加入：
> 1. `AbortController` + 120 秒超时
> 2. 超时或网络错误后自动重试 1 次（延迟 2 秒）
> 3. 重试仍失败才 `toast()` 报错
>
> 参考伪代码：
> ```js
> async function callDS(systemPrompt, userMsg, retry = 1) {
>   const controller = new AbortController()
>   const timeout = setTimeout(() => controller.abort(), 120000)
>   try {
>     const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
>       method: 'POST',
>       headers: { ... },
>       body: JSON.stringify({ model: S.chatModel, messages: [...] }),
>       signal: controller.signal   // ← 加这行
>     })
>     clearTimeout(timeout)
>     // ... 正常处理
>   } catch(e) {
>     clearTimeout(timeout)
>     if (retry > 0 && e.name !== 'AbortError') {
>       await new Promise(r => setTimeout(r, 2000))
>       return callDS(systemPrompt, userMsg, retry - 1)
>     }
>     toast('请求超时，请重试或切换模型')
>     return null
>   }
> }
> ```

**自行验证方向：**
- 用 Safari 远程调试看 network 面板，`callDS` 请求是否在 120 秒内完成
- 测试 5 个 Agent 全链路是否能在 120 秒内返回

---

### BUG 3：设置里不能选择 `deepseek-v4-pro[1M]`

**根因定位：**
`index.html` 第 434~439 行 `<select id="chatModel">` 的 option 中值写的是 `deepseek-v4-pro[1m]`（**小写 m**），但 `app.js` 第 32 行存/取的时候可能出现大小写不一致，导致赋值失败，select 显示空白。

**修复提示词：**
> 1. 统一全项目的大小写：全部改为 `deepseek-v4-pro[1M]`（**大写 M**）
> 2. 修改 `saveSettings()` 函数，在保存前 normalize 值：
> ```js
> S.chatModel = $('chatModel').value.trim().replace(' [1m]', '[1M]')
> S.thinkModel = $('thinkModel').value.trim().replace(' [1m]', '[1M]')
> ```
> 3. 检查 `openSettings()` 里 `$('chatModel').value = S.chatModel` 赋值后 select 是否显示正确

**自行验证方向：**
- 在 Safari 控制台执行 `$('chatModel').value = 'deepseek-v4-pro[1M]'` 看是否能正确选中
- 检查 `localStorage` / IndexedDB 里 `chatModel` 字段的实际值

---

## 二、对话体验优化建议

### 核心问题
目前 `sendMessage()` 每次只发 `buildContext() + 当前一句话` 给 API，**不发送历史消息数组**，导致 TIPS 在多轮对话中"失忆"。

`chatHistory` 数组只用于本地界面渲染，没有拼进 API 请求的 `messages` 里。

---

### 优化方案 A（推荐优先做）：发送最近 N 条历史消息

**效果：** 多轮对话有连贯性，Alan 说"那个专业"TIPS 能理解指代。

**提示词：**
> 修改 `sendMessage()` 函数（约第 484 行），在调用 `callDS()` 前，拼接最近 6~10 条历史消息：
>
> ```js
> // 拼接最近 8 条历史
> const recentHistory = chatHistory.slice(-8).map(m => ({
>   role: m.role === 'user' ? 'user' : 'assistant',
>   content: m.text
> }))
>
> const messages = [
>   { role: 'system', content: P0 + '\n' + ctx },
>   ...recentHistory,
>   { role: 'user', content: txt }
> ]
> ```
>
> 注意：`chatHistory` 里存的是 `{ role, text, time }`，需要转换成 API 需要的 `{ role, content }` 格式。

**自行思考方向：**
- 8 条够不够？Alan 通常连续聊几轮？
- Token 消耗会不会太多？可以考虑只保留 user 消息，不保留 assistant 回复

---

### 优化方案 B：memory store 按需检索拼进 context

**效果：** TIPS "心里有数"但不过度重复，Alan 聊到兴趣方向时能接住。

**提示词：**
> 修改 `buildContext()` 函数（约第 525 行），在返回 `ctx` 之前：
> 1. 用当前消息关键词去 `memory` store 里检索相关记录
> 2. 只取最近 3~5 条相关 memory，拼进 `ctx`
> 3. 拼接时加一句指令给 AI：**"【背景记忆】仅供理解背景，不要在回复中重复这些内容"**
>
> ```js
> // 在 buildContext() 末尾加入
> const mems = await db.getRecentMemory(5)  // 取最近5条
> if (mems.length) {
>   ctx += '\n【背景记忆（仅供理解，不要重复念出来）】\n'
>   mems.forEach(m => { ctx += `- ${m.content}\n` })
> }
> ```

**自行思考方向：**
- "相关"怎么定义？简单关键词匹配够不够？
- memory 里存的是兴趣/情绪/里程碑，哪些类型该拼进 context，哪些不该？

---

### 优化方案 C（可选）：定期压缩老对话存进 memory

**效果：** 长期记忆，Token 省，不丢重要信息。

**提示词：**
> 在 `autoCompress()` 函数里（约第 1014 行），当对话轮数超过一定阈值时：
> 1. 把最早的 20 条对话打包，调用一次 DeepSeek API 做摘要
> 2. 摘要结果存进 `memory` store（type: `conversation_summary`）
> 3. 从 `chatHistory` 里删掉已被摘要的消息
>
> 这样 Alan 聊过的重要信息不会丢，但也不会重复发给 API。

**自行思考方向：**
- 压缩阈值设多少合适？20 条？50 条？
- 摘要存在 memory 里，方案 B 的检索逻辑能覆盖到吗？

---

## 三、给你自己留的思考题（自行寻找更优解）

### 关于上下文管理
- [ ] 发送历史消息时，**只发 user 消息不发 assistant 消息**，Token 能省多少？
- [ ] 能不能用**向量检索**（哪怕简化版关键词匹配）来代替最近 N 条？这样更精准
- [ ] Alan 的对话风格是短句还是长句？短句可能需要更多历史才能有连贯性

### 关于 memory 使用
- [ ] `memory` store 目前只存不读，**是不是浪费了**？有没有更轻量的方式让 TIPS "记住"重要信息？
- [ ] 情绪记录存在 memory 里，除了后台观察，**能不能在对话时主动用起来**？（比如 Alan 情绪低落时，TIPS 主动安慰）

### 关于 BUG 修复
- [ ] `callDS()` 的超时设 120 秒够不够？DeepSeek API 官方有没有建议的 timeout？
- [ ] 齿轮按钮点不开，是不是只在 iPad Safari 上有这个问题？桌面端正常吗？（帮助缩小排查范围）

---

## 四、验证清单

- [ ] 修复后，齿轮按钮在 iPad Safari 上能正常打开设置面板
- [ ] 修复后，全链路分析能完整跑完 5 个 Agent 不出错
- [ ] 修复后，`deepseek-v4-pro[1M]` 能在设置里正常选中和保存
- [ ] 优化后，Alan 说"那个专业怎么样"，TIPS 能理解指代不从零开始
- [ ] 优化后，TIPS 不会把 memory 里的内容原样背给 Alan
- [ ] Token 消耗在优化后没有明显增加（对比优化前）

---

*最后更新：2026-06-01*
*整理人：WorkBuddy AI（混元H3）*
