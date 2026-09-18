# 酒类 EC 项目 API 设计规范

Version: 1.0

Last Update: 2026-08-14

---

# 一、API 设计原则

## 1. RESTful API

统一采用 RESTful 风格。

例如：

GET

POST

PATCH

DELETE

禁止：

RPC 风格接口。

---

## 2. 返回格式统一

所有接口统一返回：

```json
{
  "success": true,
  "data": {},
  "message": "",
  "error": null
}
```

错误：

```json
{
  "success": false,
  "data": null,
  "message": "",
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "detail": "Product not found."
  }
}
```

---

## 3. HTTP Status

200 OK

201 Created

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Validation Error

500 Internal Server Error

---

## 4. API Version

统一：

/api/v1/

例如：

/api/v1/products

方便以后升级。

---

# 二、Frontend API

---

## 首页

### 获取首页

GET

/api/v1/home

返回：

- Hero
- Banner
- 四季推荐
- 推荐商品
- 最新商品
- 店长推荐

---

## 商品

### 商品列表

GET

/api/v1/products

支持：

page

limit（默认 24；消费者页面的 `perPage` 仅允许 24 / 48 / 96，并映射到该参数）

category

subcategory

keyword

season

sort

返回：

商品分页列表

返回 pagination：`page`、`limit`、`total`、`totalPages`。page 超出当前筛选结果时按
最后有效页规范化；total 只统计 active、EC 公开且可独立销售的商品，不包含箱・包装、
送料或服务专用 SKU。排序包含稳定 secondary key，分页不会因同价商品产生重复或跳项。

---

### 商品详情

GET

/api/v1/products/{id}

返回：

商品详细资料

图片

库存

推荐商品

---

## Smaregi 管理（Admin）

すべて OWNER / MANAGER 専用で、Customer / public client は利用できない。

- `POST /api/v1/admin/products/{id}/exclusion`：Smaregi-backed Product を
  「EC販売対象から除外」として tombstone 化する。Smaregi には write せず、local mirror は
  business reference がなければ削除、あれば退役する。
- `GET /api/v1/admin/integrations/smaregi/exclusions`：active EC exclusion 一覧。
- `DELETE /api/v1/admin/integrations/smaregi/exclusions`：`smaregiProductId` の exclusion を
  明示解除する。次回同期から通常 candidate になるが、自動公開しない。
- `GET /api/v1/admin/integrations/smaregi/sync/{syncLogId}/items?page=1&limit=50`：
  個別 SyncLog の変更・warning明細。最大 100 件/page、未変更データは返さない。
- `GET /api/v1/admin/operations/health`：すべての authenticated Admin（STAFF を含む）が read-only
  operations health DTO を取得する。raw SyncLog、email address、payload、provider secret、stack trace は
  返さない。

---

### 搜索

GET

/api/v1/search

参数：

keyword

返回：

商品

分类

专题推荐

---

## 分类

### 分类列表

GET

/api/v1/categories

返回：

树形分类。

例如：

日本酒

↓

纯米

↓

纯米吟酿

---

## 购物车

### 获取购物车

GET

/api/v1/cart

---

### 添加商品

POST

/api/v1/cart

---

### 修改数量

PATCH

/api/v1/cart

---

### 删除商品

DELETE

/api/v1/cart/{itemId}

---

## Checkout

### Customer authentication

- `POST /api/v1/customer/register`：name/email/password；Customer、verification token、
  EmailOutbox を作成するが Session は作らず、確認メール送信待ちを返す。
- `POST /api/v1/customer/login`：凭证错误は統一応答。正しい凭证でも未確認 Customer は
  `403 EMAIL_NOT_VERIFIED`、確認済みなら Session を輪换する。
- `POST /api/v1/customer/logout`：服务端撤销 session 并清 Cookie。
- `GET /api/v1/customer/me`：只返回 id/name/email/phone；匿名为 401。
- `POST /api/v1/customer/verify-email`：一次性 signed token を验证し、emailVerifiedAt、他 token
  失效、Session 作成を atomic に行い、HttpOnly Cookie を返す。
- `POST /api/v1/customer/verification/resend`：存在/状态を外部に区別せず、cooldown と rate limit
  の範囲で新 token hash と EmailOutbox を作る。
