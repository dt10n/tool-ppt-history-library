# PPT 历史图片素材库：腾讯云部署操作手册

> 适用对象：负责腾讯云、数据库和网站发布的开发/运维同事  
> 代码仓库：`https://github.com/dt10n/tool-ppt-history-library`  
> 目标：让团队通过正式网址搜索、查看和下载 7,827 张历史 PPT 页面。

## 0. 先看结论

建议使用以下架构：

```text
浏览器
  ↓
EdgeOne Makers（网页和 API）
  ├── Supabase PostgreSQL（目录、分类、OCR、期数、页码）
  └── 腾讯云 COS 私有桶（7,827 张原图）
```

当前程序使用 Cloudflare D1/R2 接口，不能原样接到 Supabase/COS。部署同事需要先完成第 4 章的三个 API 适配，再发布到 EdgeOne。

## 1. 部署前准备

### 1.1 需要的账号和权限

请准备：

- GitHub：能读取 `dt10n/tool-ppt-history-library`。
- 腾讯云：能创建 EdgeOne Makers 项目、COS 存储桶和 CAM 子账号/角色。
- Supabase：能创建项目和执行 SQL。
- 飞书开放平台：如正式版本接飞书登录，需要应用管理员权限。

### 1.2 需要从素材维护人处取得的文件

GitHub 不包含原图。首次部署需要从素材维护人的电脑取得：

- 7,827 张保留的 PPT 页面图片。
- 当前 `library.db` 的只读备份，或导出的 `pages.csv`、`taxonomy.csv`、`page_tags.csv`。
- 一份“图片本地路径 → image_key”的上传清单。

严禁把整套原图、数据库密码、COS 密钥或飞书密钥提交到 GitHub。

### 1.3 上线前建议恢复私有仓库

仓库目前为公开状态，检索种子包含 OCR、PPT 标题、期数和页码。若这些属于内部资料，上线前应将仓库改回私有，并只授予部署账号读取权限。

## 2. 建立 Supabase 数据库

### 2.1 创建项目

1. 登录 Supabase 控制台。
2. 单击 **New project**。
3. 项目名填写 `ppt-history-library`。
4. 选择靠近主要使用地区的 Region。
5. 生成高强度数据库密码并放入公司密码管理工具。
6. 创建完成后，在项目设置中记录：

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` 只能配置在 EdgeOne 服务端环境变量中，不能出现在浏览器代码、日志和 GitHub。

### 2.2 创建表和索引

在 Supabase 的 SQL Editor 中执行：

```sql
create extension if not exists pg_trgm;

create table if not exists pages (
  id text primary key,
  title text not null default '',
  episode_label text not null default '',
  page_number integer,
  source_group text not null,
  source_label text not null,
  image_key text not null,
  ocr_text text not null default '',
  search_text text not null default ''
);

create table if not exists taxonomy (
  path text primary key,
  label text not null,
  parent_path text not null default '',
  depth integer not null
);

create table if not exists page_tags (
  page_id text not null references pages(id) on delete cascade,
  tag_path text not null references taxonomy(path) on delete cascade,
  primary key (page_id, tag_path)
);

create index if not exists idx_pages_episode_page
  on pages (episode_label, page_number);
create index if not exists idx_pages_source_group
  on pages (source_group);
create index if not exists idx_pages_search_trgm
  on pages using gin (search_text gin_trgm_ops);
create index if not exists idx_pages_title_trgm
  on pages using gin (title gin_trgm_ops);
create index if not exists idx_taxonomy_parent
  on taxonomy (parent_path);
create index if not exists idx_page_tags_path_page
  on page_tags (tag_path, page_id);
