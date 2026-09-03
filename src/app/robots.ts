import { appUrl } from "@/lib/request";
import { robotsMetadata } from "@/lib/robots-policy";

export default function robots() {
  return robotsMetadata(appUrl());
}
