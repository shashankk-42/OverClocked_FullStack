# MediFlow AI Enhancement Integration Plan

## 1. Architecture Impact Analysis

MediFlow AI is currently a modular monolith:

- Backend: FastAPI in `src/backend/app`, async SQLAlchemy models, routers, services, JWT demo auth, startup-time `Base.metadata.create_all`.
- Frontend: Next.js App Router in `src/frontend/app`, role portals under `patient`, `doctor`, `reception`, and `pharmacy`, shared `Sidebar`, Axios API client, local JWT auth context.
- Current core domains: patients, users, doctors, appointments, consultations, prescriptions, pharmacy inventory, bills, reports, AI triage/chat/SOAP/Rx helpers.
- Current gaps for the 19 enhancements: no migration system in use, no audit model, no notification model, no real-time channel, no organization/hospital tenant boundary, no nurse role UI, no file-access policy layer, no event bus, no granular permissions, no care-team model.

The safest path is to keep the modular monolith but add shared platform primitives before feature work:

1. `hospital_id` tenancy foundation on all clinical and operational tables.
2. Alembic migrations replacing startup schema creation for production changes.
3. Audit logging middleware and service.
4. Notification/event service with WebSocket/SSE delivery and durable notification rows.
5. Permission policies beyond role-only guards, especially for family, care team, emergency QR, reports, and insurance.
6. File upload/security service for visual triage and test result center.
7. AI job/result abstraction so risk scoring, summaries, image triage, and assistants are traceable and reviewable.

Existing functionality to reuse:

- `patients.pid`, blood group, allergies, emergency contact for QR/emergency cards.
- `appointments.status`, `queue_position`, `priority`, `chief_complaint`, `triage_department` for wait prediction, cancellation recovery, earlier-slot waitlist, and emergency interruptions.
- `prescriptions.medicines` JSONB for medication timeline and cost analysis snapshots.
- `pharmacy_items.generic_name`, stock, and pricing for generic alternatives and substitution requests.
- `reports` as the base for digital test results, with extensions for secure sharing and imaging categories.
- `ai/triage.py`, `ai/gemini_client.py`, `ai/patient_summary.py` for follow-up risk, patient assistant, and visual triage.

## 2. Dependency Map

Shared foundations:

- Audit logging: required by all 19 modules.
- Notifications: required by emergency escalation, follow-ups, dispenser alerts, wait time changes, bed updates, earlier-slot offers, assistant escalation, cancellation recovery, care coordination, and patient journey tracking.
- Permissions: required by family accounts, insurance, QR access, reports, care coordination, and emergency access.
- AI job tracking: required by follow-up assistant, patient assistant, visual triage, summaries, and risk scoring.
- File storage: required by QR cards, test results, uploaded images, imaging reports, secure downloads.

Feature dependencies:

| Feature | Depends On | Reuses |
| --- | --- | --- |
| Emergency Escalation | notifications, audit, bed/location refs | patients, appointments, AI triage |
| AI Follow-Up Assistant | notifications, AI jobs, audit | patients, appointments, prescriptions |
| Medication Timeline | audit | prescriptions.medicines |
| Smart Dispenser | notifications, medication timeline | prescriptions, patients |
| Wait Prediction | event tracking, emergency events | appointments, doctors |
| Room/Bed Availability | notifications, tenancy | reception portal |
| Medication Cost Analysis | pharmacy pricing, approvals | prescriptions, pharmacy_items |
| Household/Family | permission model | users, patients |
| Insurance | audit, file storage | patients, bills |
| Earlier Slots | notifications, appointments | appointment cancellations/check-in |
| AI Patient Assistant | AI jobs, staff escalation | ai/chat, appointments, bills |
| Cancellation Recovery | notifications, waitlist | appointments, doctors |
| Patient Profile | audit, report access | patients, prescriptions, reports |
| Audit Logging | none | auth guards |
| QR Patient Access | permission model, secure tokens | patients |
| Test Results Center | file storage, sharing | reports |
| Care Coordination | permission model, notifications | doctors, patients |
| Journey Tracking | notifications, room/dept data | appointments |
| Visual Triage | file storage, AI jobs, emergency/follow-up | reports, ai/triage |

## 3. Database Migration Plan

First add Alembic and stop using `Base.metadata.create_all` in production. Keep startup creation only behind a dev flag.

Migration 001: platform foundations

