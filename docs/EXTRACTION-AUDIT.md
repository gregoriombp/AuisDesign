# Extraction Audit

This repository contains the product-agnostic Auis builder extracted from its
original private product. The extraction boundary is deliberate: Auis ships the
tools needed to build a product design system, not a copy of the product that
first hosted those tools.

## What belongs in Auis

- the `/auis` builder hub and first-run setup;
- the live styleguide, foundation and component documentation;
- Review Mode, Edit Mode, their local queue, and approval workflow;
- UX-flow infrastructure, deep links, and the empty project workbench;
- the Auis mark, neutral runtime brand configuration, and agent skills;
- only the `Au*` components required by those builder surfaces.

The root layout mounts the builder's global providers so Review Mode, Edit Mode,
toasts, deep links, and the Auis dot work on product routes as well as builder
routes. Set `NEXT_PUBLIC_AUIS_DOT_DISABLED=true` when a deployment should hide
the floating entry point.

## What is intentionally excluded

- the origin product's authentication, members, billing, integrations, and app
  shell;
- third-party brand marks, customer data, product screenshots, and private
  assets;
- product-specific dashboards, notifications, copilots, tables, and workflows;
- private UX-flow examples and roadmap content;
- model-provider integrations and product account/session dependencies.

These are not missing Auis features. They are Layer B product code and should be
created in the consuming repository through the Auis component, page, and flow
skills.

## Recovery decisions

The recovery compared the public repository, its extraction history, and the
current private origin tree. High-confidence builder infrastructure was restored
or rewritten neutrally:

- global Review/Edit/brand/toast providers and the floating Auis entry point;
- UX-flow query-state restoration and builder navigation;
- neutral roadmap and UX-flow empty states, plus linear and compiled public
  reference flows for the flow-authoring skills;
- live foundation and component showcase routes;
- `AuBreadcrumbsBar`, a generic builder navigation primitive.

Product-owned surfaces were not copied back. A renamed product login mock,
orphan onboarding/integration CSS, unused brand-specific styling, and unused
application dependencies were removed.

## Future sync rule

Treat the private origin as a reference, never as a merge source. For each
candidate change, first decide whether it is builder infrastructure (Layer A) or
product behavior (Layer B). Port Layer A changes in small commits, translate the
copy when appropriate, replace private assets/data with neutral contracts, and
run the full verification suite before publishing.

The canonical component boundary is documented in
[`component-map.md`](component-map.md); runtime structure is documented in
[`ARCHITECTURE.md`](ARCHITECTURE.md).
