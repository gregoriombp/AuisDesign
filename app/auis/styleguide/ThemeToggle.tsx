"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/Icon"

type Theme = "light" | "dark"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? (window.localStorage.getItem("au-theme") as Theme | null)
        : null
    const initial: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
    setTheme(initial)
    document.documentElement.classList.toggle("dark", initial === "dark")
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    window.localStorage.setItem("au-theme", next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Ativar modo ${theme === "dark" ? "claro" : "escuro"}`}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
      className="au-theme-toggle"
      suppressHydrationWarning
    >
      <Icon
        name={mounted && theme === "dark" ? "light_mode" : "dark_mode"}
        size={18}
      />
    </button>
  )
}
