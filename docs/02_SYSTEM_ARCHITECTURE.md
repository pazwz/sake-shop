# 酒类 EC 系统架构

Version: 1.0

Last Update: 2026-08-08

---

# 一、总体架构

                    Customer
                        │
                        ▼
               Next.js EC Website
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   PostgreSQL         Object Storage   Payment
        │               │                │
        └───────────────┼────────────────┘
                        │
                        ▼
                 Smaregi Platform API
                        │
                        ▼
                    Smaregi POS

---

# 二、系统组成

## Frontend

Next.js

TypeScript

TailwindCSS

---

## Backend

Next.js Route Handler

Server Actions

REST API

---

## Database

PostgreSQL

---

## Storage

AWS S3

未来：

商品图片

Hero

Banner

专题推荐

运单附件

---

## Payment

待确认：

stera EC

备用：

Stripe

PayPay

---

## POS

スマレジ

Platform API

---

# 三、主数据

## スマレジ负责

商品

价格

库存

门店销售

---

## 网站负责

首页

专题推荐

四季推荐

商品图片

顾客

订单

支付

配送

后台

---

# 四、数据流

商品

Smaregi

↓

Website DB

↓

Frontend

---

库存

Smaregi

↓

Website

↓

Checkout

---

订单

Website

↓

Payment

↓

Website DB

↓

Smaregi

---

配送

Website Admin

↓

Shipment

↓

Smaregi（可选）

---

# 五、后台

Admin

↓

Products

Collections

Orders

Shipments

Members

Settings

商品管理继续使用 `Route → Service → Repository → Prisma`。Admin Product Service
集中维护 Smaregi-owned / LINXAS-owned 字段边界，并在 `isEcAvailable` 从 false
变为 true 时调用统一 publication validation。Admin Route 使用严格白名单，不能接收
价格、库存、名称、商品代码、Category 或 Smaregi 状态更新。

商品图片沿用 Admin media presign 流程，由浏览器直接 PUT 私有 S3；数据库只保存
CloudFront URL。ProductImage.displayOrder 决定主图和显示顺序。

商品图片管理后续采用非破坏性编辑：保留原始 S3 文件，在上传后提供预览、裁剪、缩放与
主体位置调整，并生成标准画布的派生商品图。标准商品图以主体约占画布 70%～85% 为目标，
派生处理不得覆盖原始文件。

运营 enrichment 在 ProductImage 写入前通过统一的 ProductIdentityProfile 与字段级
identity scoring 进行校验。画像身份批准与商品资料完整度分离：producer 缺失不会作为
全局拒绝条件；只在 Burgundy 等 producer 本身是必要判别字段的类型中 fail closed。
不同商品类型分别校验 vintage、age、batch、edition、volume、package 等必要字段，
明确冲突时不允许写图。检索使用可扩展的品牌/商品 alias registry 与 productCode，
不依赖数据库商品名和页面标题完全相等；官方 domain 也不依赖 Product.producer 已填充。
历史 unresolved 结果不作永久缓存，每次使用最新 profile 和 evidence 重新计算。
Profile 的 identity type 同时参考 Category、已知 product family 与名称中的
discriminator；未注册品牌可从 DB 商品名或可追溯 evidence 推断，但不会因
brand 为 null 而自动成功或失败。SAKE 的容量/生火入、Burgundy 的生产者与
vintage、batch/release family 的 batch、限定版的 edition/variant，以及
结构化 package 都按类型动态列为 required fields。箱/木箱/无箱/礼盒/套装
使用 longest-match-first parser，套装构成不明时 fail closed。Identity decision 保留
required/matched/unknown/conflict 字段用于 Production preflight 审计；hard
requirement 不得被高 score 覆盖。

公开商品 Repository 强制 `isActive=true AND isEcAvailable=true`。首页和 Collection
Service 对关联商品再执行相同的防御性过滤，避免历史关联泄露非公开商品。

公开查询还通过统一 `isStandaloneEcProduct` 规则排除 Smaregi 箱 Category、已确认的
package-only SKU 及送料・服务专用 SKU。规则只依赖 Smaregi identity / Category，不以
商品名包含「箱」「送料」进行宽泛推断，因此「酒本体 + 木箱付き」仍是普通商品。Header
与首页 `EXPLORE BY CATEGORY`
共用 `PUBLIC_PRODUCT_NAVIGATION` 顶层分类、聚合查询参数和链接；Category mega menu 由
Category Repository → Service 读取真实公开独立商品分类，特集菜单由已发布
FeaturedCollection 生成。

FeaturedCollection 的消费者查询统一使用 Repository 的 PUBLISHED + publish window
predicate，Service 再做防御性有效期检查，并通过统一 path helper 生成公开 URL。首页显示
数量限制只影响首页版面，不得限制已公开 Collection 详情解析，否则 Header 或其他入口会
产生可见但 404 的链接。

