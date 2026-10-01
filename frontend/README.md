# Personal Accounting 前端

基于 Vue 3、Vue Router 和 Vite 的记账界面，包含首页、收支概览、账目管理、预算和个人设置，支持中文与英文。

完整功能介绍、后端配置和部署说明见 [项目 README](../README.md)。

## 开发

在项目根目录执行：

```sh
npm ci --prefix frontend
cp frontend/.env.example frontend/.env
npm run dev --prefix frontend
```

默认地址为 `http://localhost:5173`。需要同时启动 Express 后端，默认 API 地址为 `http://localhost:3000`。

## 检查与构建

```sh
npm test --prefix frontend
npm run build --prefix frontend
# 此命令会自动修复部分 lint 问题
npm run lint --prefix frontend
```

端到端测试配置见 `playwright.config.js`，运行步骤见根目录 README。

## 配置

- `VITE_API_BASE_URL`：开发默认使用 localhost:3000；生产同源部署应留空。
- `VITE_PERSONALITY_ENABLED`：设为 `true` 启用实验性性格管家，默认关闭。

这些变量在启动 / 构建时读取。修改后需要重启服务或重新构建。