- Add `hospitals`.
- Add nullable `hospital_id` to `patients`, `doctors`, `appointments`, `prescriptions`, `reports`, `pharmacy_items`, `bills`, `users`.
- Backfill default hospital.
- Add indexes on `hospital_id`, `pid`, `scheduled_at`, `status`.
- Add `audit_logs`.
- Add `notifications`.
- Add `domain_events`.

Migration 002: emergency, notifications, rooms

- `emergency_escalations`
- `emergency_responder_assignments`
- `hospital_locations`
- `rooms`
- `beds`
- `bed_occupancy_events`

Migration 003: clinical records and follow-ups

- `patient_conditions`
- `patient_allergies`
- `patient_procedures`
- `patient_vitals`
- `patient_visits`
- `treatment_history`
- `follow_up_plans`
- `follow_up_responses`
- `ai_risk_assessments`

Migration 004: medications, dispenser, costs

- `medication_timeline_items`
- `medication_dispenser_devices`
- `dispenser_medication_schedules`
- `medication_adherence_events`
- `missed_dose_alerts`
- `medication_cost_analyses`
- `substitution_requests`

Migration 005: family, insurance, access

- `family_groups`
- `family_members`
- `patient_access_grants`
- `insurance_policies`
- `insurance_members`
- `eligibility_checks`
- `insurance_claims`
- `qr_access_tokens`
- `qr_access_events`

Migration 006: appointments, assistant, care

- `appointment_wait_predictions`
- `appointment_waitlist_entries`
- `earlier_slot_offers`
- `assistant_conversations`
- `assistant_messages`
- `staff_escalation_tickets`
- `care_teams`
- `care_team_members`
- `care_notes`
- `treatment_plans`
- `care_discussions`
- `specialist_referrals`

Migration 007: reports, journey, visual triage

- Extend `reports` with `category`, `mime_type`, `file_size`, `storage_key`, `download_policy`, `uploaded_by_user_id`.
- `report_shares`
- `report_comparisons`
- `patient_journeys`
- `journey_steps`
- `visual_triage_uploads`
- `visual_triage_analyses`

Core table design notes:

- Use UUID primary keys everywhere.
- Store all timestamps as timezone-aware UTC.
- Add `created_at`, `updated_at`, and where appropriate `deleted_at`.
- Add state fields with explicit enum-like strings and database check constraints where practical.
- Keep prescription medicine snapshots in JSONB for history, but materialize medication timeline rows for querying and dispenser sync.

## 4. Feature Implementation Order

1. Foundations: Alembic, tenancy, audit logs, notifications, event service, permission policy helpers.
2. Patient profile, medication timeline, test result center: mostly extensions of existing patient/prescription/report data.
3. Emergency escalation and QR emergency access: high-value clinical safety modules using profile/audit/notifications.
4. Appointment operations: wait prediction, earlier-slot notifications, cancellation recovery.
5. Room and bed availability plus patient journey tracking.
6. Follow-up assistant and AI patient assistant.
7. Medication cost analysis and substitution approvals.
8. Family accounts and insurance integration.
9. Multi-doctor care coordination.
10. Smart dispenser infrastructure.
11. AI visual triage and multimodal risk workflows.

This order front-loads shared safety and compliance primitives, then builds user-visible features in clusters.

## 5. MVP vs Future Scope

MVP:

- Single hospital with `hospital_id` ready for multi-hospital expansion.
- Durable notifications plus WebSocket/SSE for active dashboards.
- Audit every read/write of critical medical data.
- Emergency escalation CRUD, dashboard, assignment, resolution.
- Follow-up questionnaire scheduling and manual doctor review.
- Medication timeline derived from prescriptions.
- Device registration APIs with simulated dispenser events.
- Wait prediction heuristic using queue length and recent delays.
- Bed/room availability CRUD and real-time dashboard refresh.
- Prescription cost breakdown using current pharmacy inventory prices.
- Family access grants with explicit permissions.
- Insurance policy storage and manually triggered eligibility estimate.
- Earlier-slot opt-in, offer, accept/expire workflow.
- Patient assistant with bounded FAQ/tools and staff escalation.
- Cancellation recovery with same doctor and alternative doctor options.
- Expanded patient profile and vitals trends.
- Secure QR emergency card with expiring access token.
- Test result listing, download, share links.
- Care notes, referrals, treatment plan ownership.
- Journey step tracking.
- Visual triage image upload with AI summary and urgency.

Future:

