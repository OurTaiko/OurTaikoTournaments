# OurTaikoTournaments 维护入口

修改本项目之前，先阅读 [README.md](README.md) 和 [docs/MAINTENANCE.md](docs/MAINTENANCE.md)。维护手册记录架构、数据归属、部署、验证和恢复流程；发生代码与文档不一致时，检查当前实现及实际环境，再更新文档。

## 新手速览

OurTaiko 社区的太鼓赛事网站：Next.js 16（App Router，webpack 构建）+ React 19 + TypeScript，部署在 Vercel，数据在 MongoDB Atlas，登录走 OurTaiko SSO。界面文案、文档、提交说明的正文以中文为主。

### 项目地图

| 路由 / 目录 | 内容 | 是否碰数据库 |
| --- | --- | --- |
| `/` → `app/page.tsx` | 赛事目录，卡片来自 `lib/tournaments.ts` | 否（账号状态除外） |
| `/hachicats/20260927` | 第一届八猫杯**已结束**，静态赛果存档，读 `data/archive/hachicats-20260927.json` | 否 |
| `/hachicats/20260927/gallery`、`/gallery` | 赛事相册（维护手册第 15 节） | 否 |
| `/centurylink/20261227` | 第二届世纪汇单店赛，实时双败赛事，有管理功能（第 14 节） | 是 |
| `/login`、`app/api/**` | SSO 登录与赛事接口；处理器在 `lib/tournament-api/` | 是 |
| `lib/` | 规则、存储、鉴权等核心逻辑；`*.server.ts` 只能在服务端使用 | — |
| `components/` | 页面组件；`components/ui/` 为 shadcn 风格基础组件（Radix） | — |
| `data/` | 存档、相册清单、首次初始化名册；**不是**正式赛事数据源 | — |
| `scripts/` | 一次性迁移 / 存档 / 初始化工具，运行前先读脚本头部注释和维护手册 | 视脚本而定 |
| `tests/*.test.mjs` | 纯 Node 测试（无测试框架），`npm test` 串行执行 | 默认用临时 SQLite |

样式全部使用 Tailwind CSS v4 工具类，直接写在组件的 `className` 上；不要新增手写的 CSS 类或样式文件。`app/globals.css` 只保留主题变量（颜色、相册深色 `g-*` 色板、动画）、`mobile:`（≤760px）/ `phone:`（≤640px）两个自定义断点变体、`@utility` 自定义工具类和 `@layer base` 元素基础样式；基础样式放在 `@layer base` 中，未分层的 CSS 会压过所有工具类。多个页面共用的类组合放在 `components/styles.ts`（如顶栏、按钮、比赛卡片、编辑器），组合或覆盖类时用 `cn()`（tailwind-merge），不要拼接字符串。注意 tailwind-merge 会在后出现的字号类之后丢弃前面的 `leading-*`，需要时在最后重写行高。

### 常见任务怎么做

- **改页面 / 样式：** 在本地启动隔离演示服务（命令见 README「本地开发」，务必清空 `MONGODB_URI`），桌面和 375–390px 手机视口各看一遍，确认无横向滚动和控制台错误。
- **添加相册照片：** 照片放进 `public/<系列>/<届次>/`，在 `data/gallery/<赛事 ID>.json` 写 `file` / `alt` / `caption` 并放进章节，然后运行 `node scripts/gallery-metadata.mjs data/gallery/<赛事 ID>.json` 生成尺寸和模糊占位，最后 `node tests/gallery.test.mjs`。不要在 `lib/gallery.ts` 里逐个导入照片；不要手改 `width` / `height` / `blurDataURL`。
- **添加新赛事：** 按 README「新赛事接入」：目录条目、独立页面、服务端作用域与权限策略缺一不可，仅加卡片不会启用后端。
- **赛事结束后存档：** 只用 `scripts/archive-tournament.mjs` 从公开接口生成，不要手写存档 JSON。
- **改规则 / 存储 / 权限：** 先读维护手册对应章节，按第 6 节验证矩阵选测试；不要用正式赛事录分或重置来验证。

### 新手容易踩的坑

