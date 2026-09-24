# HachiCats · 第一届八猫杯

手机优先的赛事网站。正式部署使用 Vercel（Next.js / Node.js 24）与 MongoDB Atlas 持久化，OurTaiko SSO 保持原服务。本地 Node / SQLite 和 Vinext / D1 demo 仍可运行。

## 现在查看

启动后访问 **http://127.0.0.1:5188/**。请统一使用 `127.0.0.1`，避免与 `localhost` 混用导致 Cookie、Origin 或 SSO 回调不匹配。

- 观众：三组曲库、对阵与比赛详情，无需登录；每 3 秒向后端同步。
- 管理：右上角「主办方入口」→「体验演示管理模式」→ 点击一场比赛。
- 演示管理只在 `DEMO_MODE=true` 且本站地址为 loopback 时开放。它与正式 SSO 管理员身份分离。
- 初始展示的两场已结束、两场进行中及其比分均为演示数据。选手与分组来自赛事资料；本地演示曲库为独立样例，与正式赛事无关。
- 验证过程中演示赛况会继续推进；不会修改原始赛事资料。

## 启动

需要 Node 22.13+。当前机器已安装依赖、初始化数据库，并配置本地 SSO 应用。

```sh
npm ci
npm run dev
```

本地 SSO 位于 `http://127.0.0.1:8090`，使用相邻 OurTaikoSSO 项目的开发数据库。演示管理无需 SSO 服务正常运行。

新机器初始化时，复制 `.env.example` 为 `.dev.vars` 并填写本机配置，然后：

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_panoramic_old_lace.sql
npm run dev
```

这条初始 SQL 只对**全新的数据库**执行一次。已有数据库不要重复执行。数据库位于 `.wrangler/state/v3/d1/`，页面刷新与服务重启均保留数据。`.dev.vars`、`.wrangler/`、`.data/` 均被忽略，不应提交凭证、会话或数据库。

## 已实现

- 暹罗、狸花、布偶三组，各 16 名选手与 12 首正赛课题曲。
- 选手姓名、对阵序号与报名 rating v2 统一维护在 `data/players.json`，对阵卡片、实时比赛和比赛详情显示 RT。
- 16 进 8、8 进 4 的比赛详情为 rating 低于对手至少 0.50 的选手显示「先攻」标记；待定席位与轮空不标记。
- 单败淘汰，半决赛败者进入季军赛；决赛、季军赛增加现场指定曲。
- 手机按轮次看对阵，桌面完整四轮对阵；A / B 台同时进行时同时高亮。
- 管理员下拉选择双方各两首曲目、各 Ban 对手一首；保存选曲。
- 草稿与未公布的指定曲只从鉴权后的管理接口返回，不进入公开 JSON / 客户端 bundle。
- 开始比赛才公开曲目；逐曲手填数字成绩、实时总分、保存比分、确认赛果。
- 重复选曲随机补足；平分不能确认赛果，可抽取加赛曲。选择阶段会禁用该选手此前自己选择且已游玩的曲目。
- 缺席 / 轮空直接晋级；未结束的上游比赛不能被下游轮空跳过。
- 赛果由服务端计算，自动推进对阵；确认结果后锁定。
- 服务端版本号 + 原子条件更新，拒绝并发覆盖；同一机台不能同时开两场。
- 公开 API 与管理 API 分离，HttpOnly 会话、写请求 Origin 校验、服务端权限检查。

## OurTaiko SSO

本地已登记 OAuth 应用名 **HachiCats**，客户端 `hachicats-local`，回调：

`http://127.0.0.1:5188/api/auth/callback`

密钥仅存本地 `.dev.vars`，未写入源码或前端。使用 `openid-client` 实现 Authorization Code + S256 PKCE、浏览器绑定的 state、nonce、RS256 签名 / issuer / audience / 有效期校验和 UserInfo subject 一致性检查。

正式管理员通过 `ADMIN_USERNAMES` 配置，当前为 `kirisamevanilla,grace0512,Touka16`。填写逗号分隔、大小写准确的 SSO 登录用户名，不按昵称判定。首次验证登录身份时将用户名绑定到稳定的 `(issuer, sub)`，绑定不会被同名的新账号覆盖。每次操作都检查当前管理员名单；移除名字即撤销权限。兼容旧的 `ADMIN_USERNAME` 单用户配置，但新配置优先，明确设置为空则禁用全部管理员。SSO 本机开发库没有用户的正式账号，不能把生产账号密码误认为本地账号凭证。

每次受保护操作重新调用 UserInfo；上游 token 撤销后本站拒绝操作。登录会话不超过 access token 有效期；退出会清理本地会话并尝试撤销上游 token。

正式 SSO 已登记 HachiCats，回调为 `https://hachicats.ourtaiko.org/api/auth/callback`。客户端凭证保存在 Vercel 的生产环境变量中，不进入 GitHub 或前端。旧服务器的 `.env.production` 仅用于回滚备份。正式环境 `DEMO_MODE=false`。

