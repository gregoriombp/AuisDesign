import { redirect } from "next/navigation"

// The builder ships empty — the product lives under /auis (hub, styleguide,
// flows, projects). The bare root only forwards there.
export default function Home() {
  redirect("/auis")
}
