"use client";

import { useParams } from "next/navigation";
import ForumNewTopicView from "@/components/forum/ForumNewTopicView";
import { getCityBySlug } from "@/lib/cities";

export default function CityNewTopicPage() {
  const raw = useParams<{ citySlug: string }>().citySlug;
  const slug = (Array.isArray(raw) ? raw[0] : raw) || "";
  const city = getCityBySlug(slug);
  return (
    <ForumNewTopicView
      apiPath={`/api/forum/il/${slug}/topics`}
      boardPath={`/forum/il/${slug}`}
      boardTitle={city ? `${city.name} Tribünü` : "İl tribünü"}
      active={Boolean(city)}
    />
  );
}
