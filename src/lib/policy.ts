export const CONSENT_VERSION = "2026-09-02";
/** Current census poll. Votes always carry poll_id so more polls can be added later. */
export const CURRENT_POLL_ID = "turkiye-sayim-2026";
export const IP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_PER_PHONE_HOUR = 3;
export const OTP_PER_PHONE_DAY = 8;
export const OTP_PER_IP_HOUR = 10;
export const OTP_VERIFY_PER_IP_HOUR = 30;
export const OTP_VERIFY_PER_PHONE_HOUR = 10;
export const SIGNUP_TICKET_TTL_MS = 15 * 60 * 1000;
export const SIGNUP_TICKET_COOKIE = "bt_signup";
export const SIGNUP_PER_IP_HOUR = 5;
export const SIGNUP_PER_IP_DAY = 20;
/**
 * One browser may open at most this many accounts in DEVICE_SIGNUP_WINDOW_MS.
 * The browser keeps a random id in an httpOnly cookie; the server stores only
 * its HMAC and the sign-up date, and drops the row after the window.
 */
export const DEVICE_COOKIE = "bt_device";
export const DEVICE_COOKIE_MAX_AGE_SEC = 2 * 365 * 24 * 60 * 60;
export const DEVICE_SIGNUP_MAX = 2;
export const DEVICE_SIGNUP_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
/**
 * After an account is deleted, its phone cannot open a new account for this
 * long. Only a keyed HMAC of the number is kept, and it is purged afterwards.
 * Without this, delete + re-register would let one phone switch teams.
 */
/** Re-registration hold after deleting an account that never voted. */
export const PHONE_HOLD_MS = 30 * 24 * 60 * 60 * 1000;
/** Hold after deleting an account that cast a vote: a new vote with the same number waits a year. */
export const PHONE_HOLD_VOTED_MS = 365 * 24 * 60 * 60 * 1000;
/** Accounts deleted while banned: the number stays closed (no automatic release). */
export const PHONE_HOLD_PERMANENT_UNTIL = "9999-12-31T00:00:00.000Z";
/** Bump when the text changes; signed-in members are asked to accept the new version. */
export const TERMS_VERSION = "2026-10-21";
/** KVKK aydınlatma metni; members acknowledge each version once. */
export const PRIVACY_NOTICE_VERSION = "2026-10-21";
export const COOKIE_POLICY_VERSION = "2026-10-21";
/** Acceptance records of deleted accounts are kept this long as proof (general limitation period). */
export const LEGAL_RECORD_AFTER_DELETE_MS = 10 * 365 * 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETE_PER_USER_HOUR = 3;
export const FAN_VOTE_PER_USER_HOUR = 10;
export const REGISTER_PER_HOUR = 3;
export const DELETE_PER_HOUR = 3;
export const VERIFY_PER_HOUR = 20;
export const AUTH_REGISTER_PER_HOUR = 5;
export const AUTH_LOGIN_PER_HOUR = 20;
export const AUTH_LOGIN_PER_ID_HOUR = 10;
export const USER_EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const USER_EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
export const USER_EMAIL_RESEND_PER_USER_HOUR = 3;
export const USER_EMAIL_RESEND_PER_IP_HOUR = 8;
export const FORUM_PHONE_UNVERIFIED_ERROR =
  "Forumda yazabilmek için hesabını doğrulaman gerekiyor.";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_ADMIN_IDLE_MS = 30 * 60 * 1000;
export const SESSION_COOKIE = "bt_session";
export const VOTE_GRANT_COOKIE = "bt_vote";
export const VOTE_GRANT_TTL_MS = 30 * 60 * 1000;
export const ADMIN_2FA_COOKIE = "bt_admin_2fa";
export const ADMIN_2FA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const ADMIN_TOTP_SETUP_TTL_MS = 10 * 60 * 1000;
export const AUTH_TOTP_PER_IP_HOUR = 10;
export const AUTH_TOTP_PER_USER_HOUR = 8;
export const FORUM_TITLE_MIN = 3;
export const FORUM_TITLE_MAX = 120;
export const FORUM_BODY_MAX = 4_000;
export const FORUM_POST_MAX = 4_000;
export const FORUM_PAGE_DEFAULT = 20;
export const FORUM_PAGE_MAX = 50;
export const ADMIN_PAGE_DEFAULT = 25;
export const ADMIN_PAGE_MAX = 100;
export const FORUM_TOPICS_PER_USER_HOUR = 8;
export const FORUM_POSTS_PER_USER_HOUR = 40;
export const FORUM_TOPICS_PER_IP_HOUR = 12;
export const FORUM_POSTS_PER_IP_HOUR = 60;
export const TEAM_REQUEST_NAME_MIN = 3;
export const TEAM_REQUEST_NAME_MAX = 80;
export const TEAM_REQUEST_MESSAGE_MIN = 10;
export const TEAM_REQUEST_MESSAGE_MAX = 500;
export const TEAM_REQUESTS_PER_USER_HOUR = 3;
export const TEAM_REQUESTS_PER_IP_HOUR = 8;
export const MAX_JSON_BYTES = 8_192;
