# Personal Accounting · 个人记账

一个使用 **Vue 3 + Express + SQLite** 构建的个人记账 Web 应用，帮助用户记录收支、查看支出结构、管理月度预算，并通过只读财务助手查询账本。

支持中文 / English，适配桌面和手机。项目采用前后端分离开发，也支持由 Express 托管构建后的前端。

> 本文对应 `codex/edit-transactions` 分支的实现。默认分支 `main` 目前是较早版本；体验下述功能请先使用该分支，合并后可直接使用默认分支。

## 功能

- **账户与个人设置**：注册、登录、退出、修改资料和密码；账目按登录用户隔离。
- **收支记录**：新增、编辑、删除收入与支出，记录分类、日期和备注。
- **账目检索**：按收支类型、分类、关键词、月份或日期范围筛选，支持排序和分页。
- **分类与快捷模板**：内置分类、自定义分类、隐藏自定义分类，以及常用记账模板。
- **统计与报表**：月度收支与结余、每日趋势、分类支出占比、周报和月报。
- **月度预算**：设置预算并查看当月支出进度。
- **财务助手**：通过中文或英文查询近期账目、收支汇总、主要支出分类和月度变化。

财务助手当前使用本地规则驱动的 **mock provider**，无需 API Key，只读取当前用户的账目。DeepSeek 的配置入口已预留，但实际调用尚未实现。性格管家默认关闭，可通过前端功能开关启用实验功能。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、Vite |
| 后端 | Node.js、Express 5 |
| 数据存储 | SQLite、better-sqlite3 |
| 测试 | Vitest、Vue Test Utils、Node.js test runner、Playwright |

## 本地启动

使用 **Node.js 22.18+ 的 22.x 版本**和 npm，以满足根目录的版本约束。

```sh
git clone https://github.com/hhe25387/personal-accounting.git
cd personal-accounting
git switch codex/edit-transactions
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

分别在两个终端启动服务：

```sh
# 终端 1：后端，默认 http://localhost:3000
npm run dev --prefix backend
```

```sh
# 终端 2：前端，默认 http://localhost:5173
npm run dev --prefix frontend
```

打开 `http://localhost:5173`，注册账户后即可开始记账。首次启动后端会自动初始化数据库，无需手动建表或安装单独的数据库服务。

可用以下接口检查后端是否启动：

```sh
curl http://localhost:3000/api/health
```

## 环境变量

后端从 `backend/.env` 加载配置；前端变量由 Vite 在启动或构建时读取，修改后需重启开发服务或重新构建。

| 位置 | 变量 | 默认值 / 用途 |
| --- | --- | --- |
| 后端 | `PORT` | `3000`，服务端口 |
| 后端 | `DATABASE_PATH` | `accounting.db`，相对路径以 `backend/` 为基准；也支持绝对路径 |
| 后端 | `AGENT_PROVIDER` | `mock`，当前唯一可用的助手 provider |
| 后端 | `FRONTEND_ORIGIN` | 额外允许的前端来源；开发默认允许 localhost 和 127.0.0.1 的 5173 端口 |
| 后端 | `NODE_ENV` | 设为 `production` 时登录 Cookie 使用 `Secure`，需要 HTTPS |
| 后端 | `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | 预留配置，目前无需填写 |
| 前端 | `VITE_API_BASE_URL` | 未设置时，开发使用 `http://localhost:3000`，生产使用同源 API |
| 前端 | `VITE_PERSONALITY_ENABLED` | 示例值为 `false`；设为 `true` 启用实验性性格管家 |

不要提交 `.env`、真实密钥或个人账本。默认数据库位于 `backend/accounting.db`，备份时建议先停止后端，再复制数据库文件；自定义路径的父目录需提前创建。

## 构建与部署

根目录提供统一构建命令，会安装前后端依赖并生成 `frontend/dist`：

```sh
# 使用同源 API，覆盖本地 .env 中的 localhost 地址
VITE_API_BASE_URL= npm run build
npm start
```

访问 `http://localhost:3000`。Express 会同时提供 API 和前端页面，并处理前端路由回退。

部署到 Railway 等 Node.js 托管平台时：

1. 构建命令设为 `npm run build`，启动命令设为 `npm start`。
2. 使用 Node.js 22.x，设置 `NODE_ENV=production` 和 `AGENT_PROVIDER=mock`。
3. 将 `VITE_API_BASE_URL` 留空，以使用同源 API；构建时不要指向 localhost。
4. 为 SQLite 配置持久化存储。例如将卷挂载到 `/data`，设置 `DATABASE_PATH=/data/accounting.db`。
5. 通过平台提供的 HTTPS 域名访问。没有持久化卷时，重新部署可能丢失账本。

当前存储方式适合单实例部署。跨来源部署需要同时考虑 `FRONTEND_ORIGIN` 和 Cookie 的 `SameSite=Lax` 行为，优先采用前后端同源部署。

## 测试

安装两端依赖后，在根目录运行：

```sh
npm test
```

也可以分别运行：

```sh
npm test --prefix frontend
npm test --prefix backend
npm run build --prefix frontend
```

端到端测试覆盖注册、记账和账目查看流程，使用独立端口和内存数据库：

```sh
cd frontend
npx playwright install chromium
npm run test:e2e
```

运行时需确保 `3100` 和 `4173` 端口空闲。前端还提供 `npm run lint --prefix frontend`，该命令会自动修复部分问题。

## 项目结构

```text
personal-accounting/
├── frontend/
│   ├── src/views/           # 首页、概览、账目、预算和个人设置
│   ├── src/components/      # 记账表单及其他界面组件
│   ├── src/services/        # API 请求封装
│   ├── src/i18n.js          # 中英文文案
│   └── e2e/                # Playwright 测试
├── backend/
│   ├── server.js           # HTTP 路由、认证及静态资源托管
│   ├── database.js         # 数据库连接
│   ├── initializeDatabase.js
│   ├── *Service.js         # 认证、账目、预算、报表等业务逻辑
│   └── agent/              # 只读助手、provider 与查询工具
└── docs/                   # 设计与实现记录
```

## API 概览

除健康检查和注册 / 登录外，业务接口需要有效登录会话。浏览器通过 HttpOnly Cookie 维持会话。

| 路径 | 用途 |
| --- | --- |
| `/api/health` | 健康检查 |
| `/api/auth/*` | 注册、登录、查询当前用户和退出 |
| `/api/transactions` | 账目列表、筛选和新增；通过 `/:id` 编辑或删除 |
| `/api/categories` | 查询、新增和隐藏分类 |
| `/api/templates` | 管理快捷记账模板 |
| `/api/statistics/summary`、`daily`、`categories` | 月度汇总、每日趋势和分类统计 |
| `/api/budgets` | 查询及管理月度预算 |
| `/api/reports/weekly`、`monthly` | 周报与月报 |
| `/api/assistant` | 只读财务问答 |
| `/api/account/*`、`/api/preferences` | 账户资料、密码及偏好 |

具体请求字段、响应和异常处理可查看 `backend/server.js` 及对应的 `*.test.js`。

## 后续方向

以下为待完善事项，并非已实现功能：

- 接入真实模型 provider，同时保留用户数据隔离和只读工具限制。
- 增加账本导入 / 导出和更完善的备份体验。
- 补充产品截图及在线演示入口。

项目尚未提供仓库级 LICENSE；子项目 package.json 中的 license 字段不能替代完整的授权说明。
