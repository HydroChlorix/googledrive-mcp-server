# Triage Label Vocabulary

This project uses the following strings for its five canonical triage roles. When managing issues, apply these exact strings using your issue tracker's labeling commands (e.g. `gh issue edit <number> --add-label "<label>" --remove-label "<old-label>"`).

## The mapping

- `needs-triage`: **`needs-triage`**
  Newly created issues that have not yet been evaluated.

- `needs-info`: **`needs-info`**
  Issues waiting on the reporter to provide more details or clarification.

- `ready-for-agent`: **`ready-for-agent`**
  Issues that are fully specified, have clear acceptance criteria, and can be implemented by an AFK agent without human interaction.

- `ready-for-human`: **`ready-for-human`**
  Issues that are fully specified but require a human to implement (e.g. requiring architectural decisions, complex UI/UX work, or manual testing).

- `wontfix`: **`wontfix`**
  Issues that have been evaluated and will not be implemented.
