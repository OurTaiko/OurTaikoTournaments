# HachiCats · 第一届八猫杯

手机优先的赛事网站。正式部署使用 Next.js / Node.js 24、SQLite 持久化与 OurTaiko SSO；本地 Vinext / D1 demo 仍可运行。

## 现在查看

启动后访问 **http://127.0.0.1:5188/**。请统一使用 `127.0.0.1`，避免与 `localhost` 混用导致 Cookie、Origin 或 SSO 回调不匹配。

- 观众：三组曲库、对阵与比赛详情，无需登录；每 3 秒向后端同步。
- 管理：右上角「主办方入口」→「体验演示管理模式」→ 点击一场比赛。
- 演示管理只在 `DEMO_MODE=true` 且本站地址为 loopback 时开放。它与正式 SSO 管理员身份分离。
- 初始展示的两场已结束、两场进行中及其比分均为演示数据。真实选手、分组、曲库来自上级目录资料。
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
- 单败淘汰，半决赛败者进入季军赛；决赛、季军赛增加现场指定曲。
- 手机按轮次看对阵，桌面完整四轮对阵；A / B 台同时进行时同时高亮。
- 管理员下拉选择双方各两首曲目、各 Ban 对手一首；保存暗选草稿。
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

正式管理员只允许 SSO 验证后的登录名 `kirisamevanilla`。首次登录将其绑定到稳定的 `(issuer, sub)`；后续根据稳定 ID 验权，不按昵称判定。童话没有被授予权限。SSO 本机开发库没有用户的正式账号，不能把生产账号密码误认为本地账号凭证。

每次受保护操作重新调用 UserInfo；上游 token 撤销后本站拒绝操作。登录会话不超过 access token 有效期；退出会清理本地会话并尝试撤销上游 token。

正式 SSO 已登记 HachiCats，回调为 `https://hachicats.ourtaiko.org/api/auth/callback`。客户端凭证只保存在服务器的 `.env.production`，不进入 GitHub、Docker 构建上下文或前端。正式环境 `DEMO_MODE=false`。

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
- `lib/rules.ts`：服务端赛制校验。
- `lib/special.server.ts`：仅服务端的未公开指定曲。
- `lib/auth.ts`：SSO 和本地演示会话。
- `lib/store.ts` / `db/schema.ts` / `drizzle/`：持久化与版本更新。

## 本轮 demo 的边界

已确认赛果暂不支持撤销 / 改判；名单调整、现场替补、审计日志和管理员扩展留待下一轮确认需求。图片中的少数字符按原图人工录入，正式比赛前需核对选手名和曲名。正式域名为 https://hachicats.ourtaiko.org；手机适配已在 390px 视口检查。

## 服务器部署（1Panel）

使用 `Dockerfile` / `compose.yaml` 构建 Next.js standalone 服务。Node.js 24 自带 SQLite，无需另外安装数据库。参考 [Next.js 自托管文档](https://nextjs.org/docs/app/guides/self-hosting)。

```sh
# 在仓库目录中创建 .env.production（权限 600），仅填写：
# SSO_CLIENT_ID=正式客户端 ID
# SSO_CLIENT_SECRET=正式客户端密钥
docker compose up -d --build
curl --fail http://127.0.0.1:5188/api/health
```

1Panel 新建反向代理网站 `hachicats.ourtaiko.org`，上游 `http://127.0.0.1:5188`，启用有效 HTTPS 证书并跳转 HTTPS。Docker 端口只监听本机，OpenResty 是公网入口。

- 数据卷：`hachicats-data`，数据库 `/app/data/hachicats.sqlite`。重建容器保留比分及登录绑定。
- 每次启动自动创建缺失表，已有数据不会重置。SQLite WAL + 原子版本比较避免并发覆盖。
- 请勿执行 `docker compose down -v`，这会删除赛事数据卷。
- 更新前备份数据，建议使用 SQLite online backup；普通复制数据库时应先停止容器并同时备份整个数据卷。
- 本地生产构建检查：`npm run build:server`。
- 仓库私有，含未公布指定曲；不要改为公开仓库。

### 当前服务器与后续更新

GitHub 私有仓库：`KirisameVanilla/HachiCats`；服务器 SSH 预设 `ourtaiko-prod`，项目目录 `/opt/hachicats`，容器名 `hachicats`。代码以与 GitHub 相同的 Git commit 通过 SSH 传送，服务器不保存个人 GitHub token。

本机修改并提交、推送 GitHub 后，可用 Git bundle 更新服务器：

```sh
git push origin main
git bundle create /tmp/hachicats-release.bundle main
scp /tmp/hachicats-release.bundle ourtaiko-prod:/home/kv/
ssh ourtaiko-prod
cd /opt/hachicats
git fetch /home/kv/hachicats-release.bundle main
git merge --ff-only FETCH_HEAD
# 更新前备份 /app/data 中的 SQLite 数据库，然后构建：
sudo docker compose up -d --build
curl --fail http://127.0.0.1:5188/api/health
```

上线已执行 SQLite 完整性检查，并在数据卷中保存初始备份 `/app/data/backups/initial-deployment.sqlite`。备份包含登录数据，应与数据库使用相同的访问控制，且不能提交仓库。

`npm run test:storage` 验证 SQLite 在进程重启后保留数据，以及过期版本更新不能覆盖新赛况。
