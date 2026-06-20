# MediFlow AI — Frontend Reference

---

## 1. Design System

### Color Palette

```css
/* Primary — Medical Blue */
--primary:        220 90% 56%;     /* #2563EB */
--primary-hover:  220 90% 48%;
--primary-light:  220 90% 96%;

/* Secondary — Healthcare Teal */
--secondary:      168 76% 42%;     /* #0D9488 */

/* Accents */
--success:        142 72% 45%;     /* #16A34A — available / healthy */
--warning:        38 92% 50%;      /* #F59E0B — low stock / attention */
--danger:         0 84% 60%;       /* #EF4444 — critical / emergency */
--info:           199 89% 48%;     /* #0EA5E9 — informational */

/* Neutrals (dark mode first) */
--background:     222 47% 11%;     /* #0F172A */
--surface:        217 33% 17%;     /* #1E293B */
--surface-hover:  215 28% 23%;    /* #334155 */
--border:         215 20% 30%;
--text-primary:   210 40% 98%;
--text-secondary: 215 20% 65%;
--text-muted:     215 16% 47%;
```

### Typography

```css
/* Font Stack */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs:   0.75rem;   /* 12px — labels, badges */
--text-sm:   0.875rem;  /* 14px — body secondary */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — section headers */
--text-xl:   1.25rem;   /* 20px — card titles */
--text-2xl:  1.5rem;    /* 24px — page titles */
--text-3xl:  1.875rem;  /* 30px — hero headlines */
```

### Spacing & Layout

```css
--spacing-unit: 0.25rem;  /* 4px base */
/* Use multiples: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px) */

/* Content widths */
--max-width-sm:  640px;    /* Single column content */
--max-width-md:  768px;    /* Narrow dashboard */
--max-width-lg:  1024px;   /* Dashboard panels */
--max-width-xl:  1280px;   /* Full dashboard */

/* Sidebar */
--sidebar-width: 280px;
--sidebar-collapsed: 72px;
```

---

## 2. Route Structure (App Router)

```
/app
├── layout.tsx                    # Root layout (fonts, theme, Clerk provider)
├── page.tsx                      # Landing / marketing page
├── (auth)/
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   └── layout.tsx                # Auth-specific layout (centered card)
│
├── (patient)/
│   ├── layout.tsx                # Patient sidebar + nav
│   ├── dashboard/page.tsx        # PID card, upcoming appointments, reminders
│   ├── appointments/
│   │   ├── page.tsx              # Appointment list
│   │   └── book/page.tsx         # AI triage → booking flow
│   ├── history/page.tsx          # Medical history timeline
│   ├── reports/page.tsx          # Uploaded reports
│   ├── chat/page.tsx             # AI chat assistant
│   └── settings/page.tsx
│
├── (reception)/
│   ├── layout.tsx                # Reception sidebar
│   ├── dashboard/page.tsx        # Queue board, check-in scanner
│   ├── check-in/page.tsx         # QR scan + manual PID lookup
│   └── appointments/page.tsx     # Day's appointment list
│
├── (doctor)/
│   ├── layout.tsx                # Doctor sidebar
│   ├── dashboard/page.tsx        # Today's patients, schedule
│   ├── patient/[pid]/page.tsx    # Full patient view (timeline, summary)
│   ├── consultation/[id]/page.tsx # Active consultation (notes, Rx)
│   └── prescriptions/page.tsx    # Prescription history
│
├── (pharmacy)/
│   ├── layout.tsx                # Pharmacy sidebar
│   ├── dashboard/page.tsx        # Pending prescriptions queue
│   ├── prescription/[id]/page.tsx # Single Rx view + dispense
│   ├── inventory/page.tsx        # Stock management
│   └── billing/page.tsx          # Payment processing
│
└── (admin)/
    ├── layout.tsx                # Admin sidebar
    ├── dashboard/page.tsx        # Analytics overview
    ├── staff/page.tsx            # Staff management
    └── reports/page.tsx          # Operational reports
```

---

## 3. Core Components

### Shared Components (`/components/ui/`)

All ShadCN components — installed via CLI, customized via `components.json`.

### Feature Components (`/components/`)