```

### 2.3 导入数据

推荐从当前 SQLite 导出三个 UTF-8 CSV，再通过 Supabase Table Editor 导入。必须按以下顺序：

1. `pages.csv` → `pages`
2. `taxonomy.csv` → `taxonomy`
3. `page_tags.csv` → `page_tags`

如果直接使用仓库中的 `drizzle/0002_seed_catalog.sql`，要先把 SQLite/D1 语法转换为 PostgreSQL，不能原样执行。

### 2.4 数据库验收

在 SQL Editor 执行：

```sql
select count(*) from pages;
select count(*) from taxonomy;
select count(*) from page_tags;
select source_group, count(*) from pages group by source_group order by source_group;
select count(*) from pages where image_key = '' or image_key is null;
select count(*) from pages where page_number is null;
```

完成标准：

- `pages` 为 7,827 条。
- 公募直播、私募直播、对外演讲三个来源都有数据。
- `image_key` 缺失为 0。
- 无法确认页码的记录单独输出给素材维护人核对，不可随意补页码。

## 3. 建立腾讯云 COS 私有图片库

### 3.1 创建存储桶

1. 进入腾讯云控制台 → **对象存储 COS**。
2. 选择 **存储桶列表 → 创建存储桶**。
3. 名称建议：`ppt-history-library-<腾讯云APPID>`。
4. 地域选择靠近 EdgeOne 后端和主要使用者的区域。
5. 访问权限选择 **私有读写**。
6. 建议开启版本控制，防止误覆盖。
7. 不要开启公有读，不要允许匿名上传。

记录：

```text
COS_REGION=
COS_BUCKET=
```

### 3.2 创建最小权限身份

1. 进入腾讯云 **访问管理 CAM**。
2. 创建专用于素材库的子账号或角色，例如 `ppt-library-service`。
3. 权限仅限上述存储桶。
4. 网站运行所需最小权限：读取对象；批量迁移账号另授上传权限。
5. 网站运行身份不授予删除存储桶、修改 ACL 等权限。
6. 优先使用角色/临时凭证；若平台必须使用密钥，将其只放在 EdgeOne 环境变量。

记录但不要提交到代码：

```text
COS_SECRET_ID=
COS_SECRET_KEY=
```

首次图片迁移完成后，应撤销批量上传账号的写入权限，只保留运行时读取权限。

### 3.3 批量上传原图

首次迁移推荐使用 COSBrowser：

1. 安装并登录 COSBrowser。
2. 打开新建的私有存储桶。
3. 从上传清单逐批上传图片。
4. 保持目录层级和文件名不变。
5. 每批上传后导出成功/失败记录。
6. 对失败项目重试，不要改文件名规避失败。

最重要的对应关系：

```text
数据库 pages.image_key
必须完全等于
COS 中的对象 Key
```

例如：

```text
pages.image_key = public-live/第468期/page-23.jpg
COS object key = public-live/第468期/page-23.jpg
```

### 3.4 COS 验收

完成标准：

- COS 对象数量与待上传清单一致。
- 抽查公募、私募、对外演讲各 20 张，图片能读取且没有串图。
- 未签名的对象地址不能在无痕窗口直接打开。
- 数据库随机抽取 100 个 `image_key`，COS 对象全部存在。
- 图片的 Content-Type 正确，例如 `image/jpeg`、`image/png`、`image/webp`。

## 4. 修改程序以连接 Supabase 和 COS

### 4.1 新建适配分支

```bash
git clone https://github.com/dt10n/tool-ppt-history-library.git
cd tool-ppt-history-library
git checkout -b deploy/edgeone-supabase-cos
npm install
npm test
```

先确认现有测试通过，再开始适配。

### 4.2 安装服务端依赖

选择公司认可的官方 SDK：

- Supabase JavaScript SDK，用于 PostgreSQL 查询。
- 腾讯云 COS Node.js SDK，用于读取私有图片。

安装后提交 `package.json` 和 `package-lock.json`，不要提交任何密钥。

### 4.3 修改搜索接口

文件：`app/api/search/route.ts`

当前代码使用 `env.DB.prepare()`，属于 Cloudflare D1。改造目标：

1. 从服务端环境变量初始化 Supabase 客户端。
2. 根据 `q` 拆分关键词。
3. 搜索 `search_text`、`title`、`episode_label`。
4. 有 `tag` 时通过 `page_tags` 过滤。
5. 默认最多返回 60 条，最大不超过 100 条。
6. 输出 JSON 字段保持现状：

```text
total
items[].id
items[].title
items[].episodeLabel
items[].pageNumber
items[].sourceLabel
items[].matchedText
```

前端依赖这个格式，不要随意改字段名。

### 4.4 修改分类接口

文件：`app/api/taxonomy/route.ts`

当前代码使用 D1。改造目标：

1. 从 Supabase 读取 `taxonomy`。
2. 统计每个标签及全部子标签关联的图片数。
3. 按 `parent_path` 组装树。
4. 返回 `{ tree: [...] }`，保持前端兼容。

### 4.5 修改图片接口

文件：`app/api/image/route.ts`

当前代码使用 `env.MEDIA.get()`，属于 Cloudflare R2。改造目标：

1. 接收图片 `id`。
2. 在 Supabase 的 `pages` 表查询 `image_key`。
3. 使用服务端 COS SDK读取私有对象。
4. 将图片流返回浏览器。
5. 设置正确的 `Content-Type`、`ETag` 和私有缓存头。
6. 不把 COS SecretKey、永久签名或存储桶写权限返回给浏览器。

如果改用预签名 URL，有效时间建议 5 分钟以内，并且必须在验证登录权限后生成。

### 4.6 删除 Cloudflare 专属依赖

完成新适配后：

- 三个生产 API 不再导入 `cloudflare:workers`。
- `.openai/hosting.json` 只保留历史参考，不作为 EdgeOne 配置。
- 确认构建产物不依赖 D1/R2 binding。
- 不要在前端代码中引用 `SUPABASE_SERVICE_ROLE_KEY` 或 COS 密钥。

### 4.7 本地测试

在本机创建不提交的 `.env.local`：

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
COS_REGION=...
COS_BUCKET=...
COS_SECRET_ID=...
COS_SECRET_KEY=...
```

执行：

```bash
npm run dev
npm test
npm run build
```

至少测试关键词：

```text
指数增强
全球股票指数
资产配置
基金经理
估值
第468期
```

检查搜索结果、分类、期数、页码和图片是否对应。

## 5. 部署到 EdgeOne Makers

