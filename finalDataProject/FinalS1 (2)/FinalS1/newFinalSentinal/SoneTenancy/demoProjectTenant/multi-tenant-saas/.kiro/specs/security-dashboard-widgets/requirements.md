# Requirements Document

## Introduction

This feature extends the multi-tenant SaaS dashboard with a rich, configurable widget system across two surfaces:

1. **Security Dashboard** (`/dashboard/security`) — adds new security-focused widgets alongside the existing SentinelOne mitigation chart and Palo Alto firewall report table, all within the existing `react-grid-layout` drag-and-drop grid.
2. **Main Dashboard** (`/dashboard`) — replaces the current static layout with a `react-grid-layout`-powered widget grid, adding both general-purpose and security-summary widgets.

All widget positions and sizes are persisted per-user per-organisation in PostgreSQL (the existing `dashboard_layout` table), so each tenant's users retain their personalised layout across sessions.

The project already has `react-grid-layout ^2.2.3`, `recharts ^3.8.1`, and the SentinelOne / Palo Alto API integrations in place.

---

## Glossary

- **Dashboard_Grid**: The `react-grid-layout` `ResponsiveGridLayout` component that hosts all widgets on a given page.
- **Widget**: A self-contained UI panel rendered inside a `Dashboard_Grid` cell, identified by a unique string key.
- **Widget_Registry**: The client-side map that associates a widget key with its React component and default layout dimensions.
- **Layout_State**: The JSON object stored in `dashboard_layout.layout` (PostgreSQL JSONB) that records each widget's `{ i, x, y, w, h }` for a given user and organisation.
- **Layout_API**: The existing `/api/dashboard/layout` route (GET / PUT) used to load and persist `Layout_State`.
- **Security_Page**: The Next.js page at `app/dashboard/security/page.tsx`.
- **Main_Dashboard_Page**: The Next.js page at `app/dashboard/page.tsx`.
- **SentinelOne_API**: The internal proxy at `/api/sentinelone/threats` that fetches threat data from the SentinelOne service.
- **Firewall_API**: The internal proxy at `/api/firewall/reports/[report]` that returns Palo Alto firewall report data from the org's PostgreSQL database.
- **Drag_Handle**: The designated header area of a widget that the user grabs to reposition it within the grid.
- **Resize_Handle**: The corner/edge affordance rendered by `react-resizable` that allows the user to change a widget's dimensions.
- **Tenant**: A single organisation in the multi-tenant system, identified by `orgSlug`.
- **Org_DB**: The per-tenant PostgreSQL database (`saas_org_<slug>`) that stores all tenant-specific data including `dashboard_layout`.

---

## Requirements

### Requirement 1: Widget Grid on the Security Dashboard

**User Story:** As a security analyst, I want the security dashboard to display multiple widgets in a drag-and-drop grid, so that I can arrange the information most relevant to my workflow.

#### Acceptance Criteria

1. WHEN the Security_Page loads for an authenticated user with an active organisation, THE Dashboard_Grid SHALL render all security widgets within a `ResponsiveGridLayout` component using `react-grid-layout`.
2. THE Dashboard_Grid SHALL support the following column breakpoints: `lg` = 12 cols at ≥ 1200 px, `md` = 10 cols at ≥ 996 px, `sm` = 6 cols at ≥ 768 px, `xs` = 4 cols at ≥ 480 px, `xxs` = 2 cols at < 480 px.
3. THE Dashboard_Grid SHALL use a `rowHeight` of 60 px and a margin of 16 px on both axes.
4. WHEN a user drags a widget by its Drag_Handle, THE Dashboard_Grid SHALL reposition the widget within the grid without overlapping other widgets.
5. WHEN a user drags a widget, THE Dashboard_Grid SHALL NOT initiate a drag when the pointer is outside the Drag_Handle area.
6. WHEN a user resizes a widget using a Resize_Handle, THE Dashboard_Grid SHALL update the widget's width and height within the grid.
7. THE Dashboard_Grid SHALL enforce a minimum width of 3 columns and a minimum height of 4 rows for every widget.
8. WHEN the browser window is resized, THE Dashboard_Grid SHALL reflow widgets to fit the active breakpoint column count.

---

### Requirement 2: Widget Grid on the Main Dashboard

**User Story:** As a dashboard user, I want the main dashboard to display configurable widgets in a drag-and-drop grid, so that I can personalise my overview of organisation metrics and security status.

#### Acceptance Criteria

1. WHEN the Main_Dashboard_Page loads for an authenticated user with an active organisation, THE Dashboard_Grid SHALL render all main-dashboard widgets within a `ResponsiveGridLayout` component.
2. THE Dashboard_Grid on the Main_Dashboard_Page SHALL apply the same breakpoints, `rowHeight`, and margin as specified in Requirement 1, Criteria 2–3.
3. WHEN a user drags or resizes a widget on the Main_Dashboard_Page, THE Dashboard_Grid SHALL behave according to Requirement 1, Criteria 4–8.
4. THE Main_Dashboard_Page SHALL continue to display the organisation welcome banner above the widget grid as a non-widget, non-draggable element.

---

### Requirement 3: Security Widgets — SentinelOne