`DEMO_MODE=false` 使用独立的 `edition-1` 数据记录，初始比赛全部待开始，不复用演示赛果。

## 验证

```sh
npm test
npm run test:api     # 需要本地 demo 正在运行
npm run typecheck
npm run build
```

覆盖正常计分晋级、平分与缺失成绩、轮空、季军赛、指定曲、重复选曲限制、并行机台、草稿隐藏、未登录 / 非管理员权限、跨来源请求和过期版本号。另用可自动清理的 SSO 本地临时账号走通真实授权、回调、身份查询、非管理员写入拒绝和撤销登录流程。

## 关键代码

- `app/page.tsx` / `app/globals.css`：观众界面、分组曲库、手机布局。
- `components/match-editor.tsx`：管理操作与录分。
- `lib/tournament.ts`：赛事资料、类型与对阵推进。
- `data/players.json` / `lib/players.ts`：选手资料及稳定 ID 查询。
- MongoDB `song_libraries`：正式曲库和指定曲配置，真实配置不进入 Git。
- `lib/song-library.server.ts` / `lib/song-catalog.server.ts`：读取曲库、关联曲名与星级、按公布状态过滤。
- `lib/rules.ts`：服务端赛制校验。
- `lib/auth.ts`：SSO 和本地演示会话。
- `lib/store.ts` / `db/schema.ts` / `drizzle/`：持久化与版本更新。

## 本轮 demo 的边界

已确认赛果暂不支持撤销 / 改判；现场替补、审计日志留待下一轮确认需求。正式域名为 https://hachicats.ourtaiko.org；手机适配已在 390px 视口检查。

## 选手资料

`data/players.json` 按组保存 `id`、`name`、`seed`、`rating`。资料来自 `报名表.numbers`：“名单”页 A2:B49 提供姓名和 rating v2，三组对阵页提供出场顺序。“社畜桑”采用主办方确认的对阵页名称，对应名单页“社畜”的 11.06。数字昵称 97 保存为字符串；rating 保存为数字，界面统一显示两位小数。

修改姓名或 rating 后重新部署即可更新所有轮次。不要修改既有选手的 `id`，也不要为了 rating 排名重排对阵。赛事数据库仅保存选手 ID 和对阵序号；读取时关联 JSON 资料，兼容历史记录中保存的旧姓名，无需重置比分或晋级结果。待定席位不显示虚构 rating。

## 曲目信息

正式曲库存于 MongoDB `song_libraries` 集合，文档 `_id=edition-1`、`version=1`。`pools` 按 `siamese` / `tabby` / `ragdoll` 分组，每组 12 个 `{ id, songID, difficultyIndex }`；`designated` 按组保存 `final` / `third` 的 `{ songID, difficultyIndex }`。难度索引 1–5 对应简单、普通、困难、魔王、里谱面，无需额外里谱面标记。

`siamese-1` 等 `id` 是选曲及成绩的稳定引用，不能重排或改名。曲名、星级不存入赛事配置，仍从 OurTaiko 接口关联。MongoDB 中修改配置后，下一次接口读取即可生效，无需重新部署；已开赛的曲目映射不能随意修改，否则旧成绩会显示为另一首曲目。正式库缺失或配置无效时接口返回错误，不会使用样例曲库兜底。

迁移工具只导入缺失的配置，遇到不同的现有内容会拒绝覆盖。真实输入文件必须置于被忽略的 `.data/` 等私有目录，文件权限设为 600，不要加入测试、Git 或部署文件：

```sh
node --env-file=<私有MongoDB配置> scripts/import-song-library.mjs <私有曲库.json> --apply
node --env-file=<私有MongoDB配置> scripts/import-song-library.mjs <私有曲库.json> --verify
```

本地 `DEMO_MODE=true` 会在自己的 `demo` 曲库文档 / SQLite 表中初始化 `lib/demo-song-library.ts` 的公开样例，既不读取正式指定曲，也不会覆盖已有配置。重置赛事仅清理比赛进度，保留数据库曲库。

`/api/songs` 在运行时从 `https://cdn.ourtaiko.org/api/cnsongs` 获取 `song_name` 和 `level_${difficultyIndex}`。页面每 30 秒自动刷新，打开比赛时也会刷新；服务端共用 30 秒内存缓存并合并同时发生的请求。上游失败时保留最近成功的数据并显示提示；首次失败或缺少谱面时显示歌曲 ID / 未知星级，不编造难度。Angel Dream 使用主办方确认的原版 ID 433。

指定曲使用独立的稳定引用（例如 `special:siamese:final`）。读取历史赛况时兼容原有 `special:曲名`，保留所有成绩和晋级信息。指定曲的 API ID、曲名和星级只在受保护的管理接口或该场比赛公布后返回；服务端校验固定曲目引用，接口离线仍可保存已有选曲与比分。

