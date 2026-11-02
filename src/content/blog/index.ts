import type { BlogPost } from "@/lib/blog";
import { post as nasilSayiyor } from "./bizim-tribun-nasil-sayiyor";
import { post as enCokTaraftar } from "./en-cok-taraftari-olan-takim";
import { post as ilIlTakim } from "./hangi-ilde-hangi-takim-tutuluyor";

/** Every post, in any order; src/lib/blog.ts sorts and filters them. */
export const BLOG_POSTS: BlogPost[] = [enCokTaraftar, ilIlTakim, nasilSayiyor];