**User Story:** As a security analyst, I want dedicated widgets showing SentinelOne threat data, so that I can monitor endpoint threat status at a glance.

#### Acceptance Criteria

1. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Threat Mitigation Status** widget that fetches data from the SentinelOne_API and renders a chart of mitigation status counts.
2. THE Threat_Mitigation_Status_Widget SHALL support three chart modes selectable by the user: `donut` (pie chart with inner radius), `probability` (horizontal percentage bars), and `bar` (vertical bar chart).
3. WHEN the SentinelOne_API returns data, THE Threat_Mitigation_Status_Widget SHALL display the total threat count in the centre of the donut chart when the `donut` mode is active.
4. WHEN the SentinelOne_API returns an error or is not configured, THE Threat_Mitigation_Status_Widget SHALL display a descriptive error message in place of the chart.
5. WHEN the SentinelOne_API is loading, THE Threat_Mitigation_Status_Widget SHALL display a loading spinner.
6. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Threat Severity Breakdown** widget that groups SentinelOne threats by `threatInfo.confidenceLevel` and renders a bar chart of counts per severity level.
7. WHEN the SentinelOne_API returns zero threats, THE Threat_Severity_Breakdown_Widget SHALL display a "No threat data" empty state message.
8. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Recent Threats List** widget that displays the 10 most recent SentinelOne threats as a scrollable table showing threat name, agent hostname, mitigation status, and created-at timestamp.
9. WHEN a SentinelOne threat has a `mitigated` mitigation status, THE Recent_Threats_List_Widget SHALL render the status badge with a green colour.
10. WHEN a SentinelOne threat has an `active` mitigation status, THE Recent_Threats_List_Widget SHALL render the status badge with a red colour.

---

### Requirement 4: Security Widgets — Palo Alto Firewall

**User Story:** As a network security engineer, I want dedicated widgets showing Palo Alto firewall report data, so that I can review network threat and traffic trends without leaving the dashboard.

#### Acceptance Criteria

1. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Firewall Report Table** widget that fetches a selected report from the Firewall_API and renders the result as a paginated table.
2. THE Firewall_Report_Table_Widget SHALL provide a dropdown listing all 40 available Palo Alto report names, allowing the user to switch reports without navigating away.
3. WHEN the user selects a different report from the dropdown, THE Firewall_Report_Table_Widget SHALL fetch the new report from the Firewall_API and replace the table contents.
4. WHEN the Firewall_API returns data with no parseable table rows, THE Firewall_Report_Table_Widget SHALL display the raw JSON in a formatted code block as a fallback.
5. WHEN the Firewall_API returns an error, THE Firewall_Report_Table_Widget SHALL display the error message and instruct the user to run "Collect Firewall Data" first.
6. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Firewall Threat Trend** widget that fetches the `threat-trend` report and renders a line chart of threat counts over time using Recharts.
7. WHEN the `threat-trend` report contains no parseable time-series data, THE Firewall_Threat_Trend_Widget SHALL display a "No trend data available" empty state message.
8. WHEN the Security_Page loads, THE Widget_Registry SHALL include a **Top Attackers** widget that fetches the `top-attacker-sources` report and renders a horizontal bar chart of the top source IP addresses by attack count.

---

### Requirement 5: General-Purpose Widgets — Main Dashboard

**User Story:** As a dashboard user, I want general-purpose widgets on the main dashboard, so that I can monitor organisation KPIs and activity without navigating to separate pages.

#### Acceptance Criteria

1. WHEN the Main_Dashboard_Page loads, THE Widget_Registry SHALL include an **Organisation Stats** widget that displays member count, project count, active project count, and current plan as four metric cards within a single widget.
2. WHEN the Main_Dashboard_Page loads, THE Widget_Registry SHALL include a **Recent Projects** widget that lists the five most recent projects with name, key, status badge, and creation date.
3. WHEN the Main_Dashboard_Page loads, THE Widget_Registry SHALL include a **Recent Members** widget that lists the five most recently added members with avatar initial, name, email, and role badge.
4. WHEN the Main_Dashboard_Page loads, THE Widget_Registry SHALL include a **Security Summary** widget that fetches data from the SentinelOne_API and displays total threat count, count of active (unmitigated) threats, and a link to the Security_Page.
5. WHEN the SentinelOne_API is not configured or returns an error, THE Security_Summary_Widget SHALL display a "Security data unavailable" message with a link to the Security_Page.
6. WHEN the Main_Dashboard_Page loads, THE Widget_Registry SHALL include a **Notifications** widget that displays the five most recent unread notifications for the current user.
7. WHEN there are no unread notifications, THE Notifications_Widget SHALL display a "No new notifications" empty state message.

---

### Requirement 6: Layout Persistence

**User Story:** As a dashboard user, I want my widget layout to be saved automatically, so that my personalised arrangement is restored the next time I open the dashboard.

#### Acceptance Criteria

