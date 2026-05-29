# MEMORY — TIPS 记忆总索引

## 学生信息
- 姓名: Alan
- 学校: 江苏省扬州市扬州大学附属中学
- 年级: 高一 (2026年5月)
- 选科: 物化生（暂定，高一下未正式分班）
- 高考年份: 2028
- 年排: 约50+ (语数外，班主任口头告知)

## AI 助手
- 名称: TIPS (原名知衡)
- 定位: Alan 专属升学顾问
- 技术栈: DeepSeek API + Bing Search API + IndexedDB + PWA

## 文件结构

### 知识库
- [知识新鲜度索引](index.json) — 所有知识的新鲜度跟踪
- [knowledge/policy/](knowledge/policy/) — 高考政策文件
- [knowledge/universities/](knowledge/universities/) — 院校录取数据
- [knowledge/majors/](knowledge/majors/) — 专业就业信息
- [knowledge/industry/](knowledge/industry/) — 产业趋势报告

### 画像系统 (自动积累)
- [profile/学科轨迹](profile/) — 每次考试自动更新
- [profile/兴趣方向](profile/) — 聊天中提取的兴趣偏好
- [profile/情绪记录](profile/) — 情绪波动记录
- [profile/关键节点](profile/) — 分班/换老师/重要决定

### 其他
- [conversations/](conversations/) — 聊天记录 (PC端归档，PAD端在IndexedDB)
- [exports/](exports/) — 从PC同步的知识包
- [references/deepseek_api.md](references/deepseek_api.md) — API参数速查

## 待办
- [ ] 运行首次全链路分析 (等待年排数据)
- [ ] 搜索首轮高考政策 (PC端用Claude搜索)
- [ ] 搜索首轮院校录取数据
- [ ] 推动新增记忆目录下，添加各目录独立说明
- [ ] 高二分班后获取正式年排

## 状态
- 上次更新: 2026-05-29
- 系统版本: v0.5 (架构重构)
