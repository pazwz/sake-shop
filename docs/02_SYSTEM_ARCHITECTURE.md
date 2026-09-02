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
税率无法解析时将商品标记为 blocked，不进入写入 plan。唯一の例外是、客户批准済みの
箱代金 Product 6 件が `CATEGORY_TAX_DIVISION_MISSING` となる場合で、これらは
`approvedDeferredProducts` に分離し、Product / InventoryMirror plan から除外する。
対象 ID または理由が一致しない税率異常は従来どおり fail closed とする。

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
InventoryMirror，也不阻断其余同步。负库存保留在每店物理镜像与 dry-run anomaly
中；EC available 只在业务层 clamp 到非负，不改写 Smaregi 原始 stockAmount。

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
