import * as React from "react"

export type AuTableProps = React.TableHTMLAttributes<HTMLTableElement>

export function AuTable({ className, children, ...rest }: AuTableProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className={["au-table", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </table>
    </div>
  )
}
