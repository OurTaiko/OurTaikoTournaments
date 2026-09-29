# OurTaiko Tournaments

太鼓赛事平台：`/` 为赛事目录，第一届八猫杯位于 `/hachicats/20260927`，`/login` 为共享账号入口。八猫杯支持管理员编辑选手资料、首轮换人及替补管理，以及三组单败淘汰、两台并行比赛、选曲与 Ban、手动录分、自动晋级、轮空及管理员重置。

- 正式网站：[tournaments.ourtaiko.org](https://tournaments.ourtaiko.org)
- 生产：Next.js / Vercel + MongoDB Atlas，登录使用既有 OurTaiko SSO。
- 维护入口：[维护手册](docs/MAINTENANCE.md)；Codex / 其他代码助手先读 [AGENTS.md](AGENTS.md)。

## 数据和代码在哪里

| 内容 | 位置 |
| --- | --- |
| 页面、对阵图、管理表单 | `app/page.tsx`（目录）、`app/hachicats/20260927/page.tsx`（八猫杯）、`components/` |
| 后端 HTTP 接口 | `app/api/tournaments/[series]/[edition]/**/route.ts`、`lib/tournament-api/` |
| 赛事 ID 与后端作用域 | `lib/tournament-scope.ts`（八猫杯 → `hachicats-20260927` / `demo`） |
| 比赛规则、晋级与持久化 | `lib/rules.ts`、`lib/tournament.ts`、`lib/store.ts` |
| 选手姓名、初始出场序号、rating | MongoDB `tournament_participants`，按 `tournamentId` 关联 |
| 正式曲库与指定曲 | MongoDB `song_libraries`，文档 `hachicats-20260927` |
| 正式比分与比赛进度 | MongoDB `matches`，按 `tournamentId` 关联 |
| 管理员权限 | OurTaiko SSO → Client roles → HachiCats → Is admin |
| 登录会话、重置备份 | MongoDB `sessions`、`tournament_backups`；旧 `admins` 仅留存回退 |

曲名与星级从 OurTaiko 曲目接口获取。未公布的指定曲不进入公开 API 或浏览器代码；真实配置不要提交进 Git。旧 Git 历史曾保存过指定曲，当前移除不代表历史已清除。

## 本地开发

推荐 Node.js 24；项目最低要求 Node.js 22.13。以下命令从本仓库根目录执行，使用独立 SQLite 演示库，不需要生产数据库或 SSO 凭证：

```sh
npm ci
MONGODB_URI='' MONGODB_DB='' VERCEL='' DEMO_MODE=true \
  APP_ORIGIN=http://127.0.0.1:5192 DATABASE_PATH=.data/local-demo.sqlite \
  node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 5192
```

访问 `http://127.0.0.1:5192`，从赛事目录进入八猫杯，再点击「登录 → 体验演示管理模式」。本地库首次自动初始化，曲库为独立样例。`127.0.0.1` 与 `localhost` 不要混用。

原有 `npm run dev` 使用 Vinext 路线，默认端口 5188，配置与 D1 初始化见维护手册；它与上面的 Next.js / SQLite 环境不是同一个数据库。

## 常用验证

```sh
npm test
npm run test:admins
npm run test:storage
npm run test:reset
npm run typecheck
npm run build:server
```

本地演示服务运行时，另外执行：

```sh
TEST_ORIGIN=http://127.0.0.1:5192 npm run test:api
```

按改动范围选择验证；纯文档修改只核对事实、路径、链接与命令，不需要运行应用测试。Atlas 集成测试的使用条件见维护手册。

## 生产更新

GitHub `OurTaiko/OurTaikoTournaments` 的 `main` 分支连接 Vercel 项目 `vanillaaaa/tournaments`。推送后自动构建 `npm run build:server`，前端与后端一起部署。需确认部署 Ready、正式域名对应新版本，再验证公开页面与相关接口。

管理员设置、曲库维护、重置 / 恢复、备份、故障定位和历史迁移工具，都以 [维护手册](docs/MAINTENANCE.md) 为准。

## 新赛事接入

在 `lib/tournaments.ts` 添加公开目录条目，并为赛事建立独立页面。根布局已经挂载 `SsoProvider`；客户端通过 `useSSO()`（`components/auth/sso-context.tsx`）读取 `user/loading/error/busy/demoAllowed`，调用 `login(returnTo)`、`logout()`、`loginDemo()` 和 `refresh()`。账号入口使用 `loginHref(returnTo)`，SSO 成功或失败会保留安全的站内返回路径。

共享登录身份不等于共享赛事管理权限。前端通过 `useTournamentAccess(tournamentId)` 获取赛事权限；服务端每次管理请求调用 `requireTournamentAdmin`。八猫杯显式沿用旧 SSO 客户端角色；可以将客户端显示名改为 OurTaikoTournament，ID、Secret 和 callback 无需改变。其他赛事不得自动继承该角色。

八猫杯公共 ID 为 `hachicats-20260927`，新 API 前缀为 `/api/tournaments/hachicats/20260927`，后缀有 `/matches/[id]`、`/players`、`/songs`、`/reset`、`/access`。`lib/tournament-scope.ts` 使用 `hachicats-20260927` 数据和曲库（演示为 `demo`），不会复制、重置或重写赛事。旧 `/api/tournament`、`/api/matches`、`/api/players` 和 `/api/songs` 保留为八猫杯兼容入口，共用同一组处理器和 revision 校验。

添加下一场赛事需要在服务端注册独立数据键、规则格式和明确权限策略，并显式准备其名册和曲库；仅添加目录卡片不会启用后端。未注册 ID（包括旧存储键 `edition-1` / `demo`）一律返回 404，不会初始化数据。当前迁移只接入八猫杯规则，尚无通用建赛后台、成员角色数据库或其他赛制。

## MongoDB 数据库配置

目标为 OurTaiko Atlas 集群中的 `tournaments` 数据库。后端 `lib/mongodb.ts` 使用服务端环境变量 `MONGODB_DB=tournaments` 选择数据库，`MONGODB_URI` 继续指向原集群。Vercel Production 环境也需要设置此值并重新部署；本地 `.env.local` 不会同步至 Vercel。

集合仍为 `tournaments`、`song_libraries`、`sessions`、`tournament_backups`，第一届八猫杯文档键改为 `hachicats-20260927`。本次配置修改不搬迁数据；目标库应已包含原有集合和记录，连接账号需具有目标库读写权限。

赛事 ID 统一由 `tournamentId(seriesSlug, edition)` 生成：`/系列/YYYYMMDD` → `系列-YYYYMMDD`。已有 `edition-1` 需要执行 `scripts/migrate-tournament-id.mjs` 的事务迁移，详见维护手册；发布代码不会自动搬迁数据。

## Atlas 原生结构（schemaVersion 3）

赛事元信息保存在 `tournaments`，名册在 `tournament_participants`，比赛、比分、选曲及 Ban 在 `matches`。正式赛事记录不再存放 JSON 字符串 `body`。读写由 `lib/mongo-tournaments.ts` 维护快照一致性、整届版本 CAS 和多文档事务；私有曲库仍独立保存。SQLite / D1 和现有规则使用的字符串 DTO 只保留在适配层，不再是 Atlas 的赛事存储格式。

迁移直接从旧 body 到最终分集合结构，无中间原生单文档阶段。操作和恢复约定见维护手册第 13 节；此前规划中的两步发布路线已由本次用户要求取代。
