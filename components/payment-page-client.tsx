"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { trackClientEvent } from "@/lib/client-telemetry";

const PLANS = [
  { code: "single_990", title: "첫 해설 단건", price: 990, desc: "오늘 리포트 즉시 오픈" },
  { code: "premium_monthly_4900", title: "프리미엄 구독", price: 4900, desc: "월간 리포트 + 데일리 강화" },
  { code: "special_2900", title: "특집 리포트", price: 2900, desc: "시즌 운세/분기 리포트" }
] as const;

type PlanCode = (typeof PLANS)[number]["code"];

export function PaymentPageClient({ reportId }: { reportId: string }) {
  const router = useRouter();

  const [selected, setSelected] = useState<PlanCode>("single_990");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => PLANS.find((plan) => plan.code === selected) ?? PLANS[0],
    [selected]
  );

  async function handlePay() {
    if (!reportId) {
      setError("reportId가 누락되었습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const createRes = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `pay-${reportId}-${selected}`
        },
        body: JSON.stringify({
          reportId,
          productCode: selected
        })
      });

      if (!createRes.ok) {
        throw new Error("결제 주문 생성 실패");
      }

      const createJson = (await createRes.json()) as {
        order: { orderId: string };
      };

      trackClientEvent({
        eventName: "payment_webview_opened",
        eventType: "product",
        pagePath: "/payment",
        payload: {
          report_id: reportId,
          order_id: createJson.order.orderId,
          product_code: selected,
          amount_krw: selectedPlan.price,
          simulated: true
        }
      });

      const confirmRes = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createJson.order.orderId,
          status: "paid"
        })
      });

      if (!confirmRes.ok) {
        throw new Error("결제 승인 실패");
      }

      router.replace(`/report/${reportId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "결제 중 오류가 발생했습니다.";
      setError(message);
      trackClientEvent({
        eventName: "payment_failed",
        eventType: "product",
        pagePath: "/payment",
        payload: {
          report_id: reportId,
          product_code: selected,
          amount_krw: selectedPlan.price,
          payment_status: "failed",
          message
        }
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-6 pb-14 pt-8">
      <h1 className="font-[var(--font-title)] text-3xl font-extrabold tracking-tight text-ink">
        결제하기
      </h1>
      <p className="mt-2 text-sm text-ink/70">카드/카카오페이/네이버페이 연동을 가정한 PortOne 결제 흐름입니다.</p>

      <section className="mt-6 grid gap-3">
        {PLANS.map((plan) => (
          <button
            key={plan.code}
            type="button"
            onClick={() => setSelected(plan.code)}
            className={`section-card p-4 text-left ${
              selected === plan.code ? "border-coral ring-2 ring-coral/40" : ""
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">{plan.title}</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-ink">
              {plan.price.toLocaleString("ko-KR")}원
            </p>
            <p className="mt-1 text-sm text-ink/70">{plan.desc}</p>
          </button>
        ))}
      </section>

      {error ? (
        <section className="mt-5 rounded-2xl border border-coral/30 bg-coral/10 p-4">
          <p className="text-sm font-semibold text-coral">{error}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handlePay}
              className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              홈으로
            </button>
          </div>
        </section>
      ) : null}

      <button
        disabled={loading}
        type="button"
        onClick={handlePay}
        className="mt-6 w-full rounded-2xl bg-coral px-4 py-4 text-base font-extrabold text-cream disabled:opacity-50"
      >
        {loading ? "결제 처리 중..." : `${selectedPlan.price.toLocaleString("ko-KR")}원 결제하고 열기`}
      </button>

      <p className="mt-3 text-xs text-ink/55">결제 실패 시 결제 수단 변경/재시도 UX를 추가 확장할 수 있습니다.</p>
    </main>
  );
}