- Multi-hospital provisioning, tenant isolation, data residency controls.
- Redis/Kafka/NATS event bus and background workers.
- FHIR/HL7 insurance and lab integrations.
- Real IoT dispenser webhooks/MQTT/device certificates.
- Predictive ML models trained on hospital operations data.
- Clinical decision support validation and human-in-the-loop approval queues.
- Object storage with malware scanning, DICOM support, lifecycle policies.
- Advanced multimodal AI combining images, labs, history, and symptoms.
- Compliance exports for HIPAA/GDPR/ABDM-style audit programs.

## 6. API Specifications

All routes should be under `/api/v1`, use existing FastAPI dependency injection, and return the standard error shape `{ detail, code, field? }`.

### Audit and Notifications

- `GET /audit-logs`: admin/compliance, filters by actor, role, resource, action, date range.
- `GET /notifications`: current user notification feed.
- `PATCH /notifications/{id}/read`: mark read.
- `GET /events/stream`: authenticated SSE/WebSocket stream for dashboards.

### Emergency Escalation

- `POST /emergencies`: patient/nurse/doctor creates escalation.
- `GET /emergencies`: staff dashboard filters by status/severity/location.
- `GET /emergencies/{id}`: details and timeline.
- `PATCH /emergencies/{id}/assign`: assign responders.
- `PATCH /emergencies/{id}/status`: acknowledge, in_progress, resolved, cancelled.
- `POST /emergencies/{id}/notes`: resolution notes.

State: `triggered -> acknowledged -> assigned -> in_progress -> resolved`; alternate terminal `cancelled`.

### Follow-Ups

- `POST /follow-ups/plans`: doctor creates plan after consult/discharge.
- `GET /follow-ups/my`: patient follow-up queue.
- `POST /follow-ups/{id}/responses`: submit questionnaire/symptoms/adherence.
- `POST /follow-ups/{id}/risk-score`: run AI scoring.
- `GET /follow-ups/review`: doctor review dashboard.
- `PATCH /follow-ups/{id}/review`: mark reviewed, escalate, close.

### Medication and Dispenser

- `GET /medications/timeline/{patient_id}`: staff or authorized patient/family.
- `POST /devices/dispensers`: register device.
- `POST /devices/dispensers/{id}/sync`: sync medication schedule.
- `POST /devices/dispensers/{id}/events`: ingest simulated/hardware event.
- `GET /medications/adherence/{patient_id}`: adherence dashboard.

### Appointment Operations

- `GET /appointments/{id}/wait-prediction`: queue position, estimated wait, confidence.
- `POST /appointments/waitlist`: opt into earlier slots.
- `GET /appointments/waitlist/my`: patient waitlist entries.
- `POST /appointments/offers/{id}/accept`: one-click accept earlier slot.
- `POST /appointments/{id}/cancel`: cancel and trigger recovery.
- `GET /appointments/{id}/recovery-options`: same doctor and alternatives.

### Rooms, Beds, Journey

- `GET /rooms/availability`: reception occupancy dashboard.
- `GET /rooms/public-availability`: patient-facing room types, pricing, amenities.
- `PATCH /beds/{id}/status`: admin/reception/nurse updates bed.
- `POST /journeys`: create journey for appointment/admission.
- `PATCH /journeys/{id}/steps/{step_id}`: update current step.
- `GET /journeys/my/current`: patient current step.

### Cost, Family, Insurance

- `GET /prescriptions/{id}/cost-analysis`: cost breakdown and alternatives.
- `POST /prescriptions/{id}/substitution-requests`: request lower-cost substitute.
- `PATCH /substitution-requests/{id}/approve`: doctor approval/rejection.
- `POST /families`: create family group.
- `POST /families/{id}/members`: add dependent/member.
- `PATCH /families/{id}/members/{member_id}/permissions`: set access.
- `POST /insurance/policies`: create policy.
- `POST /insurance/eligibility-checks`: run eligibility estimate.
- `GET /insurance/claims`: claims tracking.

### AI Assistant, Reports, Care, Visual Triage

- `POST /assistant/conversations`: start conversation.
- `POST /assistant/conversations/{id}/messages`: send message.
- `POST /assistant/conversations/{id}/escalate`: escalate to staff.
- `GET /reports`: list authorized test results.
- `POST /reports/upload`: upload lab/imaging/prescription file.
- `POST /reports/{id}/share`: create secure share.
- `GET /reports/{id}/download`: secure download.
- `POST /care-teams`: create care team.
- `POST /care-teams/{id}/notes`: shared note.
- `POST /care-teams/{id}/referrals`: specialist referral.
- `POST /visual-triage/uploads`: upload image linked to patient/follow-up/emergency/appointment.
- `POST /visual-triage/{id}/analyze`: AI analysis.
- `GET /visual-triage/{id}`: retrieve image metadata and analysis.

