## Frontend tasks (Project Rules)

When doing frontend design tasks, avoid generic, overbuilt layouts.

**Use these hard rules:**
- **Typography:** Use expressive, purposeful fonts. Avoid default stacks (Inter, Roboto, Arial, system). Use CSS variables to define them.
- **Background:** Do not rely on flat, single-color backgrounds. Use a soft, atmospheric gradient (e.g., light sky blue to pale mint) to build the "dreamy" vibe.
- **Color & Look:** Choose a clear visual direction. Define CSS variables. No purple bias or dark mode bias. 
- **Motion:** Use motion to create presence and hierarchy, not noise. Ship at least 2 intentional motions (e.g., message fade-in, button hover scale).
- **React Code:** Prefer modern patterns including `useEffectEvent`, `startTransition`, and `useDeferredValue` when appropriate. Do not add `useMemo`/`useCallback` by default unless already used.
- **Responsive:** Ensure the page loads properly on both desktop and mobile.

**Exceptions for this App Interface (Chat UI):**
- **Ignore "Full-bleed hero" and "Hero budget" rules:** This is a chat app, not a marketing landing page. The top of the screen is a greeting header, not a hero image.
- **Ignore "No cards" rule:** Chat bubbles *are* the containers for user interaction, so they are allowed to be cards (specifically, soft, rounded, cloud-like surfaces).
- **One composition:** The first viewport must read as a single, cohesive chat interface. Do not add stat strips, icon rows, or schedule snippets.