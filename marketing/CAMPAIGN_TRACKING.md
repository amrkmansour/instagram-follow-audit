# FollowCheck campaign tracking

FollowCheck uses first-party, aggregate funnel events. It does not send Instagram filenames, usernames, file contents, follower counts, advertising identifiers, or cross-site profiles.

## Link format

Use lowercase labels with letters, numbers, hyphens, periods, or underscores:

```text
https://follow-check.com/?utm_source=tiktok&utm_medium=organic-social&utm_campaign=friendship-stories-s1&utm_content=episode-01
```

Recommended source values: `tiktok`, `instagram`, `youtube`, `pinterest`, `facebook`, `reddit`, `product-hunt`, `indie-hackers`, `google`, `bing`.

Recommended medium values: `organic-social`, `community`, `directory`, `organic-search`, `guide`.

Keep one campaign name for a coherent series or launch, and use `utm_content` for the individual episode, hook, post, or placement.

## Event schema

Events are written as structured JSON in Cloudflare Workers Logs with `message` set to `marketing_event`.

| Field | Meaning |
| --- | --- |
| `event` | Event name |
| `page` | Page path |
| `source` | UTM source |
| `medium` | UTM medium |
| `campaign` | UTM campaign |
| `content` | UTM content |
| `target` | CTA target when applicable |

Tracked events: `page_view`, `guide_cta_clicked`, `checkout_started`, `checkout_completed`, `password_access_granted`, `audit_completed`, and `csv_downloaded`.

Campaign labels are also copied into Stripe Checkout metadata. This makes paid conversions attributable in Stripe even when browser event delivery is blocked.

## Weekly review

Filter the `followcheck-payments` Worker logs to `marketing_event`, export the matching rows, and group by source, medium, campaign, content, and event. The event schema is deliberately stable so the export can be summarized automatically.

Compare `checkout_started` with `checkout_completed`, and `checkout_completed` with `audit_completed`. Do not optimize on page views alone; prioritize campaigns that produce completed purchases and audits.