- `POST /api/v1/customer/forgot-password`：存在与不存在 email 均返回相同成功文案。
- `POST /api/v1/customer/reset-password`：验证 token、更新 bcrypt hash 并撤销全部 session。
- `PATCH /api/v1/customer/password`：認証済み Customer の現在 password を確認し、password
  更新、全旧 Session 撤销、当前端末 Session 再発行を atomic に行う。
- `PATCH /api/v1/customer/profile`：Session Customer の name のみ更新。email は read-only。
- `GET|POST /api/v1/customer/addresses`：Session Customer 自身の住所一覧・新增。
- `GET|PATCH|DELETE /api/v1/customer/addresses/{id}`：customerId ownership scoped CRUD。
- `GET|PATCH /api/v1/customer/preferences/newsletter`：Neon consent の取得・購読・配信停止。

注册、登录、logout、forgot/reset 与 verification mutation 验证 same-origin；注册、登录、
forgot-password 带最小进程内 rate limit。该 rate limit 在 Vercel 多实例间不共享，正式
高流量上线前应换为共享存储。

Customer 注册在创建 verification token 与 EmailOutbox 前必须具备 server-side
`JWT_SECRET`。注册 transaction 的 Customer、EmailVerificationToken、EmailOutbox、可选
NewsletterSubscription 与 Newsletter contact Outbox 任一步失败时整体 rollback，且绝不建立
Session。未知错误的客户端响应仍为通用 500；服务端只记录不含输入值和 secret 的 operation
stage、request id、error name 与 Prisma code。

### Contact support

`POST /api/v1/contact` 为公开支持咨询接口。body 严格限定为 UUID `submissionId`、topic
(`PRODUCT` / `SHIPPING` / `PRE_ORDER` / `ORDER_CHANGE_CANCEL` / `OTHER`)、email、1–5000 字符
message、可选安全格式 `orderNumber` 与空 honeypot `website`。Route 强制 same-origin，并使用
最小进程内 rate limit。`website` 非空时返回与成功提交相同的通用成功响应且不写 Outbox。

收件人只能由 server-side `CONTACT_RECIPIENT_EMAIL` 决定；缺失时返回 `503 CONTACT_UNAVAILABLE`。
合法请求返回 201 并用 `contact:{submissionId}:support` 幂等创建 `CONTACT_INQUIRY` EmailOutbox。
用户 email 仅是 support email 的 Reply-To，不能成为 From 或收件人。`orderNumber` 不执行订单
变更；对已登录用户只做 customer-scoped 内部引用验证，未登录或不匹配时外部响应保持相同。

### Browser E2E production smoke

`pnpm test:e2e:production-smoke` 仅面向 `https://sake-shop.vercel.app`，不得携带真实 Customer、
Admin 或支付凭证。允许的 mutation-shaped requests 仅为无身份的 `POST /api/v1/orders` 与
`POST /api/v1/payments/create`，预期均为 `503 CHECKOUT_DISABLED` 且在授权、body parsing 与任何
业务写入之前 fail closed。Contact 在 production smoke 只做 GET，禁止提交。

### Checkout mode

服务端 `CHECKOUT_MODE` 支持：

- `mock`：仅 local development，或显式配置的 Preview deployment。
- `disabled`：页面可访问，但禁止任何新交易写入。
- `live`：预留给真实 Payment Adapter；当前未实现，因此 fail closed。

Production 未配置、非法配置或误配 `mock` 时均按 `disabled` 处理。Checkout 页面只接收
服务端传入的 `checkoutEnabled` boolean，不向客户端暴露环境变量或 Payment 配置。

### 创建结算

POST

/api/v1/checkout

功能：

计算：

商品金额

运费

税

优惠

总金额

---

## 订单

### 创建订单

POST

/api/v1/orders

在解析 request body 和进入 Order transaction 前执行 Production Checkout gate。关闭时：

```json
{
  "success": false,
  "data": null,
  "message": "",
  "error": {
    "code": "CHECKOUT_DISABLED",
    "detail": "現在オンライン注文の受付準備中です。"
  }
}
```

HTTP status 为 503，且不创建 Order、OrderItem、InventoryReservation 或 Payment。
Gate 通过后必须 requireCustomer；customerId 从 session 注入，body 中的 customerId、
customer 或 email 身份字段会被 strict validator 拒绝。

