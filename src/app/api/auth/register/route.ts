import { noStoreJson } from "@/lib/http";

/**
 * The e-mail based census ("mühür") and password sign-up are closed. Accounts
 * are now created with code verification (e-mail or SMS) at /uye-ol and each account casts one
 * permanent team vote. Old census rows are kept untouched; see docs/data-policy.md.
 */
function gone() {
  return noStoreJson(
    {
      error: "Bu kayıt yolu kapandı. Üye ol sayfasından kodla doğrulayarak üye ol.",
      next: "/uye-ol",
    },
    410,
  );
}

export const GET = gone;
export const POST = gone;
