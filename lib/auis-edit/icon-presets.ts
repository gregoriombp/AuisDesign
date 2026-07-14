// Curated set of Material Symbols (the Auis icon system) for the Live Edit icon
// picker. Listing the thousands available isn't practical; these cover common
// product usage. You can also type the exact ligature for any icon outside the
// list.

export interface IconGroup {
  label: string
  icons: string[]
}

export const ICON_GROUPS: IconGroup[] = [
  {
    label: "Actions",
    icons: [
      "add",
      "edit",
      "delete",
      "close",
      "check",
      "done_all",
      "content_copy",
      "save",
      "download",
      "upload",
      "share",
      "ios_share",
      "refresh",
      "sync",
      "send",
      "open_in_new",
      "link",
      "filter_list",
      "sort",
      "tune",
    ],
  },
  {
    label: "Navigation",
    icons: [
      "home",
      "dashboard",
      "arrow_back",
      "arrow_forward",
      "chevron_left",
      "chevron_right",
      "expand_more",
      "expand_less",
      "menu",
      "more_horiz",
      "more_vert",
      "search",
      "apps",
      "account_tree",
    ],
  },
  {
    label: "Objects",
    icons: [
      "folder",
      "description",
      "article",
      "image",
      "attach_file",
      "calendar_today",
      "schedule",
      "mail",
      "chat",
      "forum",
      "notifications",
      "bookmark",
      "star",
      "favorite",
      "settings",
      "build",
      "bolt",
      "rocket_launch",
      "lightbulb",
      "key",
    ],
  },
  {
    label: "People & status",
    icons: [
      "person",
      "group",
      "account_circle",
      "verified",
      "check_circle",
      "cancel",
      "error",
      "warning",
      "info",
      "help",
      "visibility",
      "visibility_off",
      "lock",
      "lock_open",
      "trending_up",
      "trending_down",
    ],
  },
]

export const ALL_PRESET_ICONS: string[] = ICON_GROUPS.flatMap((g) => g.icons)