订单创建会在单一数据库 transaction 内对全部 Product 按稳定顺序加行锁，校验：

```text
availableQuantity = max(0, approvedPhysicalTotal - activeReservedQuantity)
```

库存充足时同时创建 Order、OrderItem 和 ACTIVE InventoryReservation。任一商品不足时
返回 `INSUFFICIENT_INVENTORY`，整单不创建。响应中的每个 OrderItem 包含
`requiresTransfer`；Store `1` 的保守可履约量不足时为 true。

订单创建不会修改 Smaregi inventory，也不会自动调拨。

成功响应只返回后续 Mock checkout 所需的最小确认标识，不返回 Customer、配送地址、
OrderItem、Payment 或 Shipment：

```json
{
  "success": true,
  "data": {
    "id": "order-id",
    "orderNumber": "LINXAS-YYYYMMDD-XXXXXX"
  },
  "message": "",
  "error": null
}
```

各 request item は任意の `boxProductId` を一件だけ持てる。指定時は Product の
`boxProductId` と完全一致し、対象が同期済み package-only SKU、active、価格・税率有効、
在庫十分であることを検証する。箱だけを `productId` として注文することは禁止する。
酒本体と箱は別 OrderItem とし、箱行の `parentOrderItemId` は酒本体行を指す。
両方の InventoryReservation は同一 transaction で作成し、一方の在庫不足で全体を
rollback する。小計・税額には箱価格を含める。

---

### 我的订单

`GET /api/v1/customer/orders?page=1` 返回当前 Customer 的分页订单摘要。

---

### 订单详情

GET

/api/v1/orders/{orderNumber}

匿名请求返回 401。登录后只执行 `orderNumber + customerId` scoped query；他人订单与
不存在订单统一返回：

```text
404 NOT_FOUND
```

响应是 CustomerOrder DTO，不含 raw Payment payload、Smaregi 信息、reservation、audit 或
Admin 数据。`/account`、`/account/orders` 与 `/account/orders/[orderNumber]` 使用同一规则。
Admin 订单接口不受 Customer ownership 边界影响。

---

### 取消订单

PATCH

/api/v1/orders/{id}/cancel

---

## 用户

### 登录

POST

/api/v1/auth/login

---

### 注册

POST

/api/v1/auth/register

---

### 登出

POST

/api/v1/auth/logout

---

### 我的资料

GET

/api/v1/profile

---

### 修改资料

PATCH

/api/v1/profile

---

# 三、Admin API

所有接口：

需要登录。

Role：

OWNER

MANAGER

STAFF

---

## 管理员认证

### 登录

POST

/api/v1/admin/auth/login

Request：

```json
{
  "username": "admin_linxas",
  "password": "********"
}
```

正式后台使用 username 作为登录 ID。过渡期间，包含 `@` 的登录 ID 可以按
现有 email 查询，以保证历史管理员账号继续可用。

---

## 管理员媒体上传

### S3 直传准备

POST

/api/v1/admin/media/presign

Role：OWNER / MANAGER

Request：

```json
{
  "fileName": "collection.jpg",
  "contentType": "image/jpeg",
  "fileSize": 9437184
}
```

`contentType` 必须为 `image/*`，`fileSize` 必须大于 0 且不超过 10 MB。
对象 key 由服务器按 `uploads/yyyy/mm/uuid-filename` 生成，客户端不能指定
Bucket 或 key。返回的 S3 PUT URL 有效期为 5 分钟。

Response data：

```json
{
  "uploadUrl": "https://signed-s3-url",
  "key": "uploads/2026/08/uuid-collection.jpg",
  "url": "https://cloudfront-domain/uploads/2026/08/uuid-collection.jpg"
}
```

浏览器使用相同 `Content-Type` 直接 PUT 到 S3。图片二进制不经过本 API 或
Vercel Function。旧 multipart media upload Route 不再使用。

---

## Dashboard

GET

/api/v1/admin/dashboard

返回：

订单数量

销售额

库存预警

最新订单

---

## 商品

### 商品列表

GET

/api/v1/admin/products

Role：OWNER / MANAGER / STAFF