1. WHEN a user completes a drag or resize interaction on any Dashboard_Grid, THE Layout_API SHALL receive a PUT request with the updated Layout_State within 800 ms of the interaction ending (debounced).
2. THE Layout_State PUT request body SHALL conform to `{ layout: { boxes: Array<{ i: string, x: number, y: number, w: number, h: number }>, ... } }`.
3. WHEN the Layout_API PUT request succeeds, THE Dashboard_Grid SHALL display a "Saved" confirmation indicator for 2500 ms.
4. WHEN the Layout_API PUT request is in flight, THE Dashboard_Grid SHALL display a "Saving…" indicator with a spinner.
5. WHEN a Dashboard_Grid page loads, THE Layout_API GET endpoint SHALL be called once to retrieve the persisted Layout_State for the current user and organisation.
6. WHEN the Layout_API GET response contains a valid Layout_State, THE Dashboard_Grid SHALL restore each widget to its persisted `{ x, y, w, h }` position.
7. WHEN the Layout_API GET response contains no Layout_State or an invalid Layout_State, THE Dashboard_Grid SHALL render widgets using their default positions defined in the Widget_Registry.
8. THE Layout_API SHALL store Layout_State scoped to the combination of `user_email` and `orgSlug`, so that different users within the same Tenant have independent layouts.
9. WHEN a user switches to a different active organisation, THE Dashboard_Grid SHALL reload the Layout_State for the new organisation.

---

### Requirement 7: Widget Drag-and-Drop Interaction

**User Story:** As a dashboard user, I want clear visual affordances for dragging and resizing widgets, so that I can confidently rearrange my dashboard without accidentally triggering unwanted interactions.

#### Acceptance Criteria

1. THE Widget SHALL render a Drag_Handle as a visually distinct header bar at the top of the widget card.
2. WHEN the pointer enters the Drag_Handle, THE Drag_Handle SHALL display a `grab` cursor.
3. WHEN the user is actively dragging a widget, THE Drag_Handle SHALL display a `grabbing` cursor.
4. THE Widget SHALL render Resize_Handles at the four corners (`se`, `sw`, `ne`, `nw`) of the widget card.
5. WHEN a widget is being dragged, THE Dashboard_Grid SHALL render a placeholder element showing the target drop position.
6. THE Drag_Handle area SHALL be marked with `user-select: none` to prevent text selection during drag.
7. WHEN a user clicks a button or interactive control inside a widget (such as a chart-type toggle or report dropdown), THE Dashboard_Grid SHALL NOT initiate a drag interaction.

---

### Requirement 8: Collect Firewall Data Action

**User Story:** As a security engineer, I want a "Collect Firewall Data" button on the security dashboard, so that I can trigger a fresh pull of Palo Alto firewall reports on demand.

#### Acceptance Criteria

1. THE Security_Page SHALL render a "Collect Firewall Data" button in the page header.
2. WHEN the user clicks "Collect Firewall Data", THE Security_Page SHALL send a POST request to `/api/firewall/collect` and disable the button for the duration of the request.
3. WHEN the `/api/firewall/collect` request succeeds, THE Security_Page SHALL display a success message and automatically refresh all Firewall_API-dependent widgets.
4. WHEN the `/api/firewall/collect` request fails, THE Security_Page SHALL display the error message returned by the API.
5. WHILE the collect request is in flight, THE Security_Page SHALL display a "Collecting…" label with a spinner inside the button.

---

### Requirement 9: Tenant Isolation

**User Story:** As a platform operator, I want each organisation's widget layout and security data to be fully isolated, so that one tenant cannot access another tenant's data.

#### Acceptance Criteria

1. THE Layout_API SHALL read and write Layout_State exclusively from the Org_DB identified by the `orgSlug` extracted from the authenticated JWT token.
2. THE SentinelOne_API proxy SHALL reject requests where the JWT token contains no `orgSlug` or `activeOrgSlug` with a 400 status response.
3. THE Firewall_API proxy SHALL reject requests where the JWT token contains no `orgSlug` or `activeOrgSlug` with a 400 status response.
4. WHEN a user's JWT token does not contain a valid `orgSlug`, THE Security_Page SHALL display a "No Organisation Selected" warning and SHALL NOT render the Dashboard_Grid.
5. WHEN a user's JWT token does not contain a valid `orgSlug`, THE Main_Dashboard_Page SHALL display a "No Organisation Selected" warning and SHALL NOT render the widget grid.

---

### Requirement 10: Accessibility and Responsive Layout

**User Story:** As a dashboard user on any device, I want the widget grid to be usable and readable, so that I can access security and organisation data regardless of screen size.

#### Acceptance Criteria

1. THE Dashboard_Grid SHALL reflow to a single-column layout on viewports narrower than 480 px (`xxs` breakpoint, 2 columns).
2. WHEN a widget's content overflows its allocated height, THE Widget SHALL render an internal scrollbar rather than expanding the grid cell.
3. THE Drag_Handle SHALL include an `aria-label` attribute describing the widget name to support screen reader navigation.
4. THE Widget SHALL use sufficient colour contrast (minimum 4.5:1 ratio for normal text) for all status badges and chart labels, consistent with the existing Tailwind CSS design system.
5. WHERE a widget displays a data table, THE Widget SHALL render the table with `<thead>` and `<tbody>` elements and appropriate `scope` attributes on header cells.