Admin Collection 分为两个投影视图，但不复制数据：`/admin/collections` 通过 Service 的
home projection 显示当前首页内容，其中 Story 返回全部公开有效记录；
`/admin/collections/all` 读取全部 Editorial / Story 管理记录，并链接到同一个
`/admin/collections/[id]` 编辑器。公开菜单、公开详情和 Admin 内容列表均可追溯到同一
FeaturedCollection 主键。Story 始终按 Repository 的 displayOrder、createdAt 稳定顺序透传，
不设置固定数量上限。

掲載商品候補使用独立 Admin Route → FeaturedCollection Service → Product/Category
Repository 查询。候補 predicate 复用公开 Product 的 active + EC available + standalone
规则，不包含库存条件。查询在数据库侧完成 keyword、Category、pagination；客户端只维护
selected IDs 和已知商品快照。既存非公开关联可以保留或由运营解除，但 Service 只允许新增
仍满足候补 predicate 的 Product，避免绕过 UI 写入无效关联。

商品列表把消费者 URL 的 `page` / `perPage`（24 / 48 / 96）转换为 API 的 `page` /
`limit`，Repository 在同一数据库 transaction 中先计算符合公开独立商品条件的 total，
再以规范化页码执行 `skip` / `take`。排序始终追加 Product.id 作为 secondary order，避免
相同价格或创建时间的商品跨页重复/跳动；列表查询只读取第一张 ProductImage。

非公开商品 preview 使用 `Admin preview route → Preview Service → Product Service`。
route 只允许 OWNER / MANAGER 发出 5 分钟署名 token；商品页同时验证 token、productId、
adminId 和当前有效 Admin session。preview 复用同一 ProductDetail，不建立第二套详情 UI，
且 preview 中禁止实际加入购物袋。

箱オプションは Product の one-to-one self relation で表現する。箱 Product は Smaregi
同期・税 resolver・四店 InventoryMirror をそのまま使い、`isEcAvailable=false` の内部
SKU とする。詳細画面で選択された場合、Order Service は酒本体と箱の Product 行を
安定順でロックし、それぞれの在庫を検証して別 OrderItem / InventoryReservation を
作成する。箱 OrderItem は `parentOrderItemId` で酒本体行へ結び、どちらか一方でも在庫
不足なら transaction 全体を rollback する。Smaregi の税設定が解決できない deferred
箱は Product を偽造せず、Admin で未接続理由だけを表示する。
Admin の箱候補は main Product の Smaregi ID と箱 Product の Smaregi ID を結ぶ明示的な
compatibility allowlist だけから取得し、ブランド名や商品名の部分一致では推測しない。

---

# 六、同步

Smaregi

↓

Platform API

↓

Website

↓

Database

---

Webhook

↓

同步库存

↓

同步价格

↓

同步商品

---

## Smaregi read-only dry-run

正式同步前必须先通过 Service 层执行只读 dry-run。

```text
Smaregi GET APIs + Neon read-only snapshot
                    ↓
             Dry-run Service
                    ↓
       Category / Product / Inventory diff
```

dry-run 只允许 Repository 读取 Category、Product 和 InventoryMirror，
不允许 create、update、upsert、delete，也不写 SyncLog。Smaregi 仅使用
`pos.stores:read`、`pos.products:read` 和 `pos.stock:read`。
税率解析另使用 `pos.transactions:read`，供应商 read scope 保留为
`pos.suppliers:read`，不请求任何 write scope。

Product 更新只比较 Smaregi 主数据字段；slug、description、
tastingNotes、images、isEcAvailable 及其他 CMS 内容必须保留。
现有商品的 taxRate 不由同步覆盖；新商品只使用经税率链路唯一解析的税率。
税率无法解析时将商品标记为 quarantine，不进入 Product / InventoryMirror plan，
其他 safe Product 继续同步。唯一の例外是、客户批准済みの
箱代金 Product 6 件が `CATEGORY_TAX_DIVISION_MISSING` となる場合で、これらは
`approvedDeferredProducts` に分離し、Product / InventoryMirror plan から除外する。
対象 ID と理由が完全一致するものだけを approved deferred として扱う。
这 6 个 Product 即使税率后来已可解析，也以 `DEFERRED_NOW_RESOLVABLE` 继续排除，
必须经过后续人工批准才能解除 deferred，自动同步不得首次写入。

标准税率从 `consumption_tax_rates` 按目标日期选择最新生效记录，
轻减税率从 `reduce_tax_rates` 按 ID 和生效期唯一解析。
税外价格、非课税价格、动态选择税率或无法唯一解析时 fail closed。

库存 dry-run 对每个 Smaregi Product 与目标 Store 构建期望集合。
Stock API 有记录时使用 `stockAmount`；缺少记录时明确计算为 0。
`reservedQuantity` 保留 LINXAS 现有值，`layawayStockAmount` 只报告不参与计算。