Query：`q`（商品名、商品代码或 Smaregi Product ID）、`category`、`ecStatus`、
`source`、`imageStatus`（`all` / `with` / `without`）、`page`、`limit`。默认
`limit=25`。图片状态使用 ProductImage relation 在数据库侧过滤，可与其他条件及分页组合。

返回 Smaregi 只读字段、LINXAS EC 字段、四店库存、ACTIVE reservation、统一 EC
可售量、图片与公开检查结果。该列表包含非公开商品。

---

### 商品详情

GET

/api/v1/admin/products/{id}

Role：OWNER / MANAGER / STAFF

---

### 商品プレビュー

GET

/api/v1/admin/products/{id}/preview

Role：OWNER / MANAGER。短時間の署名付き `previewToken` を生成して実際の
`/products/{slug}` へ redirect する。商品ページ側でも現在の OWNER / MANAGER session、
adminId、productId を再検証するため、token 単体または STAFF session では表示できない。

---

### EC字段修改

PATCH

/api/v1/admin/products/{id}

允许：

`slug`、`producer`、`origin`、`volume`、`alcoholPercentage`、`description`、
`tastingNotes`、`isEcAvailable`、`boxProductId`

禁止：

`smaregiProductId`、`productCode`、`name`、`categoryId`、`price`、`taxRate`、
`isActive`、`lastSyncedAt`、库存及其他未列入白名单的字段。

Role：OWNER / MANAGER。Request 使用 strict validation。`isEcAvailable` 从 false
改为 true 时必须通过统一 publication validation；true 改为 false 可直接执行。

---

### 商品图片

POST

/api/v1/admin/products/{id}/images

DELETE

/api/v1/admin/products/{id}/images/{imageId}

PATCH

/api/v1/admin/products/{id}/images/order

Role：OWNER / MANAGER。图片文件先通过 `/api/v1/admin/media/presign` 直传 S3，
上述 API 只保存 CloudFront URL、删除数据库关联或更新显示顺序。公开商品不能删除
最后一张图片。

---

## 首页 Hero

GET

/api/v1/admin/home/hero

PATCH

/api/v1/admin/home/hero

---

## Banner

GET

/api/v1/admin/banners

POST

/api/v1/admin/banners

PATCH

/api/v1/admin/banners/{id}

DELETE

/api/v1/admin/banners/{id}

---

## 四季推荐

GET

/api/v1/admin/seasons

POST

/api/v1/admin/seasons

PATCH

/api/v1/admin/seasons/{id}

DELETE

/api/v1/admin/seasons/{id}

---

## 专题

GET

/api/v1/admin/collections

POST

/api/v1/admin/collections

PATCH

/api/v1/admin/collections/{id}

DELETE

/api/v1/admin/collections/{id}

### 掲載商品候補

GET

/api/v1/admin/collections/product-candidates

Role：OWNER / MANAGER / STAFF（读取）。Query：`q`（商品名、producer、商品代码）、
`category`（实际 Category ID）、`page`、`limit`（默认 50，最大 100）。

只返回 `isActive=true`、`isEcAvailable=true` 且独立销售可能的 Product；库存为 0 的公开
商品仍返回。Response 同时包含实际可用 Category 和 pagination。Collection create/update
时，Service 对新增的 productIds 再执行相同 eligibility 校验；既存但后来非公开的关联不会
静默删除。

---

## 推荐商品排序

PATCH

/api/v1/admin/collections/{id}/products/order

---

## Editorial 文章段落

GET

/api/v1/admin/collections/{id}/editorial-sections

PUT

/api/v1/admin/collections/{id}/editorial-sections

PUT 使用固定字段的有序 Section 数组整体保存：

- id（既有 Section 更新时）
- title
- body
- imageUrl（任意）
- productId（任意；每段最多一个）

权限：

- OWNER / MANAGER：读取与保存
- STAFF：只读
- 未登录：401

该 API 仅允许父 Collection 类型为 EDITORIAL。Section 商品关联不修改 FeaturedCollectionProduct。

---

## 订单

### 所有订单

GET

/api/v1/admin/orders

支持：

分页

订单号

客户

日期

状态

---

### 订单详情

GET

/api/v1/admin/orders/{id}

---