## 7. Folder/File Changes

Backend additions:

```text
src/backend/alembic/
src/backend/alembic.ini
src/backend/app/models/audit.py
src/backend/app/models/notification.py
src/backend/app/models/hospital.py
src/backend/app/models/emergency.py
src/backend/app/models/follow_up.py
src/backend/app/models/medication.py
src/backend/app/models/device.py
src/backend/app/models/room.py
src/backend/app/models/family.py
src/backend/app/models/insurance.py
src/backend/app/models/waitlist.py
src/backend/app/models/care.py
src/backend/app/models/journey.py
src/backend/app/models/visual_triage.py
src/backend/app/routers/audit.py
src/backend/app/routers/notifications.py
src/backend/app/routers/emergencies.py
src/backend/app/routers/follow_ups.py
src/backend/app/routers/medications.py
src/backend/app/routers/devices.py
src/backend/app/routers/rooms.py
src/backend/app/routers/families.py
src/backend/app/routers/insurance.py
src/backend/app/routers/reports.py
src/backend/app/routers/care.py
src/backend/app/routers/journeys.py
src/backend/app/routers/visual_triage.py
src/backend/app/services/audit.py
src/backend/app/services/notifications.py
src/backend/app/services/events.py
src/backend/app/services/permissions.py
src/backend/app/services/file_storage.py
src/backend/app/services/emergency.py
src/backend/app/services/follow_up.py
src/backend/app/services/medication.py
src/backend/app/services/device.py
src/backend/app/services/room.py
src/backend/app/services/insurance.py
src/backend/app/services/care.py
src/backend/app/services/journey.py
src/backend/app/services/visual_triage.py
src/backend/app/ai/follow_up_risk.py
src/backend/app/ai/patient_assistant.py
src/backend/app/ai/visual_triage.py
src/backend/app/schemas/audit.py
src/backend/app/schemas/notifications.py
src/backend/app/schemas/emergency.py
src/backend/app/schemas/follow_up.py
src/backend/app/schemas/medication.py
src/backend/app/schemas/device.py
src/backend/app/schemas/room.py
src/backend/app/schemas/family.py
src/backend/app/schemas/insurance.py
src/backend/app/schemas/care.py
src/backend/app/schemas/journey.py
src/backend/app/schemas/visual_triage.py
```

Frontend additions:

```text
src/frontend/app/admin/audit/page.tsx
src/frontend/app/doctor/follow-ups/page.tsx
src/frontend/app/doctor/care-teams/page.tsx
src/frontend/app/doctor/emergencies/page.tsx
src/frontend/app/patient/family/page.tsx
src/frontend/app/patient/insurance/page.tsx
src/frontend/app/patient/medications/page.tsx
src/frontend/app/patient/reports/page.tsx
src/frontend/app/patient/journey/page.tsx
src/frontend/app/patient/rooms/page.tsx
src/frontend/app/patient/visual-triage/page.tsx
src/frontend/app/reception/emergencies/page.tsx
src/frontend/app/reception/rooms/page.tsx
src/frontend/app/reception/journeys/page.tsx
src/frontend/app/reception/waitlist/page.tsx
src/frontend/components/shared/EmergencyButton.tsx
src/frontend/components/shared/NotificationBell.tsx
src/frontend/components/patient/
src/frontend/components/doctor/
src/frontend/components/reception/
src/frontend/components/admin/
src/frontend/hooks/useEventStream.ts
src/frontend/lib/permissions.ts
src/frontend/types/
```

Also update:

- `src/backend/app/main.py`: include new routers and event stream.
- `src/backend/app/models/__init__.py`: import new models.
- `src/frontend/lib/api.ts`: add typed API clients by domain.
- Role layouts: add sidebar entries.
- `src/frontend/contexts/AuthContext.tsx`: include nurse and richer permission metadata.

## 8. Detailed Implementation Tasks

Foundation tasks:

