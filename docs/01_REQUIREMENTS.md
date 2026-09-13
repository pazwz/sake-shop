# 酒类 EC 项目 - 客户需求（Requirements）

Version: 1.0

Last Update: 2026-08-08

---

# 一、项目目标

开发一套面向日本市场的高端酒类 EC 网站。

定位：

- 高端
- 简洁
- 编辑风格（Editorial）
- 白色基调
- 后续支持后台管理
- 支持实体店 + EC 一体化

---

# 二、已确认事项

## 1. 店铺

✅ 已有实体店

---

## 2. 酒类销售资格

✅ 已取得

通信販売酒類小売業免許

---

## 3. POS

使用：

スマレジ

套餐：

リテールビジネス

---

## 4. 库存

客户希望：

实体店

-

EC

共用库存

---

## 5. 支付

客户：

线下：

stera / PAYGATE

线上：

等待银行确认

预计：

stera EC

真实 Online Payment 上线前，Production Checkout 必须 fail closed，不得使用 Mock
Payment 创建 Order、OrderItem、Payment 或 InventoryReservation。Cart 和 Checkout 页面
可以访问，但 Production 只显示准备中状态。Mock Checkout 仅限 local development，或由
Preview 环境显式配置；Production 即使误配 `mock` 也必须拒绝。

Customer 登录必须使用服务端 HttpOnly opaque session，浏览器存储不得作为身份依据。
Checkout 的 customerId 只能来自该 session。消费者订单列表与详情必须在数据库查询中按
Customer ownership 限定；他人订单与不存在订单均返回 404。订单创建的 ACTIVE reservation
默认 30 分钟到期，支付成功确认 hold，支付失败/取消释放，履约完成后消费。

---

## 6. 配送

物流：

佐川

运费：

不包邮

---

## 7. SNS

目前：

Instagram

小红书

---

# 三、网站功能

## 前台

首页

商品分类

商品详情

购物车

Checkout

会员

订单查询

搜索

---

## 商品

### Admin 商品管理

后台商品列表必须同时显示 Smaregi 同步商品与既有商品，并支持商品名、商品代码、
Smaregi Product ID、Category、EC 公開状态及数据来源筛选。默认每页 25 件。

Smaregi 管理的商品名、商品代码、Category、价格、有效状态、同步时间和四店库存为
只读。LINXAS Admin 只可编辑 slug、商品说明、tasting notes、生产者、产地、容量、
酒精度、商品图片和 EC 公開状态。OWNER / MANAGER 可修改；STAFF 只可查看列表。

非公開商品只有在 Smaregi 商品有效、价格大于 0、slug 合法且唯一、至少有一张图片、
且同步来源有效时才可公开。说明和库存为 0 只显示 warning，不阻止公开。

公开商品查询、搜索、直接详情、首页及 Collection 均必须同时满足
`isActive=true` 与 `isEcAvailable=true`。

消费者商品列表使用数据库分页，默认每页 24 件，只允许切换 24 / 48 / 96 件。
`page`、`perPage` 与搜索、顶层商品分组、内部 Category、排序参数共同保存在 URL；
筛选、排序或每页数量改变时回到第一页，超出结果范围的页码规范化到最后一页。

箱・包装専用 SKU は独立商品ではなく、公開商品一覧、検索、推薦、Collection、
Seasonal、サイトマップおよび直接商品詳細から常に除外する。通常商品は同期済みの
箱 Product を任意で一件だけ参照できる。箱は Smaregi の価格・税率・四店在庫を使い、
在庫がある場合に限り商品詳細で追加選択できる。カートでは酒本体の配下に表示し、
注文時は酒本体と箱を別々の OrderItem / InventoryReservation として同一 transaction
で確保する。箱だけの注文は禁止する。

送料・手数料・サービス専用 SKU も独立商品ではなく、EC 公開および公開商品查询の
対象外とする。対象は確認済み Smaregi identity の明示 allow/deny 設定で管理し、名称の
部分一致だけで通常商品を除外しない。

OWNER / MANAGER は Admin 商品編集画面から短時間の署名付き URL を発行し、現在の
Admin session を保持したまま非公開商品の実商品詳細 UI を確認できる。preview token
単体ではアクセスできず、一般利用者および STAFF は利用できない。

トップナビゲーションは実在し、公開可能な独立商品を持つ Category だけを動的に
メガメニューへ表示する。固定の存在しない小分類を作らず、特集入口は公開中の
FeaturedCollection の既存 URL を使用する。

Collection の公開入口と详情页必须共用同一公开条件：状态为 PUBLISHED，且当前时间位于
publishStartAt / publishEndAt 范围内。不存在、未公开或尚未/不再有效的 Collection 不生成
Header、首页或其他消费者入口，直接访问仍返回 404。

`/admin/collections` はトップページで現在使用する内容だけを管理する。Story は現在公開中の
全件を displayOrder 順でトップページと管理画面に表示し、固定件数で切り捨てない。全
Editorial / Story 本体は独立した「特集・ストーリー管理」一覧から同じ FeaturedCollection
记录を編集できる。

Collection の掲載商品候補は active、EC 公開中かつ独立販売可能な Product に限る。在庫 0 は
候補から除外せず、既存関連も維持する。既に関連済みの商品が後から非公開・販売終了になった
場合は自動削除せず Admin に警告し、新規追加だけを API 层でも拒否する。候補选择支持商品名、
producer、商品代码搜索和实际 Category 筛选，筛选切换不得清除已选择 ID。

支持：

大分类

↓

小分类

例如：

日本酒

↓

纯米

↓

纯米吟酿

↓

大吟酿

---

## 首页

客户要求：

Hero

四季推荐

专题推荐

店主推荐

Gift

Story

---

## 四季

Spring

Summer

Autumn

Winter

每个季节：

独立图片

独立文案

独立商品

后台可修改。

---

## Footer

包含：

Customer Support

Newsletter

Follow Us

---

Newsletter

按钮

↓

登录

↓

注册

Demo

---

# 四、后台

客户可管理：

Hero

专题推荐

四季推荐

Banner

商品推荐

图片

文字

排序

上下架

---

订单

查看

发货

运单号

状态

---

商品

同步

图片

分类

库存查看

---

# 五、支付

计划：

信用卡

PayPay

stera EC（待确认）

---

# 六、スマレジ

计划：

商品同步

库存同步

订单同步（待确认）

价格同步

Production 商品・Category・四店库存必须支持每 15 分钟的增量同步及 OWNER / MANAGER
手动立即同步。两个入口共用同一全局锁、异常分类、原子写入与 SyncLog；Smaregi
始终只读。单商品税/负库存异常隔离，source identity、Store 集合、全局税率或 plan
不一致时整批停止。新增商品默认 `isEcAvailable=false`，既有 LINXAS-owned 字段不得覆盖。
定时调用由外部 Scheduler 经受保护的 internal endpoint 触发；Vercel Hobby 本身不配置
Cron。AWS EventBridge Scheduler / Lambda 属于后续独立部署范围。

---

# 七、对象存储

商品图片

Banner

Hero

专题推荐图片

运单附件

统一对象存储。

---

# 八、后续

AWS

数据库

后台

支付

正式上线