### 修改订单状态

PATCH

/api/v1/admin/orders/{id}

订单详情中的 OrderItem 返回 `requiresTransfer`。Payment success 令 ACTIVE reservation
成为无超时 confirmed hold；Payment failure/cancel/refund 与 Order CANCELLED 令 ACTIVE
转为 RELEASED；Order COMPLETED 令 ACTIVE 转为 CONSUMED。重复事件只处理 ACTIVE，保持幂等。

`POST /api/v1/internal/reservations/expire` 仅接受正确的 `Authorization: Bearer <CRON_SECRET>`，
将 `expiresAt < now` 的 ACTIVE reservation 转为 EXPIRED。建议外部 scheduler 每 5 分钟调用。

成功响应：

```json
{
  "success": true,
  "data": {
    "transitioned": 0,
    "expiredAt": "2026-09-14T00:00:00.000Z"
  },
  "message": "",
  "error": null
}
```

调用不接受 request body。缺少或错误 Bearer credential 返回 401。重复调用只转换仍为 ACTIVE
且已到期的记录，因此幂等。Production 由独立 AWS Scheduler 以 `rate(5 minutes)` 调用，
retry 1 次、maximum event age 300 秒。

---

## 发货

PATCH

/api/v1/admin/orders/{id}/shipment

内容：

物流公司

运单号

发货日期

状态

---

## Newsletter

- `POST /api/v1/newsletter/subscribe`：`email + consent:true`，允许匿名；幂等订阅并排入
  Resend Contact 同步 Outbox。
- `POST /api/v1/newsletter/unsubscribe`：只接受 signed opaque token；幂等退订并排入
  Resend Contact 同步 Outbox。
- `POST /api/v1/webhooks/resend`：使用 `svix-id`、`svix-timestamp`、`svix-signature` 与
  `RESEND_WEBHOOK_SECRET` 进行官方 SDK 验签；无效签名 401，未配置 503。处理 delivery、
  bounce、complaint、suppression 与 contact unsubscribe 的必要状态，不记录 raw payload。

### Email worker

`POST /api/v1/internal/email/process` 仅接受 `Authorization: Bearer <CRON_SECRET>`，每次
最多 claim 20 条到期 Outbox。Production Email disabled 时返回成功的 `DISABLED` 结果且
不 claim、不发送。Provider 错误按 bounded backoff 标记 FAILED，不回滚 Customer、Order、
Payment 或 Shipment。

### Admin email preview

`/admin/email-preview` 仅 OWNER 可访问，只渲染 Verification、Password Reset、Order
Received、Shipment Sent 模板，不提供任意收件人发送功能。

---

## 后台账号

GET

/api/v1/admin/users

POST

/api/v1/admin/users

PATCH

/api/v1/admin/users/{id}

DELETE

/api/v1/admin/users/{id}

---

## 操作日志

GET

/api/v1/admin/audit-logs

---

# 四、支付 API

统一：

Payment Provider Adapter

支持：

STERA

PAYPAY

STRIPE

---

创建支付

POST

/api/v1/payments/create

Payment Service 和 Adapter factory 使用同一个 Checkout gate。Production 不能通过伪造
provider、直接 POST 或误配 `mock` 使用 Mock Adapter。`live` 在真实 Adapter 完成前不会
fallback 到 Mock。

Supports an optional `idempotencyKey`. Repeated requests with the same key
return the existing Payment; the server always derives the amount from the
Order.

---

支付成功回调

POST

/api/v1/payments/webhook

Mock webhook 同样受 Checkout gate 保护，Production disabled/live-unavailable 状态不会处理
Mock webhook 或更新 Payment / Order。

Webhook requests identify the provider, provider payment ID, and provider event
ID. Signature verification is delegated to the provider adapter. The endpoint
stores a unique provider/event record before applying Payment and Order status
changes, so duplicate deliveries return success without reprocessing.

Webhook は `amount` と `currency`（現在 `JPY`）が local Payment と完全一致する場合だけ
Lifecycle に進む。Adapter の signature verification または Provider-status normalization が失敗した
場合、Payment / Order / InventoryReservation は更新しない。予約が EXPIRED の後に success が届いた
場合は `REQUIRES_REVIEW` とし、注文を PAID にせず、予約を再作成しない。実在 Provider の request
schema、signature、3DS callback、cancel/void、refund API は Provider 契約確定後に Adapter で実装する。

