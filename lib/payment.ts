import type { PaymentProductCode } from "@/lib/types";

export const PRODUCT_PRICE: Record<PaymentProductCode, number> = {
  single_990: 990,
  premium_monthly_4900: 4900,
  special_2900: 2900
};

export const PRODUCT_LABEL: Record<PaymentProductCode, string> = {
  single_990: "첫 해설 990원",
  premium_monthly_4900: "프리미엄 월 4,900원",
  special_2900: "특집 리포트 2,900원"
};

export function getProductPrice(productCode: PaymentProductCode): number {
  return PRODUCT_PRICE[productCode];
}
