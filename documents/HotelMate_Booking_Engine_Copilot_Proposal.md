# Project Proposal: HotelMate Booking Engine Copilot

**Prepared for:** Hotel ownership / stakeholder review
**Prepared by:** Product & Engineering Team
**Date:** September 18, 2026
**Status:** Draft — v0.1 (Chatbot Stage)

---

## 1. Executive Summary

HotelMate Booking Engine Copilot is an agentic AI system designed to let hotel guests complete reservations conversationally — collecting identity, dates, occupancy, room preference, meal plan, and payment through a natural chat interface — while giving hotel owners a path to higher conversion, higher average booking value (via future upsell and dynamic pricing agents), and reduced front-desk/call-center load.

The system is being delivered in stages. **Stage 1 (this proposal's scope) is a multi-agent conversational booking chatbot** built on a coordinator/sub-agent architecture. Two capabilities — AI-driven upsell recommendations and dynamic/smart pricing — are explicitly scoped as **future work** and are called out below so stakeholders can plan budget and timeline for them separately.

This document translates the existing architecture sketches (data flow diagrams, Levels 0–2) and the current technical scaffolding (FastAPI backend, React/TypeScript frontend) into a single proposal covering goals, architecture, scope, tech stack, roadmap, risks, and open questions.

---

## 2. Problem Statement

Hotel booking flows today typically require guests to either:
- Navigate multi-step, form-heavy booking engines, or
- Call/email the front desk, consuming staff time for routine, repeatable questions (availability, policies, pricing).

This creates friction that suppresses conversion and burdens hotel staff with repetitive policy Q&A (cancellation rules, check-in times, child-age policies, etc.) that a well-grounded AI agent can answer directly and consistently.

## 3. Goals & Success Criteria

| Goal | Description | Success Indicator |
|---|---|---|
| Frictionless booking | Guest can complete a reservation end-to-end via chat, without leaving the conversation | Booking completion rate via chatbot vs. legacy form |
| Accurate policy answers | Guests get correct, sourced answers to policy questions in-line, without waiting on staff | Reduction in policy-related front-desk/call volume |
| Extensible architecture | New specialist agents (upsell, pricing) can be added without re-architecting the system | New agent onboarded with no changes to Coordinator contract |
| Revenue growth (future) | Upsell and dynamic pricing agents increase average booking value | Uplift in ADR (average daily rate) / attach rate on add-ons, once implemented |

---

## 4. Proposed Solution Overview

The system is a **multi-agent architecture** coordinated by a central orchestrator, following the Gane & Sarson-style Data Flow Diagrams already produced for this project (Levels 0–2). At a high level:

- A **Root Agent** greets the guest and collects identity (name, email, phone).
- A **Coordinator Agent** then orchestrates a sequence of specialist agents:
  1. **Reservation Agent** — collects dates, occupancy, room selection, and meal plan.
  2. **Booking Policy Agent** — a RAG-backed Q&A agent, reachable on-demand from *any* other agent at any point in the flow, not just at the end.
  3. **Upsell Options Recommend Agent** *(future)* — recommends upgrades/add-ons.
  4. **Smart Pricing Agent** *(future)* — computes dynamic pricing.
  5. **Payment Agent** — finalizes payment and confirms status to guest and coordinator.

A key design detail carried over from the sketches: **the policy-question interrupt is a system-wide rule**, not a single step. After each agent finishes its own task, it checks whether the guest has a policy question; if yes, control hands to the Booking Policy Agent and then *returns to where it left off* rather than restarting the flow. This keeps the conversation natural (guests can ask "what's your cancellation policy?" mid-booking) without derailing state.

### 4.1 Data Flow Summary

| Data Store | Contents | Written By | Read By |
|---|---|---|---|
| Root Agent Memory | First name, last name, email, phone | Root Agent | Coordinator Agent |
| Conversation Memory | Check-in/out dates, adult & child counts, child ages, room type, meal plan | Reservation Agent | Coordinator Agent, Payment Agent |
| Booking Policy Knowledge Base | Vectorized chunks of hotel policy documents (embeddings + text) | Ingestion pipeline (offline) | Booking Policy Agent |

*(Full Level 0–2 diagrams are maintained in the companion document `hotel_booking_multi_agent_dfd.md`.)*

### 4.2 Identified Gap Worth Resolving Before Build

The Reservation Agent's "show available room types + count available" step implies a **Room Inventory data store** that is not yet represented in the architecture diagrams. This should be formalized (source system, schema, refresh cadence) before implementation begins, since room availability accuracy is foundational to guest trust and to preventing overbooking.

---

## 5. Scope

### 5.1 In Scope — Stage 1 (Chatbot)
- Root Agent: identity collection flow
- Coordinator Agent: orchestration, state handoff between agents
- Reservation Agent: dates, occupancy, room selection, meal plan
- Booking Policy Agent: RAG Q&A over `hotel_booking_policies.md`, interruptible from any agent
- Payment Agent: payment finalization and status notification
- Backend API (FastAPI) and chat frontend (React/TypeScript)

### 5.2 Explicitly Out of Scope for Stage 1 (Future Work)
- **Upsell Options Recommend Agent** — recommending upgrades/add-ons
- **Smart Pricing Agent** — dynamic, demand-based pricing
- Multi-property / multi-channel support
- Voice interface or non-chat channels
- Formal Room Inventory system integration (flagged above as a prerequisite gap, not yet scoped)

---

## 6. Technical Approach

### 6.1 Backend
| Component | Choice |
|---|---|
| Language | Python 3.14+ |
| Framework | FastAPI |
| ASGI Server | Uvicorn |
| Package Manager | uv (Astral) |

Run locally via:
```bash
cd backend
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```
API docs auto-served at `http://localhost:8000/docs`.

### 6.2 Frontend
| Component | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler / Dev Server | Vite |
| Markdown Rendering | react-markdown + remark-gfm |
| Syntax Highlighting | react-syntax-highlighter |
| Linter | Oxlint |

Run locally via:
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_BACKEND_URL
npm run dev
```

### 6.3 Knowledge Base / RAG
The Booking Policy Agent is backed by a retrieval-augmented generation (RAG) pipeline over `hotel_booking_policies.md`, supporting semantic, keyword, and hybrid search. This is treated as a distinct data store (D3) with its own ingestion pipeline, separate from conversational memory.

---

## 7. Roadmap & Milestones

| Phase | Milestone | Key Deliverables |
|---|---|---|
| Phase 0 | Architecture sign-off | Finalized DFDs (L0–L2), resolved Room Inventory question |
| Phase 1 | Root + Coordinator Agents | Identity capture, agent handoff scaffold |
| Phase 2 | Reservation Agent | Full booking-detail collection flow, Conversation Memory store |
| Phase 3 | Booking Policy Agent | RAG pipeline live, system-wide interrupt/return routing |
| Phase 4 | Payment Agent | Payment finalization + confirmation to guest/coordinator |
| Phase 5 | End-to-end chatbot pilot | Internal pilot, staff shadow testing |
| Phase 6 (Future) | Upsell Options Agent | Upgrade/add-on recommendations |
| Phase 7 (Future) | Smart Pricing Agent | Dynamic pricing integration |

---

## 8. Risks & Open Questions

1. **Room Inventory source of truth** — not yet defined; needed before the Reservation Agent's availability step can be implemented reliably.
2. **Interrupt/return state management** — the policy-question interrupt pattern requires careful conversation-state handling across every agent; this should be validated with a shared "return-to-caller" contract early, not per-agent.
3. **Unclear icon in original sketches** — an unlabeled element near the Root Agent in the source sketches was omitted rather than guessed at (see DFD document's Assumptions section). Worth a quick clarification pass with whoever produced the original sketches — it may represent a specific channel/widget that should be its own external entity.
4. **Payment gateway selection** — not yet specified; needs a decision to scope the Payment Agent's integration work.
5. **RAG content ownership** — someone needs to own keeping `hotel_booking_policies.md` accurate and current, since the Booking Policy Agent's answer quality depends entirely on it.

---

## 9. Recommendation

Proceed with Phases 0–5 as the Stage 1 chatbot deliverable, with Phase 0 explicitly including resolution of the Room Inventory data-store question before Reservation Agent implementation begins. Treat the Upsell and Smart Pricing agents as a distinct Stage 2 proposal once Stage 1 is live and generating usage data, since their design (especially Smart Pricing) will benefit from real booking-pattern data from Stage 1.

---

*This proposal should be read alongside the companion architecture document, `hotel_booking_multi_agent_dfd.md`, which contains the full Level 0–2 data flow diagrams referenced throughout this document.*
