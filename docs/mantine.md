# Frontend UI with Mantine

The Next.js frontend uses Mantine throughout its pages and shared components.
`frontend/src/config/theme.ts` defines the palette, typography, radii and component
defaults. `AppProviders` supplies this theme to every route.

Import `@mantine/core/styles.layer.css` once in the root layout. The Mantine
layer lets application styles retain precedence when Next.js orders production
CSS chunks differently. Do not also import the non-layered `styles.css`.
Use named theme breakpoints for responsive props: `sidebar` is 1024px and
`compact` is 600px. `hiddenFrom` accepts breakpoint names, not raw CSS sizes.

| Area                                | Components                                                |
| ----------------------------------- | --------------------------------------------------------- |
| Workspace and responsive navigation | AppShell, Container, Burger, Drawer                       |
| Page structure and typography       | Box, Group, Stack, SimpleGrid, Title, Text                |
| Service cards and statistics        | Paper, SimpleGrid                                         |
| Navigation and actions              | Anchor with Next.js Link, Button, UnstyledButton, Tooltip |
| Forms                               | TextInput, Textarea, NativeSelect, Select, Checkbox       |
| Dashboard                           | Accordion, Progress, Table, Table.ScrollContainer         |
| Photos                              | FileInput, Image, Progress                                |
| Feedback                            | Alert, Notification, Affix, Skeleton, Loader              |

Keep semantic HTML for forms, inline content, and document structure where useful.
Prefer Mantine layout props and theme defaults for new UI. Existing feature CSS
retains branding, status colors, navigation collapse styling and asset detail
presentation. Existing class names also preserve the original grid breakpoints,
card spacing and page width while using Mantine components. Typography for
migrated HTML paragraphs uses the `portal-paragraph` class; existing Mantine Text
components keep their own sizing. The files under `legacy-frontend` belong to the archived
application and are separate from the Next.js UI.

Dropdown interaction tests use the accessible `combobox` and `option` roles.
File upload tests target FileInput's native file input. The workspace continues
to check the existing permissions before displaying protected pages.
