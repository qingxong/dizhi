# 企业地址管理

内部使用的**地址库**、**地址挂靠申请**与**地址协议**管理系统：业务员创建并跟进挂靠与协议流程；管理员维护地址资源、审批申请、配置协议 Word 模板并管理账号。

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite 6、TypeScript、Tailwind CSS 4、React Router 7、SheetJS（`xlsx`，地址批量导入） |
| 后端 | Express 4、TypeScript、`node:sqlite`（SQLite）、express-session、Multer（图片/协议文件/模板上传）、docxtemplater（协议 Word 填充） |

仓库为 **npm workspaces** 单体：`client/` 与 `server/`。

---

## 功能概览

### 登录与会话

- 基于 Cookie 的会话；角色分为**管理员**与**业务员**。
- 演示账号见下文「快速开始」；生产环境须修改默认密码并配置 `SESSION_SECRET`。

### 总览

- 工作台入口；管理员可见全平台统计，业务员可见本人挂靠相关统计。

### 地址库（仅管理员）

- 维护三类地址资源：**地址挂靠**、**集中办公区**、**商务秘书**（`address_type`）。
- 每条地址包含：类型、区域、详细地址。
- **占用状态**：`可领取` / `已领取`（由「已通过且已分配详细地址」的挂靠申请占用，与审批分配逻辑一致）。
- 支持按类型、关键词、占用状态筛选；已被占用的地址不可删除。
- **批量导入**：下载 Excel 模板或粘贴 TSV，单次最多 500 条（表头支持中英文列名）。

### 挂靠流程（登录用户）

**申请阶段（业务员）**

- 选择**地址类型**与**地址区域**（区域来自地址库中该类型已有区域，不手选具体门牌）。
- 填写：申请人（默认当前账号显示名）、**群名称**（服务群，选填）、说明。
- **联络人与材料**：渠道 / 直客两套字段；法人身份证正反面、执照等支持本地上传（JPEG/PNG/WebP，单张 ≤ 8MB）。
- 「是否用于办理地址变更」为必选（是/否）；选「是」须上传执照照片。
- 可保存**草稿**或直接**提交审批**；已驳回可修改后**重新提交**。

**审批阶段（管理员）**

- 对「待审批」记录**通过**或**驳回**；通过时从地址库同类型、同区域中自动分配一条**未被占用**的详细地址。
- 可在**任意挂靠状态**下**修改资料**（不改变审批状态；已通过且改类型/区域时会按新条件重新分配地址）。
- 可删除挂靠申请（管理员）。

**列表与检索**

| 列 | 内容 |
|----|------|
| 地址需求 | 类型、区域、详细地址（可换行展示、复制详细地址/全部信息） |
| 企业 / 联络 | **企业名称**（协议申请后填写）、法人姓名、电话、群名称、内部申请人 |
| 类型 | 渠道 / 直客，查看材料 |
| 挂靠状态 | 草稿 / 待审批 / 已通过 / 已驳回 |
| 地址协议 | 协议进度、申请摘要、审核/下载/回传操作 |
| 时间线 | 创建、提交、审批时间 |
| 操作 | 编辑、提交、审批、删除等 |

- **关键词搜索**：企业名称、法人、电话、群名称、地址、申请人、协议状态文案等。
- **状态筛选**：挂靠状态（草稿 / 待审批 / 已通过 / 已驳回）。

库内 `service_type` 与地址类型对应，界面不再单独维护「服务类型」下拉。

### 地址协议（挂靠「已通过」之后）

在**同一条挂靠记录**上延续的子流程：

| 步骤 | 角色 | 说明 |
|------|------|------|
| 1 | 业务员 | 点击「申请协议」，填写**企业名称、金额、服务开始/结束时间**，提交审核 |
| 2 | 管理员 | 在「协议模板」页维护 Word（`.docx`）模板；在列表或「审核详情」中查看协议要素后**通过并生成**或驳回 |
| 3 | 业务员 | **下载协议**（PDF 优先，见环境说明）发给客户盖章 |
| 4 | 业务员 | **回传盖章协议**（**不限文件格式**，单文件 ≤ 25MB，保留原扩展名） |
| 5 | — | 状态变为「协议已完成」，流程结束 |

协议状态：`未申请` → `协议待审` → `待回传盖章协议` → `协议已完成`（驳回后可重新申请）。

管理员审核时可在「地址协议」列看到企业/金额/服务期摘要，或通过 **审核详情** 弹窗查看完整信息后再操作。

### 协议模板（仅管理员）