## 历史服务器部署（已停用）

HachiCats 已从 1Panel / Docker / SQLite 迁移至下述 Vercel + Atlas 方案。旧服务器上的 HachiCats 服务已清理，不再使用原来的 SSH / Docker 更新方式。`Dockerfile` 和 SQLite 适配器仅供其他自托管环境参考。

管理员在 Vercel 生产环境变量 `ADMIN_USERNAMES` 中配置，当前为 `kirisamevanilla,grace0512,Touka16`。SSO Application 的所有者或工作人员标记不决定本站权限。

真实指定曲曾被提交到私有仓库。当前版本移除了这些数据，但旧 Git 历史、克隆和历史部署仍可能包含旧配置，不能因本次迁移就公开历史仓库。若需防范已能读取旧源码的人，应由主办方更换未提交过的新指定曲；本次迁移保持原有选曲。

## Vercel + MongoDB Atlas

Vercel 项目 `vanillaaaa/hachicats` 连接 GitHub 主分支，使用 `vercel.json` 中的 `npm run build:server` 构建。后端区域 `hnd1` 对应 Atlas 东京集群。前端和 API 在同一项目部署。

生产环境配置：

- `MONGODB_URI`：专用 `hachicats_app` 用户的连接字符串，保存为 Secret。
- `MONGODB_DB=hachicats`，该用户只允许读写此库。
- `APP_ORIGIN=https://hachicats.ourtaiko.org`、`DEMO_MODE=false`。
- `SSO_ISSUER=https://sso.ourtaiko.org`、既有 `SSO_CLIENT_ID`、`SSO_CLIENT_SECRET`（Secret）。
- `ADMIN_USERNAMES=kirisamevanilla,grace0512,Touka16`。

不要把生产数据库或 SSO 密钥复制到 Preview 环境。Vercel 缺少 MongoDB 配置时会拒绝提供服务，不会回退到临时 SQLite。正式 MongoDB 缺少赛事记录时也不会自动生成空赛况，必须先迁移已有数据。

MongoDB 的 `tournaments`、`admins`、`sessions` 分别保存赛况、不可重新绑定的管理员身份及有期限的会话。并发录分通过 revision 原子比较更新，避免多位工作人员互相覆盖。会话读取始终校验有效期，`sessions_expiry` TTL 索引负责清理。每个后端实例复用最多 5 条连接。

迁移工具（包含登录凭证的备份必须放在私有、被 Git 忽略的目录中）：

```sh
node scripts/export-sqlite.mjs <旧数据库文件> <私有快照.json>
node --env-file=<私有MongoDB配置> scripts/import-mongodb.mjs <私有快照.json> --apply
node --env-file=<私有MongoDB配置> scripts/import-mongodb.mjs <私有快照.json> --verify
node --env-file=<私有MongoDB配置> tests/mongodb.test.mjs
```

导出使用一致性读事务；导入先校验所有记录，拒绝覆盖冲突记录。导入时暂停旧站点写入，验证后再切换流量，防止两个数据库出现不同赛况。保留原始快照和旧 SQLite 卷作为回滚备份；上线后的新成绩必须另外导出，不能直接回滚到旧数据。集成测试只清理自己创建的唯一命名记录。

Atlas 网络访问当前使用经授权的 `0.0.0.0/0` 规则，适配 Hobby 动态出口；连接仍需 TLS 与专用账号密码。SSO 服务、OAuth 应用和回调地址无需因本次托管迁移而改变。

## 重置第一届赛事

管理员登录后，在「主办方入口 → 主办方工作台 → 第一届赛事维护」点击「重置第一届赛事」，输入 `重置第一届八猫杯`，再点击「备份并重置赛事」。此操作清空三个组全部 48 场的选曲、Ban、比分、轮空、胜者和晋级状态，恢复 JSON 中的首轮对阵；选手、rating、曲库、登录会话、管理员名单均保留。

重置前的完整赛况会写入 MongoDB `tournament_backups`（本地 SQLite/D1 使用同名表），包含原始 body、版本、时间和操作用户名；备份不通过公开接口提供，不自动过期。备份失败则不重置。重置使用 revision 条件更新且版本只递增，另一管理员刚刚录分或重复提交都会被拒绝。竞态失败时可能保留一条未用于重置的快照，这是为了始终先保存原始数据。

恢复备份需维护人员操作，后台没有直接撤销按钮。恢复时也应备份当前赛况并继续递增 revision，不能把旧版本号写回。演示模式的入口明确标为「重置演示赛事」，只重置 `demo`；正式入口固定操作 `edition-1`。

验证：`npm run test:reset` 使用临时 SQLite，覆盖重置范围、认证、来源/请求格式、备份失败、并发录分及过期窗口保护。部署该功能本身不会重置任何比赛。
