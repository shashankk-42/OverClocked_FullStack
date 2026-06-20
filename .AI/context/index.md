# MediFlow AI — Context Index

> Master index for all AI context documents. Start here.

---

## Quick Start

| What you need | Read this |
| ------------- | --------- |
| **How to behave as an agent** | [AGENT.md](../../AGENT.md) |
| **What is MediFlow AI?** | [MediFlowPRD.md](./MediFlowPRD.md) |
| **System architecture** | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Tech stack & versions** | [Techstack.md](./Techstack.md) |
| **What will bite you** | [gotchas.md](./gotchas.md) |

---

## Full File Map

### 🔵 Core Context

| File | Purpose | When to Read |
| ---- | ------- | ------------ |
| [index.md](./index.md) | This file — navigation hub | Always (first) |
| [AGENT.md](../../AGENT.md) | Agent workflow contract, code standards, security rules | Always (second) |
| [MediFlowPRD.md](./MediFlowPRD.md) | Full Product Requirements Document | Feature scoping, understanding the vision |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System topology, layer breakdown, AI modules, deployment | Any architectural decision |
| [Techstack.md](./Techstack.md) | Every technology, version, and purpose | Choosing libraries, checking versions |
| [gotchas.md](./gotchas.md) | Critical pitfalls, warnings, tips, conventions | Before any implementation |

### 🟢 Implementation Reference

| File | Purpose | When to Read |
| ---- | ------- | ------------ |
| [FRONTEND_REFERENCE.md](./FRONTEND_REFERENCE.md) | Design system, routes, components, state management | Frontend work |
| [codebase-and-runtime.md](./codebase-and-runtime.md) | Repo structure, dev setup, commands, env vars, testing | Setting up, running, debugging |
| [pipeline-and-architecture.md](./pipeline-and-architecture.md) | Request flow, auth flow, AI pipelines, payment flow, queue management | Backend/AI work, understanding data flow |
| [product-and-mvp.md](./product-and-mvp.md) | MVP features, user flows, priorities, success metrics | Feature planning, scope decisions |

### 🟡 Skills (Coding References)

| Directory | Contents |
| --------- | -------- |
| [Backend-skills/](../skills/Backend-skills/) | FastAPI patterns, PostgreSQL/pgvector, Redis, backend task workflows |
| [frontend-design/](../skills/frontend-design/) | React component patterns, ShadCN usage, frontend design skill |
| [playwright/](../skills/playwright/) | E2E testing with Playwright |
| [webapp-testing/](../skills/webapp-testing/) | Web application testing strategies |

### 🔴 Tasks

| File | Purpose |
| ---- | ------- |
| [tasks/active/TASK.md](../tasks/active/TASK.md) | Current active task and progress tracking |

---

## Reading Order by Task Type

### 🆕 Starting a new feature

1. `index.md` (this file)
2. `AGENT.md`
3. `product-and-mvp.md` (check if it's in scope)
4. `ARCHITECTURE.md` (understand where it fits)
5. `gotchas.md` (avoid pitfalls)
6. `FRONTEND_REFERENCE.md` or `pipeline-and-architecture.md` (depending on layer)

### 🐛 Debugging an issue

1. `codebase-and-runtime.md` (find the file, run commands)
2. `gotchas.md` (known pitfalls)
3. `pipeline-and-architecture.md` (understand the flow)

### 🏗️ Architecture decision

1. `ARCHITECTURE.md` (current state)
2. `Techstack.md` (available tools)
3. `MediFlowPRD.md` (product requirements)
4. `gotchas.md` (constraints)

### 🧪 Writing tests

1. `codebase-and-runtime.md` (test commands and locations)
2. Backend-skills or webapp-testing skills
3. `gotchas.md` (edge cases to test)

---

## Document Maintenance

- **Who updates:** Any agent or developer making architectural or scope changes
- **When:** After any change that affects architecture, tech stack, conventions, or project structure
- **Rule:** If you change how something works, update the relevant context file
