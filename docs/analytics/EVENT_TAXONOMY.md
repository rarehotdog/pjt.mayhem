# EVENT_TAXONOMY

## 1. 목적
운명스냅 퍼널/리텐션/광고성과를 스테이징에서 동일한 스키마로 수집한다.

## 2. 공통 필드 (필수)
모든 이벤트는 아래 필드를 포함해야 한다.

- `event_name`
- `event_time` (ISO)
- `event_id`
- `session_id`
- `page_path`
- `source_channel`
- `consent_marketing`

## 3. 공통 attribution 필드
가능한 경우 아래 필드를 payload/column에 포함한다.

- `campaign_id`
- `click_source`
- `partition`
- `ua_creative_topic`
- `utm_source`
- `source`
- `mode`

## 4. 결제 표준 필드
결제 관련 이벤트 payload는 아래 키를 표준으로 사용한다.

- `report_id`
- `product_code`
- `amount_krw`
- `order_id`
- `payment_status`

## 5. 이벤트 분류

### Product Funnel
- `landing_viewed`
- `quiz_started`
- `quiz_completed`
- `preview_viewed`
- `paywall_clicked`
- `payment_create_requested`
- `payment_webview_opened` (mock 결제 시 `simulated=true`)
- `payment_confirmed`
- `payment_failed`
- `full_report_viewed`
- `share_card_created`
- `invite_link_created`
- `invite_redeemed`
- `daily_viewed`

### System
- `session_started`
- `consent_updated`
- `telemetry_delivery_failed`

## 6. Destination 라우팅 규칙

- Amplitude: 모든 이벤트 전송 시도
- Meta: `event_type=marketing` AND `consent_marketing=true` 인 경우만 전송
- Meta 매핑:
  - `preview_viewed` -> `ViewContent`
  - `payment_create_requested` -> `InitiateCheckout`
  - `payment_confirmed` -> `Purchase`

## 7. 실패 처리

- 외부 전송 실패는 `event_delivery_logs`에 기록
- `telemetry_events.delivery_*`, `retry_count` 갱신
- 실패시 시스템 이벤트 `telemetry_delivery_failed` 저장

## 8. 중복 방지

- 클라이언트: dedupe key + 짧은 TTL
- 서버: `event_id` PK 기준 idempotency
