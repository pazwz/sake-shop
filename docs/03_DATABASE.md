# 酒类 EC 系统数据库设计

Version: 1.0

Last Update: 2026-08-14

---

# 一、设计原则

## 主数据原则

### スマレジ负责

- 商品
- 分类
- 价格
- 库存
- POS销售

网站不允许维护第二套商品数据。

网站数据库保存的是：

**Smaregi Mirror（镜像数据）**

---

### Website负责

网站负责所有 EC 业务。

包括：

- 首页
- Hero
- Banner
- 四季推荐
- 专题
- 商品图片
- 商品说明
- 顾客
- 地址
- 订单
- 支付
- 发货
- 后台
- Newsletter

---

# 二、数据库列表

| Table                        | 用途                   |
| ---------------------------- | ---------------------- |
| categories                   | 商品分类               |
| products                     | 商品镜像               |
| product_images               | 商品图片               |
| inventory_mirror             | 库存镜像               |
| inventory_reservations       | EC 商品级库存预留      |
| customers                    | 顾客                   |
| customer_addresses           | 收货地址               |
| orders                       | 订单                   |
| order_items                  | 订单商品               |
| payments                     | 支付                   |
| shipments                    | 配送                   |
| featured_collections         | 专题                   |
| featured_collection_products | 专题商品               |
| editorial_sections           | Editorial 专题文章段落 |
| admin_users                  | 后台用户               |
| audit_logs                   | 操作日志               |
| sync_logs                    | API同步日志            |
| email_verification_tokens    | 邮箱验证 token hash    |
| password_reset_tokens        | 密码重置 token hash    |
| email_outbox                 | 异步邮件投递队列       |
| email_webhook_events         | Resend webhook 去重    |
| newsletter_subscriptions     | Newsletter consent     |

---

# 三、数据关系

Category

↓

Product

↓

ProductImage

↓

InventoryMirror

---

Customer

CustomerSession（opaque token hash、customer_id、expires_at、revoked_at）

↓

Address

↓

Order

↓

OrderItem

↓

Payment

↓

Shipment

---

FeaturedCollection

↓

FeaturedCollectionProduct

↓

Product

---

AdminUser

↓

AuditLog

---

SyncLog

---

# 四、Table Design

---

## categories

用途：

商品分类。

支持无限级分类。

例如：

日本酒

↓

纯米酒

↓

纯米吟酿

字段：

id

smaregi_category_id

parent_id

name

slug

display_order

is_active

created_at

updated_at

Index

smaregi_category_id

parent_id

slug

---

## products

用途：

商品镜像。

Smaregi

↓

同步

↓

Website

字段：

id

smaregi_product_id

category_id

product_code

jan_code

name

slug

price

tax_rate

producer

origin

volume

alcohol_percentage

description

tasting_notes

box_product_id（nullable / unique / products self relation）

is_active

is_ec_available

last_synced_at

created_at

updated_at

字段所有权：

- Smaregi-owned：smaregi_product_id、category_id、product_code、jan_code、name、
  price、tax_rate、is_active、last_synced_at、InventoryMirror。
- LINXAS-owned：slug、producer、origin、volume、alcohol_percentage、description、
  tasting_notes、is_ec_available、box_product_id、ProductImage 及 CMS 关联。

Admin 编辑必须保护 Smaregi-owned 字段。`box_product_id` 只能指向 Smaregi 同期済みの
package-only Product；`ON DELETE SET NULL` で通常商品のリンクだけを解除する。

Index

smaregi_product_id

product_code

category_id

slug

---

## product_images

用途：

商品图片。

图片存放：

AWS S3

数据库保存URL。

字段：

id

product_id

image_url

image_type

display_order

alt_text

created_at

---

## inventory_mirror

用途：

库存镜像。

不作为库存主数据。

字段：

id

product_id

smaregi_store_id

quantity

reserved_quantity

available_quantity

last_synced_at

created_at

updated_at

每行表示一个 Smaregi Store 的原始物理库存镜像。批准的 EC 库存来源为 Store
`1`、`2`、`3`、`6`；聚合只发生在 Service / 查询层。`quantity` 可以保留
Smaregi 返回的负数，`available_quantity` 不得为负。