### 5.1 导入 GitHub 仓库

1. 登录腾讯云 EdgeOne Makers。
2. 选择 **创建项目 → 导入 Git 仓库**。
3. 关联 GitHub 组织 `dt10n`。
4. 选择 `tool-ppt-history-library`。
5. 生产分支选择 `main`。
6. Node.js 版本选择 22 或平台支持的最新稳定版本。
7. 安装命令填写 `npm install`。
8. 构建命令填写 `npm run build`。
9. 输出目录由适配后的框架配置确定，不要凭经验填写；先以本地构建结果为准。

### 5.2 配置生产环境变量

在 EdgeOne 项目设置 → 环境变量中增加：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
COS_REGION
COS_BUCKET
COS_SECRET_ID
COS_SECRET_KEY
```

要求：

- 生产和预览环境分别配置。
- 所有密钥标记为敏感变量。
- 不在构建日志输出变量值。
- 不把 `.env.local` 上传到 GitHub。

### 5.3 首次部署

1. 先部署预览环境。
2. 查看安装、构建和函数日志。
3. 预览环境验收通过后合并适配分支到 `main`。
4. 由 `main` 自动触发生产部署。
5. 记录 EdgeOne 生成的生产 URL。

### 5.4 绑定公司域名

1. 在 EdgeOne 项目中进入域名管理。
2. 添加公司分配的子域名，例如 `ppt-library.example.com`。
3. 按控制台提示配置 DNS。
4. 等待证书和 DNS 生效。
5. 确认 HTTPS 正常，HTTP 自动跳转 HTTPS。

## 6. 配置团队登录

上线前不能只依赖“网址不公开”。建议接入飞书 OAuth：

1. 在飞书开放平台创建企业自建应用。
2. 配置网页应用回调地址。
3. EdgeOne 环境变量保存飞书 App ID 和 App Secret。
4. 登录成功后读取用户 `open_id` 或企业邮箱。
5. 与允许名单比对。
6. 未登录用户不能调用搜索、分类和图片接口。

建议角色：

| 角色 | 权限 |
|---|---|
| 普通同事 | 搜索、查看、下载 |
| PPT 编辑 | 普通权限 + 修正标签 |
| 管理员 | 同步、批量维护、回收与恢复 |

飞书登录尚未完成时，只能作为受控试运行，不应把正式图片接口完全公开。

## 7. 正式验收

请部署同事、素材维护人和 PPT 团队共同验收。

### 7.1 数据完整性

- [ ] 数据库 `pages` 为 7,827 条。
- [ ] 三个来源均存在。
- [ ] 所有 `image_key` 在 COS 中存在。
- [ ] 封面页、总结页和学院素材未重新进入。
- [ ] 抽查 100 张，期数和页码准确。

### 7.2 搜索准确性

- [ ] 模糊关键词能返回相关图片。
- [ ] 多关键词使用 AND 逻辑。
- [ ] 标题命中优先于仅 OCR 命中。
- [ ] 分类筛选与关键词可以组合。
- [ ] 搜索结果能显示来源、期数和页码。

### 7.3 安全性

- [ ] COS 为私有读写。
- [ ] 无痕窗口不能直接打开未签名 COS 地址。
- [ ] 未登录用户不能调用图片接口。
- [ ] GitHub 和日志中没有任何密钥。
- [ ] 上传账号的临时写权限已撤销。

### 7.4 稳定性

- [ ] 首页、搜索、分类和大图接口正常。
- [ ] 手机和电脑均可使用。
- [ ] 404 图片数量为 0。
- [ ] 推送 `main` 可以触发自动部署。
- [ ] 数据库和 COS 已设置备份/版本保护。

## 8. 常见问题排查

### 搜索有结果，但图片打不开

依次检查：

1. `pages.image_key` 是否为空。
2. COS 中是否存在完全同名的对象 Key。
3. 大小写、空格、中文目录是否一致。
4. EdgeOne 的 COS 环境变量是否正确。
5. CAM 身份是否有读取该对象的权限。

### 所有搜索都返回 500

检查：

1. `SUPABASE_URL` 和服务端 Key 是否配置。
2. Supabase 表名、字段名是否一致。
3. EdgeOne Functions 日志中的第一条数据库错误。
4. API 是否仍在调用 `env.DB.prepare()`。

### 首页能打开，但接口全部失败

通常表示静态网页部署成功，但服务端 Functions 或环境变量未配置成功。不要只看首页判断部署完成。

### 图片被外部地址直接打开

立即检查 COS ACL 和桶策略，确认未设置公有读；撤销泄漏凭证，重新生成运行身份，并检查图片接口是否返回了长期有效签名。

## 9. 交付物

部署完成后，请交付：

- 正式访问网址。
- EdgeOne 项目名称和负责人。
- Supabase 项目名称和负责人。
- COS 存储桶名称、地域和负责人。
- 数据导入数量与图片上传数量截图。
- 飞书允许名单维护方法。
- 一次完整验收记录。
- 回滚方式和故障联系人。

密钥只保存在公司认可的密码管理系统和部署平台中，不放进交付文档。
