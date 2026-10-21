import { noStoreJson } from "@/lib/http";

/**
 * The e-mail based census ("mühür") and password sign-up are closed. Accounts
 * are now created with SMS verification at /uye-ol and each account casts one
 * permanent team vote. Old census rows are kept untouched; see docs/data-policy.md.
 */
function gone() {
  return noStoreJson(
    {
      error: "Bu kayıt yolu kapandı. Telefonunu SMS ile doğrulayarak üye ol.",
      next: "/uye-ol",
    },
    410,
  );
}

export const GET = gone;
export const POST = gone;
