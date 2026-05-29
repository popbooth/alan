# AGENTS.md - 本项目开发规则

## 文件写入规则
- 禁止使用 cmd echo 写代码文件（会乱码）
- 所有文件写入统一用 Python open().write() 方式
- 每次修改前先读取原文件，修改后验证

## 文件结构
- index.html + app.js = PAD端App（单页应用）
- agent2.py = 命令行版Agent2（备用）
- 成绩.csv = 数据源（按行追加）
- reports/ = Agent1输出报告
- memory/ = 系统记忆 + 参考资料

## 技术栈
- PAD端: 单文件 HTML + JS，本地存储
- AI: DeepSeek API (deepseek-v4-pro)
- 部署: 飞牛NAS 静态文件服务

## 当前状态
- 学生: 江苏扬州扬大附中高一，选科物化生
- 进度: PAD App已完成基本功能，待测试
- 待办: 年排数据、首次全链路分析
- 待开发: Agent4.5 出分后志愿填报模块