```
/components
├── patient/
│   ├── PIDCard.tsx               # Patient ID display with QR
│   ├── AppointmentBookingWizard.tsx
│   ├── MedicalTimeline.tsx       # Chronological history view
│   ├── MedicineReminderCard.tsx
│   └── AIChat.tsx                # Chat interface for AI assistant
│
├── reception/
│   ├── QueueBoard.tsx            # Real-time queue display
│   ├── QRScanner.tsx             # Check-in scanner
│   └── CheckInForm.tsx
│
├── doctor/
│   ├── PatientSummaryCard.tsx    # AI-generated clinical summary
│   ├── PatientTimeline.tsx       # Full history timeline
│   ├── ConsultationNotes.tsx     # SOAP note editor + AI generation
│   ├── PrescriptionBuilder.tsx   # Medicine selection + dosage
│   ├── DrugInteractionAlert.tsx  # AI conflict warnings
│   └── PIDSearchBar.tsx
│
├── pharmacy/
│   ├── PrescriptionViewer.tsx    # Rx detail view
│   ├── AlternativeMedicineCard.tsx
│   ├── InventoryTable.tsx        # Stock management table
│   └── PaymentForm.tsx           # Razorpay integration
│
├── shared/
│   ├── Sidebar.tsx               # Role-adaptive sidebar navigation
│   ├── Header.tsx                # Top bar with user menu
│   ├── StatusBadge.tsx           # Appointment/prescription status
│   ├── LoadingSpinner.tsx
│   ├── EmptyState.tsx            # Illustrated empty states
│   └── ErrorBoundary.tsx
│
└── ai/
    ├── AIResponseCard.tsx        # Formatted AI output display
    ├── TriageResultCard.tsx      # Department + priority display
    └── RxExplanationCard.tsx     # Patient-friendly Rx explanation
```

---

## 4. State Management

### Server State — TanStack Query

```typescript
// Example: Patient data hook
export function usePatient(pid: string) {
  return useQuery({
    queryKey: ['patient', pid],
    queryFn: () => api.patients.getByPid(pid),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Example: Appointment mutation
export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.appointments.book,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
```

### Client State — React Context (minimal)

- `ThemeContext` — dark/light mode
- `SidebarContext` — collapsed/expanded state
- `QueueContext` — real-time queue position (reception only)

---

## 5. API Client Layer

```typescript
// /lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const api = {
  patients: {
    getByPid: (pid: string) => get(`/patients/${pid}`),
    register: (data: RegisterDTO) => post('/patients', data),
  },
  appointments: {
    list: (params?: AppointmentFilters) => get('/appointments', params),
    book: (data: BookDTO) => post('/appointments', data),
    checkIn: (id: string) => patch(`/appointments/${id}/check-in`),
  },
  consultations: {
    start: (appointmentId: string) => post(`/consultations`, { appointmentId }),
    generateNotes: (id: string, transcript: string) =>
      post(`/consultations/${id}/notes`, { transcript }),
    generatePrescription: (id: string, diagnosis: string) =>
      post(`/consultations/${id}/prescription`, { diagnosis }),
  },
  pharmacy: {
    pendingPrescriptions: () => get('/pharmacy/prescriptions/pending'),
    dispense: (prescriptionId: string) => post(`/pharmacy/dispense/${prescriptionId}`),
    inventory: () => get('/pharmacy/inventory'),
  },
  ai: {
    triage: (symptoms: string) => post('/ai/triage', { symptoms }),
    explainRx: (prescriptionId: string) => post(`/ai/explain-rx/${prescriptionId}`),
  },
  billing: {
    createOrder: (billId: string) => post(`/billing/${billId}/pay`),
    verifyPayment: (data: PaymentVerification) => post('/billing/verify', data),
  },
};
```

---

## 6. Responsive Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px    /* Mobile landscape */
md: 768px    /* Tablet */
lg: 1024px   /* Desktop */
xl: 1280px   /* Wide desktop */
2xl: 1536px  /* Ultra-wide */
```

### Dashboard Layout Strategy

- **Mobile (< 768px):** Single column, bottom navigation, collapsible cards
- **Tablet (768–1024px):** Sidebar collapsed by default, 2-column grid
- **Desktop (> 1024px):** Full sidebar, multi-panel dashboard layout

---

## 7. Accessibility Requirements

- All interactive elements must have visible focus indicators
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- All images/icons must have `alt` text or `aria-label`
- Keyboard navigation for all flows (Tab, Enter, Escape)
- Screen reader announcements for dynamic content changes (queue updates, AI responses)
- Status badges use icons + text (not color alone)