---

取消支付

POST

/api/v1/payments/cancel

---

退款

POST

/api/v1/payments/refund

---

# 五、Smaregi Integration API

## 利用者契約通知

POST

/api/v1/integrations/smaregi/contract

Smaregi Developers の「利用者契約通知先URL」専用の受信エンドポイント。

Request headers：

- `Content-Type: application/json`
- `Smaregi-Contract-Id`: 通知対象の契約ID
- `Smaregi-Event: AppSubscription`

Request body：

- `event`: `AppSubscription`
- `action`: `start` / `end` / `change-plan` / `change-options` / `force-stop` / `cancel-force-stop`
- `date`: `yyyy-mm-dd`
- `contractId`: Header の契約IDと一致すること
- `clientId`
- `plan`
- `options`

正常な通知は必要最小限の非機密情報だけを SyncLog に記録し、3秒以内に空の
response body で HTTP 200 を返す。不正な JSON、Header、payload、または契約ID
の不一致は HTTP 400 を返す。

このエンドポイントはアクセストークンを発行せず、Smaregi API を呼び出さず、
商品・カテゴリ・在庫・注文データを変更しない。

---

## Read-only dry-run

Smaregi 同步预演当前只作为 Service-level 功能，不提供公开 API。
它使用 OAuth client credentials 自动取得短期 Access Token，并在同一
server-side client instance 内缓存 Token。Token 和凭证不进入响应或日志。

Read scope 限定为：

- `pos.stores:read`
- `pos.products:read`
- `pos.stock:read`
- `pos.transactions:read`
- `pos.suppliers:read`

Smaregi 输入：Stores、Categories、Products、Stock。Neon 输入：
Category、Product、InventoryMirror 的必要字段。Repository 只执行
`findMany`，dry-run 不写入 Neon 或 SyncLog。

输出分组：

- categories: `toCreate` / `toUpdate` / `unchanged` / `toDeactivate`
- products: `toCreate` / `toUpdate` / `unchanged` / `toDeactivate`
- inventory: `toCreate` / `toUpdate` / `toZero` / `unchanged`
- storesUsed: 固定批准 Store `1` / `2` / `3` / `6` 中实际存在的 Store
- anomalies: orphan Stock、negative Stock、缺失的批准 Store

差异只包含 Smaregi ID、商品代码、字段名和 before/after 值，
不返回完整数据库对象。

Product dry-run 同时返回 `taxDivision`、`resolvedTaxRate`、
`priceMeaning` 和 `taxResolutionSource`。标准税率来自
`consumption_tax_rates`，轻减税率来自 `reduce_tax_rates`。
不允许固定税率或 silent fallback。

Category 税区分为 null 且 Product 使用 Category 税设置时，Product 以
`CATEGORY_TAX_DIVISION_MISSING` 标记 quarantined。客户明确批准暂缓的 6 个箱代金
Product 在原因完全一致时单独进入 `approvedDeferredProducts`，不进入 Product 或
InventoryMirror write plan，也不计入未知 blocker。其他单商品税异常进入 quarantine，
不阻断 safe Product；全局税率结构异常则整批失败。orphan Stock 不进入 inventory plan。
normal Product 的 negative Stock 会 quarantine 整个 Product，不能写入负 available。

箱代金 Product 不因 `isEcAvailable=false` 从同步输入移除。已批准暂缓的 6 个 Product
只在税率尚不可解析时保留原始原因；税率可唯一解析后正常进入 Product / InventoryMirror
write plan。同步 transaction 仅对明确配置、且 parent / box 都存在于同一已验证 plan 的
一对一关系建立 `boxProductId`，不从名称推断。箱 SKU 本身不可作为公开独立商品，但可由
已关联主商品的 detail DTO 投影为 `ORIGINAL_BOX` 选项。新 Product 默认
`isEcAvailable=false`，不会因同步自动公开。

获批的同步 plan 只能在 Service 完成所有 GET 和验证后交给单一
Prisma transaction。

---

## Production incremental sync (Admin)

POST

/api/v1/admin/integrations/smaregi/sync