`reserved_quantity` 与 `available_quantity` 是旧的 Store 级兼容字段。EC 商品可售量
不得使用或累加这两个字段；正式 reservation 来源仅为 ACTIVE
`inventory_reservations`。

---

## inventory_reservations

用途：

LINXAS EC 商品级临时库存占用，不绑定 Smaregi Store。

字段：

id

product_id

order_id

order_item_id（unique）

quantity（数据库约束 > 0）

status（ACTIVE / RELEASED / CONSUMED / EXPIRED）

expires_at（nullable）

created_at

updated_at

同一 OrderItem 最多一条 reservation。只有 ACTIVE 状态参与可售库存汇总；其他状态
保留历史但不再占用库存。未支付 ACTIVE 有 expires_at；支付确认后的 ACTIVE 将其清空，
直到 RELEASED 或 CONSUMED。Product、Order、OrderItem 均使用 Restrict 外键。

---

## order_items.requires_transfer

下单时的履约快照。Store `1` 在扣除既有商品级 ACTIVE reservation 后不足以直接
满足该订单行时为 true。该字段不表示自动仓库分配，也不新增订单状态。

## order_items.parent_order_item_id

箱オプション OrderItem が対応する酒本体 OrderItem を参照する nullable / unique の
self relation。箱は独立した product_id、product_code、unit_price、tax_rate、quantity
を保持し、数量は Service により親商品と同一に固定する。通常の酒商品行は null。

---

## customers

`password_hash` nullable，用于兼容认证功能上线前的历史 Customer；新注册 Customer 必须
写 bcrypt hash。明文密码不得保存。`email_verified_at` nullable；既存 Customer 不会因
migration 自动标记已验证。

## customer_sessions

只保存高熵 opaque token 的 SHA-256 hash。`token_hash` unique，并按 customer_id 与
expires_at 建索引。logout 设置 revoked_at，过期或撤销记录不能建立当前身份。

用途：

EC会员。

字段：

id

email

username（任意、unique）

后台正式登录优先使用 username。为兼容现有管理员，username 暂时允许为空，
历史 email 登录仅作为过渡 fallback。

password_hash

name

name_kana

phone

birthday

age_confirmed

smaregi_customer_id

created_at

updated_at

Unique

email

---

## email_verification_tokens / password_reset_tokens

只保存 action token 的 SHA-256 hash、Customer、有效期限与 used_at。raw token 不入库。
验证、密码更新与 session revoke 由 transaction 保证原子性。

## email_outbox / email_webhook_events

EmailOutbox 以 `event_key` 去重业务事件，记录 template、最小 payload、状态、attempt、
next_attempt_at、provider message id 与 delivery state。不得保存 password、raw token、
API key 或 Payment internal metadata。Webhook event 仅保存 provider event id、type 与 raw
payload hash，provider event id unique。

## newsletter_subscriptions

email unique，保存明确 consent 时间、状态、退订时间、来源、Resend contact mirror id 与
signed unsubscribe token hash。Customer 与 NewsletterSubscription 不建立隐式订阅关系。

---

## customer_addresses

用途：

收货地址。

支持多个地址。

字段：

id

customer_id

postal_code

prefecture

city

address1

address2

recipient_name

phone

is_default

created_at

updated_at

---

## orders

用途：

订单。

字段：

id

order_number

customer_id

status

payment_status

shipment_status

subtotal

shipping_fee

tax_amount

discount_amount

total_amount

payment_method

shipping_address_snapshot

shipping_quote_snapshot（nullable JSON；既存订单允许为空，新订单保存 server-side 送料规则、
base/cool/remote fee、method、carrier 与 policy version 的不可变快照）

smaregi_order_id

smaregi_sync_status

ordered_at

created_at

updated_at

Index

order_number

customer_id

status

---

## order_items

用途：

订单商品。

保存商品快照。

字段：

id

order_id

product_id

product_name

product_code

unit_price

quantity

tax_rate

subtotal

created_at

---

## payments

用途：

支付。

字段：

id

