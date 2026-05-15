# 企业地址管理

内部使用的**地址库**与**地址挂靠申请**管理：业务员可创建与跟进挂靠流程；管理员维护地址资源、审批申请，并管理业务员账号。

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite 6、TypeScript、Tailwind CSS 4、React Router 7 |
| 后端 | Express 4、TypeScript、`node:sqlite`（SQLite）、express-session、Multer（证件图上传） |

仓库为 **npm workspaces** 单体：`client/` 与 `server/`。

---

## 功能概览

- **登录与会话**：基于 Cookie 的会话；角色分为**管理员**与**业务员**。
- **总览**：工作台入口。
- **地址库**（仅管理员）：维护三类地址资源——地址挂靠、集中办公区、商务秘书。
- **挂靠流程**（登录用户）：新建申请（草稿或直接提交审批）、编辑草稿、提交/重新提交；材料按**渠道 / 直客**区分字段；身份证与执照支持本地上传；列表支持**关键词查询**与**状态下拉筛选**（草稿、待审批、已通过、已驳回）。
- **统计分析**：数据看板（按当前实现展示统计信息）。
- **用户管理**（仅管理员）：修改账号显示名与密码；增删业务员账号。

申请中的**服务类型**与所选**关联地址的地址类型**一致，随地址自动同步（与地址库三类一致）。

---

## 环境要求

- **Node.js ≥ 22.5**（服务端 `package.json` 的 `engines` 约定；使用内置 `node:sqlite`）。
- 推荐使用当前 LTS 或项目已验证的 Node 22+ 版本。

---

## 快速开始（本地开发）

在项目根目录安装依赖后执行：

```bash
npm install
npm run dev
```

会并行启动：

- **前端**：<http://localhost:5173/>（Vite 开发服务器）
- **API**：默认 <http://localhost:3889/>（Express）

浏览器访问前端即可；`/api` 由 Vite **代理**到后端，无需单独配置 CORS 给前端。

### 演示账号（开发环境）

| 角色   | 用户名 | 密码     |
|--------|--------|----------|
| 管理员 | `admin` | `admin123` |
| 业务员 | `sales` | `sales123` |

**生产环境请务必：** 修改全部默认密码，并设置强随机 **`SESSION_SECRET`**（勿使用仓库中的开发默认值）。

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前后端开发模式 |
| `npm run build` | 依次构建 `server` 与 `client`（`tsc` + `vite build`） |
| `npm run start` | 仅启动已构建的后端（`node dist/index.js`，见 `server` 包） |
| `npm run dev -w client` / `npm run dev -w server` | 单独启动某一端 |

使用 **`vite preview`** 预览前端构建产物时，须**另开终端**先启动 API，例如：

```bash
npm run start -w server
```

并在 `client` 目录执行 `npm run preview`（`vite.config.ts` 已为 `preview` 配置与开发环境相同的 `/api` 代理目标端口）。

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` 或 `API_PORT` | API 监听端口，默认 **`3889`**。修改后须与 `client/vite.config.ts` 中代理使用的端口**一致**（或通过同名环境变量让 Vite 读取同一端口）。 |
| `SESSION_SECRET` | 会话签名密钥，**生产必填**。 |

PowerShell 示例（改用 3890 端口）：

```powershell
$env:PORT='3890'; $env:API_PORT='3890'; npm run dev
```

同时需让 Vite 进程看到相同的 `API_PORT`/`PORT`，否则代理仍指向旧端口。

---

## 数据与上传

- **SQLite 数据库**默认路径：`server/data/addresses.db`（首次运行自动创建目录与表结构；含演示数据种子逻辑，详见 `server/src/db.ts`）。
- **证件类图片**上传后保存在服务端上传目录，通过 `/api/uploads/...` 在登录会话下访问（具体见 `server/src/index.ts`）。

---

## 权限摘要

| 能力 | 管理员 | 业务员 |
|------|--------|--------|
| 地址库 CRUD | ✓ | — |
| 用户管理 | ✓ | — |
| 挂靠申请列表 | 全部 | 仅本人创建的申请 |
| 审批通过 / 驳回 | ✓ | — |
| 创建与编辑自己的申请 | ✓ | ✓ |

---

## 故障排查

### 端口被占用（EADDRINUSE）

表示 API 监听端口已被占用。可关闭其它终端中的旧 `node`/`tsx` 进程，或按上文修改 **`PORT` / `API_PORT`** 并保证与前端代理一致。

### 数据库 / 表结构

若曾使用极旧版本库结构，启动时可能触发迁移或重建逻辑（以 `server/src/db.ts` 为准）。生产环境升级前请**备份** `addresses.db`。

---

## 目录结构（简）

```
client/src/     # React 页面、路由、鉴权、API 封装
server/src/     # Express 入口、会话、REST、SQLite 初始化
```

更细的开发计划与待办见仓库内 `开发计划`（纯文本备忘，非构建产物）。
