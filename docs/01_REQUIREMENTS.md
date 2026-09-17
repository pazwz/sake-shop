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

新注册 Customer 同时建立 email verification token 与 EmailOutbox，但在邮箱确认前不得
建立 CustomerSession 或登录。验证成功时以一次性 token 在同一 transaction 写
emailVerifiedAt、失效其余验证 token、建立首个 Session。验证 token、password reset token
与 Newsletter 退订 token 的 raw value 禁止保存或记录；数据库只保存 hash。密码修改撤销
全部旧 Session 并轮换当前设备 Session；密码重置撤销全部 Session。邮件 Provider 为 Resend，
但业务 transaction 只能写 EmailOutbox，不能在 transaction 内调用外部邮件 API。

Payment Provider の原始状態は LINXAS PaymentStatus に直接保存してはならない。Adapter は
webhook を検証して Provider outcome を正規化し、その後に唯一の Payment Lifecycle が
Payment、Order、InventoryReservation を更新する。Payment は JPY の amount/currency を
保存し、不一致 webhook は fail closed とする。予約が EXPIRED 後に届く payment success は
在庫を再確保・注文確定せず、`REQUIRES_REVIEW` で人工照合を待つ。

My Page 提供会員情報、注文履歴、お届け先、メール配信設定、セキュリティ与 Logout。
CustomerAddress 的 CRUD 必须按 Session customerId 限定，并通过 Customer 行锁保证同一会员
最多一个默认地址；删除默认地址时按最早建立的剩余地址补位。NewsletterSubscription 是
配信 consent 的 Source of Truth，Resend Contact 仅是异步 mirror，其失败不能回滚 Neon 偏好。

公开的 `/contact` 表单只用于支持咨询，不会直接变更订单、付款、配送或库存。提交内容经严格
server-side validation 后仅创建去重的 `EmailOutbox` 记录，由既有异步 worker 投递至固定的
server-side 支持收件箱；浏览器不得指定收件人，来信邮箱仅作为 Reply-To。若
`CONTACT_RECIPIENT_EMAIL` 未配置，表单必须 fail closed 并提示电话咨询。表单包含 same-origin、
honeypot、长度限制和最小 rate limit；进程内 rate limit 在多 Vercel 实例间不共享，正式高流量
上线前需要迁移至共享 rate-limit 存储。

---

## 6. 配送

物流：

佐川

运费：

不包邮

Checkout 不接受客户端提交的送料。Server 必须根据配送都道府県、商品、数量、包装类型、
クール便要否与小计，通过单一 ShippingQuoteService 计算送料，并在 Order 保存不可变的
送料规则快照。正式佐川料金表、クール便与離島规则获批前，未配置的配送条件必须 fail
closed；开发期固定金额不得标记为正式送料。

---

## 7. SNS

目前：

Instagram

小红书

---

## 8. 法律・ポリシー

公开网站必须提供特定商取引法、プライバシーポリシー、利用規約、配送・返品页面，并从
Footer 可达。必须展示「20歳未満の者の飲酒は法律で禁止されています。」及
「通信販売酒類小売業免許取得済」。销售主体、负责人、正式所在地、送料、支付、交付、
返品等未获客户确认的信息不得虚构，须在上线前明确标记为待确认并替换为正式内容。

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
`isActive=true`、`isEcAvailable=true` 与 `isManuallyHidden=false`。后台 EC 公開状态统一显示为
EC販売中、公開準備中、非公開、EC販売対象外或販売終了；手动非公開与缺少公开条件的
公開準備中不得混用。

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

允许匿名 email 主动订阅，也允许注册时通过默认未勾选的 opt-in 主动订阅。
Customer Account 与 NewsletterSubscription 必须独立；既存 Customer 不得自动加入。
Neon 的 NewsletterSubscription 是 consent source of truth，Resend Contact 只作为投递镜像。
退订必须使用 signed opaque token，不能只依赖 query email。

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