order_id

provider

provider_payment_id

status

amount

paid_at

failed_at

cancelled_at

created_at

updated_at

Provider

STERA

PAYPAY

STRIPE

---

## Payment idempotency

`payments.idempotency_key` is nullable and unique. It makes repeated payment
creation requests return the existing payment rather than creating another one.
`payments` also uses the composite unique constraint `(provider,
provider_payment_id)`, allowing the same provider payment ID in different
provider namespaces while preventing duplicates within one provider.

`payment_webhook_events` stores the provider, provider event ID, related
payment, SHA-256 payload hash, and processing timestamp. The unique
`(provider, event_id)` constraint is the final database-level protection for
webhook idempotency and concurrent delivery.

## shipments

用途：

配送。

字段：

id

order_id

carrier

tracking_number

shipping_method

status

label_file_url

shipped_at

delivered_at

created_at

updated_at

Carrier

SAGAWA

YAMATO

JP_POST

---

## featured_collections

用途：

首页专题。

统一管理：

Hero

Banner

四季推荐

店长推荐

Gift

Story

字段：

id

type

season

title

subtitle

description

desktop_image_url

mobile_image_url

status

publish_start_at

publish_end_at

display_order

created_by

created_at

updated_at

Type

HERO

SEASONAL

SHOPKEEPER

GIFT

EDITORIAL

Season

SPRING

SUMMER

AUTUMN

WINTER

---

## featured_collection_products

用途：

专题推荐商品。

字段：

id

featured_collection_id

product_id

display_order

created_at

---

## editorial_sections

用途：

仅保存 EDITORIAL Collection 的有序文章段落。

字段：

id

collection_id

product_id（任意；每段最多一个重点商品）

title

body

image_url（任意）

display_order

created_at

updated_at

规则：

- Section 只能由 Service 关联到 EDITORIAL 类型的 FeaturedCollection。
- Section 的重点商品不改变 FeaturedCollectionProduct；专题末尾商品列表仍只使用 FeaturedCollectionProduct。
- Product 删除时 product_id 设为 null，文章正文和图片保留。
- 没有 Section 的旧 Editorial 继续使用 description 与 FeaturedCollectionProduct。

---

## admin_users

用途：

后台账号。

字段：

id

email

password_hash

Current database design allows this field to be nullable. A null value means
the administrator has not set a password and must be denied password login.

name

role

is_active

last_login_at

created_at

updated_at

Role

OWNER

MANAGER

STAFF

---

## audit_logs

用途：

后台操作日志。

字段：

id

admin_user_id

action

entity_type

entity_id

before_data

after_data

ip_address

created_at

---

## sync_logs

用途：

Smaregi同步日志。

字段：

id

system

entity_type

entity_id

direction

action

status

request_payload

response_payload

error_message

retry_count

started_at

completed_at

created_at

Direction

SMAREGI_TO_WEBSITE

WEBSITE_TO_SMAREGI

Status

SUCCESS

FAILED

RETRY

---

# 五、数据库约束

所有表：

必须包含：

created_at

updated_at

所有删除：

原则：

Soft Delete

原则上禁止物理删除。唯一批准的例外是 production Smaregi 完整 Product snapshot 已明确
确认 source missing，且 Product 没有 OrderItem、InventoryReservation、Collection、
Editorial、box relation 或其他业务引用时，可由自动同步在单一 transaction 中物理删除其
ProductImage、InventoryMirror 与 Product。存在任何业务引用时必须 RETIRE，不得物理删除。

---

# 六、图片策略

数据库：

只保存URL。

图片统一保存在：

AWS S3

包括：

商品图片

Hero

Banner

专题推荐

后台上传图片

物流附件

---

# 七、同步原则

Smaregi

↓

Platform API

↓

Website Database

↓

Frontend

订单：

Website

↓

Database

↓

Smaregi

库存：

以Smaregi为准。

网站不得修改库存。

---

# 八、未来扩展

支持：

优惠券

积分

礼品卡

会员等级

预约商品

预售商品

多门店

多语言

海外配送

OMS

CRM

BI分析

全部兼容当前数据库设计。