- 只用 **npm**（`package-lock.json`）。不要生成或提交 `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`yarn.lock`。
- `public/` 下的所有文件都会被网站公开下载。工作区里可能有用户放的私人资料（如报名表 `.xlsx`、方案 `.docx`），不要 `git add -A` / `git add .`，按路径逐个添加。
- `DEMO_MODE=true` 不等于隔离：只要 `MONGODB_URI` 非空就会连 Atlas 正式库。
- 八猫杯页面是存档，不要为它恢复轮询、管理 tab 或数据库读取。
- 新增或修改 `npm test` 中的测试时，把新测试文件加进 `package.json` 的 `test` 脚本。

## 必须保留的约定

- 生产托管是 Vercel + MongoDB Atlas。OurTaiko SSO 保持原服务。除非用户明确要求变更托管方案，不要重新安装或恢复 HachiCats 的 Docker / 1Panel 服务，不要清理其他服务的容器或数据。
- 正式赛事键为 `hachicats-20260927`（演示 `demo`）和 `centurylink-20261227`（演示 `demo-centurylink`，赛制见维护手册第 14 节）。本地验证使用独立 SQLite 或隔离的测试库。`DEMO_MODE=true` 本身不代表数据库隔离：非空 `MONGODB_URI` 仍会连接 Atlas。
- 用户要求修改功能或部署，不等于要求重置正式赛事。发布前后保留并核对现有比分、选曲、胜者、晋级和 revision。
- Atlas 赛事为 schemaVersion 3：元信息在 `tournaments`，选手及 rating 在 `tournament_participants`，比赛及比分在 `matches`，`data/players.json` 仅用于首次迁移 / 本地初始化；正式曲库在数据库 `song_libraries`。不要把未公布的指定曲写进源码、文档、测试、种子、日志、提交说明或前端构建产物。已结束赛事的静态存档（`data/archive/`）只能由 `scripts/archive-tournament.mjs` 从公开接口生成，仅含已公布数据，`tests/archive.test.mjs` 负责校验。
- 未公布的指定曲只通过鉴权后的比赛详情接口返回；公开曲库须按该场比赛的公布状态过滤。保留 `server-only` 边界和前端依赖图测试。旧 Git 历史曾含真实配置，不要据此迁移就把仓库改为公开。
- 管理员权限来自 SSO 的 HachiCats Application → Client roles。每次管理请求通过内部 web/introspect 验证本应用 token 与稳定用户 ID，读取 isAdmin；不信任旧 ADMIN_USERNAMES、Atlas admins 或前端状态。SSO 失败必须拒绝管理操作。
- 写入比赛须校验 Origin、管理员和 revision。Atlas 跨集合读取使用 snapshot 事务，写入通过整届 revision CAS 与事务同步提交，不能绕过 repository 单独改比分 / 晋级。重置 / 恢复须先备份，再按当前 revision 条件更新；版本只递增。不要删除生产赛事文档来“重新初始化”。
- 保持选手 ID、曲目内部 ID 与比赛 ID 稳定。已录分曲目的 `songID` / `difficultyIndex` 映射不能因整理数据被改写。
- 凭证及原始备份仅保存在被忽略的私有目录或对应平台的 Secret 中。不要输出 `.env`、会话 token、完整私有数据库文档。
- 相册照片只发布主办方同意公开的内容；照片清单在 `data/gallery/`，由 `tests/gallery.test.mjs` 校验与照片文件夹一致。

## 工作与交付

- 从 `git status` 开始，保留用户未提交的修改。根据维护手册选择与改动相关的测试，不因纯文档修改启动服务器或改写数据库。
- UI 修改检查手机尺寸；存储或权限修改检查未登录访问、公开数据过滤和失败行为。测试不得使用真实赛事重置或录分来验证。
- `npm run build` 是唯一的 Next.js 构建（Vercel 同样使用）。Vinext / Cloudflare / D1 路线已移除，不要恢复。
- 用户要求提交时：在功能分支（如 `feat/<主题>`、`fix/<主题>`）上提交，使用 Conventional Commits（`feat(scope): ...`、`fix: ...`、`refactor(scope): ...`、`docs: ...`），再向 `main` 开 PR。不要直接推 `main`，除非用户明确要求。
- PR 会触发 Vercel Preview 检查；该仓库不允许 GitHub auto-merge，需在检查通过后由用户确认再合并。合并进 `main` 即触发生产部署：查看 Ready 状态和生产域名，不重复发起 CLI 部署。纯文档不额外发起手动部署；推送可能仍触发既有 Git 自动构建，不要假定提交信息能跳过它。
- 新增或改变功能后，同步维护手册的当前行为、操作方式和验证步骤。建议、未实现功能与已上线功能必须明确区分。
- 完成后说明实际改动、验证结果、是否上线，以及仍存在的限制。不要声称本地报告、备份或凭证会随 Git 自动同步到其他机器。
