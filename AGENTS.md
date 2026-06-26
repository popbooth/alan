# AGENTS.md - 本项目开发规则

## 文件写入规则
- 禁止使用 cmd echo 写代码文件（会乱码）
- 所有文件写入统一用 Python open().write() 方式
- 每次修改前先读取原文件，修改后验证

## 同步更新强制规则
每次修改、更新或推送前，必须执行以下步骤：
1. 读取所有 memory/ 下的文件，判断本次改动是否需要同步更新
2. 如果修改了知识库（policy/universities/majors/industry），同步更新 index.json 的新鲜度索引
3. 如果修改了学生信息/家庭信息/偏好，同步更新 MEMORY.md
4. 如果改动了功能/版本/文件结构，同步更新 README.md（版本号、日期、改动说明、文件清单等）
5. 全部同步完后，再 git add → commit → push

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