- 认证：Admin session
- 权限：OWNER / MANAGER（STAFF 返回 403）
- 并发：已有同步运行时返回 409 `SYNC_ALREADY_RUNNING`
- 执行：只调用 `ProductionSmaregiSyncService.run('ADMIN')`
- Response：统一 API envelope 内返回 create/update/zero、deferred、quarantine、
  known/new orphan、negative 与 warning summary

浏览器不取得 Smaregi credential。

---

## Production incremental sync (protected internal endpoint)

GET

/api/v1/internal/integrations/smaregi/sync

- 认证：`Authorization: Bearer <CRON_SECRET>`
- Secret 缺失或不一致：401
- 并发：已有同步运行时记录 `SKIPPED_ALREADY_RUNNING`，HTTP 200 返回 skipped summary
- 执行：只调用 `ProductionSmaregiSyncService.run('CRON')`
- Runtime：Node.js，route maxDuration 300 秒
- Schedule：Vercel Hobby 不配置 Cron

internal endpoint 和 Admin 共用同一 source validation、quarantine、atomic plan 与 SyncLog
流程。Production Product 读取会记录分页完成状态与完整 source identity set。响应及
SyncLog summary 额外包含 `sourceProductCount`、`sourceIdentityCount`、
`snapshotComplete`、`missingProductMode`、`missingProductCount`、
`missingSafeDeleteCount`、`missingRetireCount`、`missingBlockedCount`、
`deletedProductCount`、`retiredProductCount`、`s3DeleteSuccessCount` 与
`s3DeleteFailureCount`。默认 `report` 只报告且不执行 missing mutation；明确配置 `apply`
后，无业务引用商品 hard delete，有历史/CMS/box 引用商品 retire。任何 Product 分页失败、
timeout、异常空快照或 identity set 不完整都会在 reconciliation 前 fail closed。
逻辑。未来由 AWS EventBridge Scheduler + Lambda 每 15 分钟调用该 endpoint；AWS 资源与
production `CRON_SECRET` 另行配置。Secret 未配置时请求仍拒绝，不会跳过认证。

---

网站调用：

商品同步

POST

/api/v1/system/sync/products

---

库存同步

POST

/api/v1/system/sync/inventory

---

价格同步

POST

/api/v1/system/sync/prices

---

订单同步

POST

/api/v1/system/sync/orders

---

顾客同步（预留）

POST

/api/v1/system/sync/customers

---

# 六、Webhook

## Payment

支付成功

↓

订单更新

↓

库存检查

↓

同步 Smaregi

---

## Smaregi

商品更新

↓

Website

---

库存变化

↓

Website

---

价格变化

↓

Website

---

# 七、权限

游客：

商品

分类

首页

搜索

---

会员：

购物车

下单

订单

个人资料

---

STAFF：

订单

发货

---

MANAGER：

商品

专题

订单

发货

---

OWNER：

全部权限

---

# 八、安全

JWT Authentication

HTTPS

CSRF Protection

Rate Limit

Request Validation

SQL Injection Protection

XSS Protection

文件上传限制

API Audit Log

---

# 九、开发规范

所有接口：

必须：

Server Action

或

Route Handler

统一：

TypeScript

统一：

Zod Validation

统一：

Prisma

统一：

Repository Pattern

统一：

Service Layer

禁止：

Route 中直接操作数据库。

---

# 十、开发顺序

Sprint 1

Products API

Categories API

---

Sprint 2

Orders API

Payments API

---

Sprint 3

Shipment API

Admin API

---

Sprint 4

Smaregi Integration

---

Sprint 5

Payment Integration

---

---

# Database Health API

## GET /api/v1/health/database

用途：

用于开发、部署及监控过程中确认应用是否能够正常连接 PostgreSQL。

该接口不用于业务处理。

### Authentication

当前开发阶段允许公开访问。

正式生产环境后，可根据监控方案决定是否限制访问。

### Success Response

HTTP 200

```json
{
  "success": true,
  "data": {
    "database": "connected",
    "timestamp": "2026-08-09T00:00:00.000Z",
    "version": "v1"
  },
  "message": "",
  "error": null
}
本文件作为整个项目 API 开发唯一标准，所有后续开发必须遵循本规范。
```
