# Operations Runbook

Production operations は `/admin/operations` で確認する。Dashboard は read-only であり、同期、メール、
reservation または payment を再実行しない。

## Smaregi Sync: CRITICAL

1. 最終 successful sync 時刻と直近の SyncLog summary を確認する。
2. `FAILED`、unknown store、duplicate identity、fatal anomaly を区別する。approved deferred box と known
   orphan は単独で CRITICAL ではない。
3. 自動 scheduler を連続手動実行しない。snapshot の完全性、Smaregi credentials、AWS Lambda/Vercel status を
   確認してから、運用承認済みの手動 sync 手順だけを使う。
4. Smaregi に write しない。

## Reservation Worker: CRITICAL

1. expired `ACTIVE` reservation の backlog と最終 worker success を確認する。
2. worker auth、AWS scheduler、Vercel endpoint を確認する。
3. payment の成功を理由に reservation を手動で再確保しない。Payment `REQUIRES_REVIEW` は別途人工照合する。

## Email Worker: CRITICAL

1. terminal transactional failure と newsletter contact sync failure を区別する。
2. `PENDING`、stuck `SENDING`、`FAILED` の件数、EmailOutbox の retry 状態、Resend configuration / provider logs を
   確認する。
3. recipient、raw payload、verification/reset token を Dashboard、logs、チケットに転記しない。
4. newsletter mirror の失敗は Customer/Newsletter source-of-truth を rollback しない。

## Payment REQUIRES_REVIEW

1. 対象 Payment と Order の最小必要情報を Admin Order で確認する。
2. reservation が expired 後の success を自動で hold/consume しない。
3. 在庫、支払 provider、顧客対応を人手で照合してから既存の承認済み運用手順に従う。

## Contact delivery failure

`CONTACT_INQUIRY` は transactional email として扱う。EmailOutbox と Resend delivery event を確認し、
Contact request を再送・再作成する前に duplicate event key と provider idempotency を確認する。

## External blockers

- STERA production specification / credentials
- approved Sagawa shipping tariff
- final legal copy
- `linxas-fukuoka.com` registrar / DNS recovery

Production smoke と operations verification は、上記 domain blocker が解消するまで
`https://sake-shop.vercel.app` を使用する。
