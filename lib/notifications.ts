// Demo fixture for the notification feed — swap it for a real endpoint when your
// backend exposes one. Items run from most recent to oldest.
//
// This data exists to exercise the notification components, so it deliberately
// covers every variant they render: all five kinds, read and unread rows,
// critical and ordinary items, entries with and without an `href`, and the three
// timestamp formats (relative, "Yesterday", absolute date). Keep that spread if
// you edit it. Routes are placeholders — this is a showcase, not a real app.

export type NotificationKind =
  | "billing"
  | "agent"
  | "team"
  | "security"
  | "system";

/** Readable category label, for the detail header and the filters. */
export const KIND_LABEL: Record<NotificationKind, string> = {
  billing: "Billing",
  agent: "Agents",
  team: "Team",
  security: "Security",
  system: "System",
};

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** Pre-formatted, human-readable timestamp. */
  timeLabel: string;
  /** Route opened when the notification is clicked. Absent = informational item. */
  href?: string;
  /** Events that need immediate action — a failed payment, a dropped connection.
   * When unread, these surface in a pinned banner at the top of the inbox. */
  critical?: boolean;
  read: boolean;
};

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-assistant-disconnected",
    kind: "agent",
    title: "Assistant disconnected",
    description:
      "The support assistant lost its connection to the workspace and stopped replying. Reconnect it to resume automated responses.",
    timeLabel: "12 minutes ago",
    href: "/integrations",
    critical: true,
    read: false,
  },
  {
    id: "n-payment-failed",
    kind: "billing",
    title: "Payment failed for invoice INV-2026-03-0987",
    description:
      "The $5,268.49 invoice is past due and the payment could not be processed. Update your payment method to avoid an interruption.",
    timeLabel: "1 hour ago",
    href: "/settings/billing",
    critical: true,
    read: false,
  },
  {
    id: "n-approval-requested",
    kind: "agent",
    title: "Assistant requested approval",
    description:
      "An automated workflow is waiting for your approval before it runs its scheduled batch.",
    timeLabel: "3 hours ago",
    read: false,
  },
  {
    id: "n-member-joined",
    kind: "team",
    title: "Avery Chen joined the workspace",
    description:
      "The invitation was accepted and they now have access to the Product group.",
    timeLabel: "6 hours ago",
    href: "/settings/team",
    read: false,
  },
  {
    id: "n-new-sign-in",
    kind: "security",
    title: "New sign-in to your account",
    description:
      "A new sign-in from Chrome on macOS. Don't recognize it? Review your active sessions.",
    timeLabel: "Yesterday · 21:14",
    href: "/settings/security",
    read: true,
  },
  {
    id: "n-index-rebuilt",
    kind: "agent",
    title: "Knowledge base finished indexing",
    description:
      "The knowledge base was reindexed and the assistant now answers with the latest content.",
    timeLabel: "Yesterday · 14:02",
    read: true,
  },
  {
    id: "n-credits-running-low",
    kind: "billing",
    title: "Credits running low",
    description:
      "This month's usage is being consumed 2.3× faster than forecast. Top up to avoid an interruption.",
    timeLabel: "16 May · 09:30",
    href: "/settings/billing/usage",
    read: true,
  },
  {
    id: "n-invite-expiring",
    kind: "team",
    title: "Pending invitation expires tomorrow",
    description:
      "The invitation to jordan@example.com has not been accepted and expires in 24 hours.",
    timeLabel: "15 May · 11:20",
    href: "/settings/team/invitations",
    read: true,
  },
  {
    id: "n-maintenance",
    kind: "system",
    title: "Scheduled maintenance",
    description:
      "Reports will be unavailable on Sunday from 02:00 to 04:00 UTC.",
    timeLabel: "13 May · 17:00",
    read: true,
  },
];