获批后的正式写入必须在所有 Smaregi GET 和校验完成后，使用一个
Prisma interactive transaction 按 Category → Product → InventoryMirror
执行。任一阶段失败时回滚全部业务写入。
`executeApprovedSync()` 只接受已完成 preflight 的 `ValidatedSmaregiSyncPlan`，
不得在该入口内部重新获取另一份 Smaregi 数据。首次大量新增的 InventoryMirror
在同一 transaction 内批量创建；既存行仍保留 reservedQuantity 后更新。

正式库存镜像只接受批准的 Store ID `1`、`2`、`3`、`6`，并继续按
Product + Store 分行保存原始物理库存，不把四个地点永久合并为一行。
EC 查询层按以下规则计算：

```text
physicalTotalApproved = sum(approved store physical quantity)
activeReservedQuantity = sum(ACTIVE product-level InventoryReservation)
availableQuantity = max(0, physicalTotalApproved - activeReservedQuantity)
```

`InventoryMirror.reservedQuantity` 是旧的 Store 级字段，保留用于兼容，但不参与
EC reservation 或 availableQuantity 计算，禁止与 InventoryReservation 重复相加。

Store `1` 是实际出库店。店头可用量不足、但 approved-store 总可售量足够时，
订单进入现有 PROCESSING / PREPARING 流程并由工作人员先在 Smaregi 人工调拨；
第一阶段不调用库存 write API。`OrderItem.requiresTransfer` 保存下单时快照；计算时
保守地假设既有 ACTIVE reservation 优先占用 Store `1`：

```text
store1UsableForNewOrder = max(0, store1Physical - activeReservedQuantity)
requiresTransfer = store1UsableForNewOrder < orderItem.quantity
```

下单使用单一 PostgreSQL transaction。Service 将 productId 排序，Repository 按该
顺序对 Product 行执行 `SELECT ... FOR UPDATE`，之后才读取四店镜像、汇总 ACTIVE
reservation、校验整单并创建 Order / OrderItem / InventoryReservation。任何一行库存
不足时整个 transaction 回滚，不允许部分 reservation。InventoryReservation 不绑定 Store；
最终仓库选择继续由工作人员人工决定。

Reservation 生命周期为 ACTIVE → RELEASED / CONSUMED / EXPIRED。只有 ACTIVE 计入
可售库存；release 与 consume 只更新 ACTIVE 行，因此重复调用幂等。expiresAt 暂时可空，
本阶段不实现自动过期任务。

Stock 中 Product API 已不存在的 orphan 行只记录 warning，不创建 Product 或
InventoryMirror，也不阻断其余同步。已知与新出现的 orphan 数量分别记录。
approved deferred / orphan 的负库存只记录 warning；normal Product 出现负库存时，
该 Product 整体 quarantine，本轮不更新其 Product 与 InventoryMirror，其他 safe Product
继续同步。

## Smaregi production incremental sync

外部定时调用与 Admin 手动同步共用唯一 orchestration：

```text
External Scheduler / Admin API
        ↓
PostgreSQL advisory transaction lock
        ↓
ProductionSmaregiSyncService
        ↓
Smaregi snapshot (transaction 外)
        ↓
fatal validation / product classification / plan invariant
        ↓
SmaregiAtomicSyncService.executeApprovedSync()
        ↓
Category → Product → InventoryMirror (单一 transaction)
```

全局 fatal 条件包括批准 Store 集合变化、未知 Store、重复 productId/productCode、
API schema 或全局税率无法解析、source snapshot 不一致、identity 不明确、DB 错误与
atomic plan invariant 失败。此时不写 Product/Inventory，并将 SyncLog 标记 FAILED。

同步锁使用 PostgreSQL transaction-level advisory lock，跨 Vercel instance 生效。
Admin 冲突返回 409，internal endpoint 记录 `SKIPPED_ALREADY_RUNNING` 后结束。每次结果复用
SyncLog 的 JSON payload，记录 trigger、source/count summary、warning、error code；
其中 orphan 分为 `knownOrphanCount` 与 `newOrphanCount`，不记录 credentials。
定时入口预留给 AWS EventBridge Scheduler + Lambda 每 15 分钟 GET 调用，并使用
`Authorization: Bearer <CRON_SECRET>`。Vercel Hobby 不配置 Cron；AWS Scheduler / Lambda
资源及 production `CRON_SECRET` 配置属于后续独立实施范围。Secret 未配置时 internal
endpoint 必须 fail closed。

---

# 七、权限

Owner

↓

全部权限

Manager

↓

商品

订单

专题

Staff

↓

订单

发货

---

# 八、部署

Development

↓

Vercel

Production

↓

AWS

---

# 九、开发原则

1.

Smaregi

=

商品主数据

2.

Website

=

EC 主数据

3.

图片

=

S3

4.

所有业务

=

数据库

5.

后台

=

动态管理

禁止硬编码