1. Add Alembic, create baseline migration from current models, and document migration commands.
2. Add `hospitals` and `hospital_id`; backfill current data to a default hospital.
3. Replace all production schema creation with migrations.
4. Add `AuditLog` model and service.
5. Add FastAPI middleware that records request metadata: actor user, role, action, route/resource, timestamp, IP, user agent/device.
6. Add explicit service-level audit calls for high-risk reads/downloads and all writes.
7. Add `Notification` and `DomainEvent` models.
8. Add event publish helper used inside service transactions.
9. Add WebSocket/SSE endpoint for dashboard updates.
10. Add permission helpers: `can_access_patient`, `can_access_report`, `can_manage_family_member`, `can_access_care_team`.

Feature tasks:

- Emergency: model escalation/responder/timeline, emergency button component, role dashboards, responder assignment, resolution notes, audit every transition.
- Follow-up: plan templates, schedule jobs, patient questionnaire UI, risk scoring AI module, doctor review dashboard, escalation into emergency/care ticket.
- Medication timeline: materialize rows from prescriptions, show active/completed meds, prepare external schedule IDs for dispenser sync.
- Smart dispenser: register device, assign to patient, sync schedules, accept adherence events, generate missed-dose notifications.
- Wait prediction: store prediction snapshots, compute heuristic from queue length, status durations, doctor workload, active emergency interruptions.
- Room/bed: model rooms/beds, update occupancy, reception dashboard, patient room listing with pricing and amenities.
- Medication cost: compute cost from prescription JSONB and `pharmacy_items`, produce alternatives by generic name, require doctor substitution approval.
- Family: create groups, dependents, access grants, enforce access in patient/report/appointment routes.
- Insurance: policy CRUD, family/corporate policy types, eligibility estimate records, claim states.
- Earlier slots: waitlist entries, cancellation and check-in-timeout triggers, offer expiry, one-click accept endpoint.
- Patient assistant: tool-routed chat for appointments/billing/insurance/navigation/test prep, staff escalation tickets for unresolved questions.
- Cancellation recovery: cancellation endpoint returns recovery options and triggers waitlist notifications.
- Patient profile: add conditions/allergies/procedures/surgeries/vitals/treatments, patient trend UI.
- QR access: issue scoped token for emergency profile, printable card UI, log every scan.
- Test results: extend reports, secure upload/download/share, compare historical lab values.
- Care coordination: care team membership, notes, treatment plan, referral, threaded discussion, ownership rules.
- Journey tracking: journey and step states, patient current/next step UI, department/floor/room/duration fields.
- Visual triage: image upload validation, AI summary, abnormality/concern/urgency/confidence, link to emergency/follow-up/history.

## 9. Risk Assessment

High-risk areas:

- Compliance: current app lacks durable audit logs and granular access records.
- Schema safety: startup-time table creation is not enough for production migrations.
- Privacy: AI calls must anonymize PII and store AI output with provenance and review status.
- File security: uploaded images/reports need MIME validation, size limits, malware scanning in future, access logging, signed URLs.
- Real-time operations: emergency, bed, waitlist, and journey features need durable state first, then live delivery.
- Role model: nurse is referenced in requirements but not present in frontend auth union or layouts.
- Multi-hospital scale: without `hospital_id` from the start, later tenant migration will be expensive.
- Appointment concurrency: current booking conflict check is not atomic; earlier-slot and wait prediction features increase contention.

Mitigations:

- Add foundation migrations before feature migrations.
- Enforce backend permissions on every endpoint, not just sidebar visibility.
- Use transactions for state transitions and event creation.
- Audit critical reads and all writes.
- Keep all AI features advisory with doctor/staff review on clinical decisions.
- Add indexes by `hospital_id`, `patient_id`, `status`, `scheduled_at`, and event timestamps.

## 10. Production Deployment Considerations

- Run Alembic migrations in CI/CD before app rollout.
- Add seed/backfill scripts for default hospital and existing data.
- Configure CORS by environment, not wildcard.
- Add structured JSON logging with request IDs.
- Add background worker process for scheduled follow-ups, check-in timeouts, missed-dose detection, and notification delivery.
- Use Redis initially for pub/sub and cache, then graduate to Kafka/NATS if operational events grow.
- Move uploads from local `uploads/` to object storage with signed URLs before production.
- Add rate limits on auth, QR access, uploads, AI endpoints, and assistant chat.
- Add observability: API latency, event lag, notification delivery, AI latency/failure rate, emergency SLA timers.
- Add backup/restore and retention policies by data class.
- Add database connection pooling and read replicas for analytics/reporting at scale.
- Add row-level tenant assertions in services and tests.
- Add automated tests for every state transition, permission boundary, and audit log expectation.

