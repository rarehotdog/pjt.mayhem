# KPI_DASHBOARD_SPEC

## 1. Amplitude 프로젝트

- Staging: `AMPLITUDE_API_KEY_STAGING`
- Production: `AMPLITUDE_API_KEY`
- 식별자: `session_id`

## 2. 필수 차트

1. Landing -> Quiz Start 전환율
- 분자: `quiz_started`
- 분모: `landing_viewed`
- 목표: `>= 45%`

2. Quiz Complete -> Preview View 전환율
- 분자: `preview_viewed`
- 분모: `quiz_completed`

3. Preview -> Paywall Click 전환율
- 분자: `paywall_clicked`
- 분모: `preview_viewed`
- 목표: `>= 18%`

4. Payment Requested -> Payment Confirmed 전환율
- 분자: `payment_confirmed`
- 분모: `payment_create_requested`
- 목표: `>= 70%`

5. Share Card Created 비율
- 분자: `share_card_created`
- 분모: `full_report_viewed`
- 목표: `>= 25%`

6. Invite Redeemed 비율
- 분자: `invite_redeemed`
- 분모: `invite_link_created`

7. D1/D7 Retention (Cohort)
- 시작 이벤트: `session_started`
- 리턴 이벤트: `daily_viewed` 또는 `landing_viewed`
- 목표: D1 `>= 28%`, D7 `>= 12%`

## 3. 분해 기준 (Breakdown)

아래 차트는 공통적으로 breakdown 추가:

- `campaign_id`
- `partition`
- `click_source`
- `source`
- `mode`

## 4. Meta Test 측정

- 전송 조건: `consent_marketing=true`
- 이벤트:
  - `ViewContent` (`preview_viewed`)
  - `InitiateCheckout` (`payment_create_requested`)
  - `Purchase` (`payment_confirmed`)
- Pixel: `META_TEST_PIXEL_ID`
- Test code: `META_TEST_EVENT_CODE`

## 5. SQL Spot Check 쿼리

```sql
-- 최근 24시간 퍼널 카운트
select event_name, count(*)
from telemetry_events
where event_time >= now() - interval '24 hours'
  and event_name in (
    'landing_viewed','quiz_started','quiz_completed','preview_viewed',
    'paywall_clicked','payment_create_requested','payment_confirmed'
  )
group by event_name
order by event_name;
```

```sql
-- destination 실패율
select destination,
       count(*) filter (where status='failed')::float / nullif(count(*),0) as failed_rate
from event_delivery_logs
where created_at >= now() - interval '24 hours'
group by destination;
```
