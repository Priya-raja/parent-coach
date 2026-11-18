---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Use this when styling the parent-coach app.
---

# Frontend Design: Parent Coach

Approach this as the design lead at a studio. The client is exhausted parents looking for a calm, safe digital sanctuary. They want a soft, dreamy Pinterest-like aesthetic, not a clinical tool or a generic SaaS dashboard. 

## Ground your designs in the subject matter
The subject is parenting support. The visual vernacular should draw from "early morning light," "clouds," and "nursery softness." 

## Design principles for this app
- **Typography:** Choose fonts deliberately for a bilingual audience. Do not use standard system defaults. Find a pairing that handles English gracefully and Urdu beautifully (e.g., Nunito for English, Vazirmatn or Noto Nastaliq Urdu for Arabic script).
- **Visual structure:** The chat is the primary interaction. Do not use generic boxy UI. Use soft, pill-like shapes and high border-radius elements.
- **Motion:** Use non-user-triggered motion sparingly. A gentle fade-and-slide-up entrance for the Coach's messages creates a calming "presence." 
- **Copywriting:** The header is not just navigation; it is a greeting. Use phrases like "Good morning. A calmer you is closer." 

## Process & Restraint
- **Token System:** Define a compact set of tokens: background gradients (sky blue to pale mint), surface colors (semi-translucent whites), text colors (soft dark grays, never pure black), and rounded radii.
- **Self-critique:** Spend your boldness in one place (e.g., the floating input capsule). Keep the chat bubbles disciplined and quiet so they don't distract.

## Accessibility
Ensure `dir="auto"` is used so English and Urdu align correctly. Respect `prefers-reduced-motion`.