- 导航：**协议模板**。
- 上传/下载 `.docx` 模板；页面列出全部**占位符**及示例值（如 `{enterprise_name}`、`{amount}`、`{amount_cn}`、`{detail_address}` 等）。
- 生成逻辑使用 [docxtemplater](https://docxtemplater.com/) 填充模板。

### 统计分析

- 按角色展示地址与挂靠相关统计（业务员仅本人挂靠数据）。

### 用户管理（仅管理员）

- 修改管理员密码；增删改业务员账号（用户名、显示名、密码）。

---

## 环境要求

- **Node.js ≥ 22.5**（服务端使用内置 `node:sqlite`，见 `server/package.json` 的 `engines`）。
- **地址协议导出 PDF（推荐）**：安装 [LibreOffice](https://www.libreoffice.org/)，确保命令行可调用 `soffice`（Windows 可设置环境变量 `LIBREOFFICE_PATH` 指向 `soffice.exe`）。未安装时审核通过后仍会生成 **DOCX**，可下载后自行转 PDF。

---

## 快速开始（本地开发）

在项目根目录：

```bash
npm install
npm run dev
```

会并行启动：

- **前端**：<http://localhost:5173/>（Vite）
- **API**：默认 <http://localhost:3889/>（Express）

浏览器访问前端；`/api` 由 Vite **代理**到后端。

### 演示账号（开发环境）

| 角色   | 用户名 | 密码       |
|--------|--------|------------|
| 管理员 | `admin` | `admin123` |
| 业务员 | `sales` | `sales123` |

**生产环境请务必：** 修改全部默认密码，并设置强随机 **`SESSION_SECRET`**。

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前后端开发模式 |
| `npm run build` | 依次构建 `server`（`tsc`）与 `client`（`tsc -b` + `vite build`） |
| `npm run start` | 启动已构建的后端（`server/dist/index.js`） |
| `npm run dev -w client` / `npm run dev -w server` | 单独启动某一端 |

预览前端构建产物时，须另开终端启动 API，例如：

```bash
npm run start -w server
cd client && npm run preview
```

`client/vite.config.ts` 中 `preview` 与 `dev` 使用相同的 `/api` 代理端口配置。

---

## 客户管理与 OA 同步

1. 在服务器环境变量中配置 `OA_API_KEY`（见 `.env.example`）。
2. 管理员在 **用户管理** 为业务员填写 **OA 成员 ID**（简道云成员 `_id`，与 OA「销售负责人」一致）。
3. 在 **客户管理** 点击 **从 OA 同步**（仅同步 OA「销售负责人」为本人 `oa_member_id` 的客户；电话取自对接人子表单或历史主表字段）。
4. 在 **挂靠流程** 新建/编辑申请时，使用 **从客户档案带出** 选择客户，自动填入联络人文字信息（证件照仍需上传）。

字段映射：客户名称 → 渠道公司名 / 直客法人姓名；对接人子表单第 1 行 → 常用联系人或法人电话，第 2 行 → 备用/企业备用。

同步规则：须有有效电话（**子表单第 1 行** 或 **历史主表联系方式**）。无电话、非直客/渠道类型会跳过。遇 **4004 限流** 会自动重试；请勿连续点击同步。

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` / `API_PORT` | API 监听端口，默认 **3889**；修改后须与 Vite 代理端口一致 |
| `SESSION_SECRET` | 会话签名密钥，**生产必填** |
| `LIBREOFFICE_PATH` | （可选）LibreOffice `soffice` 可执行文件完整路径，用于协议 DOCX→PDF |
| `OA_API_KEY` | OA 开放平台密钥，用于「客户管理 → 从 OA 同步」 |
| `OA_API_BASE_URL` | （可选）默认 `https://wx.hnzhcyy.cn` |
| `OA_PAGE_DELAY_MS` | （可选）分页请求间隔，默认 **600** |
| `OA_RATE_LIMIT_RETRY_MS` | （可选）遇 4004 后重试前等待，默认 **2500** |
| `CLIENT_ORIGIN` | （可选）CORS 允许来源 |
| `TRUST_PROXY` | 设为 `1` 时信任反向代理（影响 Cookie `secure` 等） |
| `COOKIE_SECURE` | 设为 `1` 时 Cookie 仅 HTTPS |

PowerShell 示例（改用 3890 端口）：

```powershell
$env:PORT='3890'; $env:API_PORT='3890'; npm run dev
```

---

## 数据与文件存储

| 路径 | 说明 |
|------|------|
| `server/data/addresses.db` | SQLite 数据库（首次运行自动建表与迁移；含演示种子数据） |
| `server/data/uploads/` | 证件图、执照图等上传文件 |
| `server/data/agreement-template/template.docx` | 管理员上传的协议 Word 模板 |
| `server/data/uploads/agreements/generated/` | 系统生成的协议（`.pdf` 或 `.docx`） |
| `server/data/uploads/agreements/signed/` | 业务员回传的盖章协议（按 `{挂靠ID}{扩展名}` 存储） |

上传的证件图通过登录会话访问：`GET /api/uploads/:filename`。

协议相关 API（均需登录）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agreement-template/placeholders` | 占位符说明与示例 |
| GET/POST | `/api/agreement-template` | 查询/上传模板（POST 仅管理员） |
| POST | `/api/affiliations/:id/agreement/submit` | 业务员提交协议申请 |
| PATCH | `/api/affiliations/:id/agreement/review` | 管理员通过/驳回并生成协议 |
| GET | `/api/affiliations/:id/agreement/generated` | 下载生成的协议 |
| POST | `/api/affiliations/:id/agreement/signed` | 回传盖章协议（multipart `file`） |
| GET | `/api/affiliations/:id/agreement/signed` | 下载已回传文件 |

---

## 权限摘要

| 能力 | 管理员 | 业务员 |
|------|--------|--------|
| 地址库 CRUD、批量导入 | ✓ | — |
| 协议模板配置 | ✓ | — |
| 用户管理 | ✓ | — |
| 挂靠列表 | 全部 | 仅本人创建 |
| 挂靠审批通过/驳回 | ✓ | — |
| 挂靠任意状态修改资料 | ✓ | 草稿、已驳回 |
| 删除挂靠申请 | ✓ | — |
| 创建/编辑/提交自己的挂靠 | ✓ | ✓ |
| 地址协议申请、下载、回传 | ✓ | ✓（本人记录） |
| 地址协议审核、生成协议文件 | ✓ | — |

---

## 协议模板占位符（Word 内写法 `{key}`）

| 占位符 | 含义 |
|--------|------|
| `enterprise_name` | 企业名称（协议表单） |
| `amount` / `amount_cn` | 金额 / 金额大写 |
| `service_start` / `service_end` | 服务起止日期 |
| `legal_name` / `legal_phone` / `legal_contact_address` / `legal_email` | 法人信息（来自挂靠材料） |
| `applicant_name` / `group_name` | 申请人 / 群名称 |
| `address_type_label` / `address_region` / `detail_address` | 地址类型、区域、详细地址 |
| `service_type` | 服务类型（库内字段） |
| `today` | 生成当日日期 |
| `agreement_no` | 协议编号（申请 ID 简写） |

完整列表与示例值见管理端 **协议模板** 页面。

---

## 故障排查

### 端口被占用（EADDRINUSE）

关闭占用端口的旧 `node`/`tsx` 进程，或修改 `PORT`/`API_PORT` 并保持与 Vite 代理一致。

### 协议生成失败或只有 DOCX

1. 确认管理员已在 **协议模板** 上传 `.docx`。  
2. 确认服务器已安装 LibreOffice 且 `soffice` 可用，或配置 `LIBREOFFICE_PATH`。  
3. 模板占位符须与上表一致（docxtemplater 语法 `{key}`）。

### 列表企业名称为空

企业名称在业务员提交**地址协议**后才有值（字段 `agreement_enterprise_name`）；仅完成地址挂靠、未申请协议时显示「—」。

### 数据库升级

启动时 `server/src/db.ts` 会对 `affiliation_requests` 等表执行 `ALTER TABLE` 迁移。生产升级前请**备份** `addresses.db`。

### 登录接口 404

确认后端已启动且终端出现 API listening；检查 Vite 代理端口是否与 API 一致。

---

## 目录结构（简）

```
client/src/
  pages/                        # 业务页面
    AffiliationsPage.tsx        # 挂靠流程列表与表单
    AffiliationAgreementActions.tsx  # 协议申请/审核/回传
    AgreementTemplatePage.tsx   # 协议模板（管理员）
    AddressesPage.tsx           # 地址库
    UsersPage.tsx               # 用户管理
  api.ts                        # 前端 API 封装
  types.ts                      # 共享类型
server/src/
  index.ts                      # Express 入口、REST、会话
  db.ts                         # SQLite 初始化与迁移
  affiliationAddress.ts         # 地址分配、占用查询
  affiliationMaterial.ts        # 材料校验
  agreement/                    # 协议模板、生成、上传
    constants.ts                # 占位符与状态定义
    generate.ts                 # docxtemplater + LibreOffice 转 PDF
    routes.ts                   # 协议相关 API
    upload.ts                   # Multer 配置
  idPhotoUpload.ts
```

更细的需求与备忘见仓库内 `开发计划`、`更新计划`（纯文本备忘，非构建产物）。
