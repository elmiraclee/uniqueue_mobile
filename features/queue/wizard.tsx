import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import { updateLiveTicketWidget } from "@/utils/live-ticket-widget";
import { useClientUI } from "@/components/client/client-ui";
import UnavailableServicesModal from "@/components/queue/unavailable-services-modal";
import { usePortal } from "../portal/context";
import {
  Actor,
  actorFields,
  flag,
  Office,
  officeProblem,
  positiveId,
} from "../portal/domain";
import { query, request } from "../portal/api";
import { useResource } from "../portal/use-resource";
import {
  Button,
  Card,
  Check,
  Copy,
  Empty,
  Field,
  Heading,
  Notice,
  Screen,
  Status,
  s,
} from "../portal/ui";
import {
  detailsProblem,
  Draft,
  fees,
  newDraft,
  regularPayload,
  requirements,
  Service,
} from "./model";
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.input, { padding: 0 }]}>
        <Picker
          style={
            Platform.OS === "web"
              ? {
                  fontSize: 16,
                  height: 48,
                  width: "100%",
                  borderWidth: 0,
                  backgroundColor: "transparent",
                }
              : undefined
          }
          accessibilityLabel={label}
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
        >
          <Picker.Item label="Select an option" value="" />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}
export default function QueueEntry() {
  const p = usePortal(),
    params = useLocalSearchParams(),
    slug = String(params.office || ""),
    eventId = positiveId(params.event_id),
    childId = positiveId(params.forStudentId) || p.actor.studentId;
  const child = p.children.find((c) => Number(c.id) === childId),
    actor = {
      ...p.actor,
      studentId: p.role === "student" ? p.user.id : childId,
    };
  if (
    p.role === "parent" &&
    (p.childrenLoading || (!child && !p.childrenError))
  )
    return (
      <Screen title="Choose a child" back>
        {p.childrenLoading ? (
          <ActivityIndicator />
        ) : (
          <Empty
            title="A linked child is required"
            description="Go back to Queue and select an active linked child."
          />
        )}
      </Screen>
    );
  if (p.childrenError && p.role === "parent")
    return (
      <Screen title="Children unavailable" back>
        <Notice
          message={p.childrenError}
          retry={() => void p.reloadChildren()}
        />
      </Screen>
    );
  if (!slug)
    return (
      <Screen title="No office selected" back>
        <Copy>Go back and choose an office.</Copy>
      </Screen>
    );
  return (
    <QueueWizard
      key={`${p.role}:${p.user.id}:${actor.studentId}:${slug}:${eventId}`}
      actor={actor}
      slug={slug}
      eventId={eventId}
      childName={child ? `${child.first_name} ${child.last_name}` : undefined}
    />
  );
}
function QueueWizard({
  actor,
  slug,
  eventId,
  childName,
}: {
  actor: Actor;
  slug: string;
  eventId: number;
  childName?: string;
}) {
  const p = usePortal(),
    ui = useClientUI(),
    [d, setDraft] = useState<Draft>(newDraft),
    [step, setStep] = useState(0),
    [mode, setMode] = useState<"request" | "payment">("request"),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState(""),
    [unavailable, setUnavailable] = useState(false),
    [viewStep, setViewStep] = useState<number | null>(null),
    [eventChecks, setEventChecks] = useState<number[]>([]),
    [eventPeriod, setEventPeriod] = useState(""),
    [eventYear, setEventYear] = useState(""),
    [windows, setWindows] = useState<string[]>([]),
    [gate, setGate] = useState(""),
    [success, setSuccess] = useState<any>(null);
  const lock = useRef(false),
    mounted = useRef(true),
    previewSerial = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const patch = (next: Partial<Draft>) => {
    setDraft((old) => ({ ...old, ...next }));
    setProblem("");
  };
  const load = useCallback(
    async (signal: AbortSignal) => {
      const officeData = await request(
          `queue_process.php?${query({ slug })}`,
          undefined,
          signal,
        ),
        office: Office = officeData.office;
      if (!office) throw new Error("Office not found.");
      let event: any = null;
      if (eventId)
        event = await request(
          `office-queue.php?${query({ action: "event", event_id: eventId, office_id: office.id, ...actorFields(actor) })}`,
          undefined,
          signal,
        );
      const officeId = event?.current_step?.office_id || office.id;
      const results = await Promise.all([
        request(
          `get_service_items.php?office_id=${office.id}`,
          undefined,
          signal,
        ),
        request("get_academic_data.php", { office_id: officeId }, signal).catch(
          (e) => ({ error: e.message, periods: [], school_years: [] }),
        ),
        ["payment", "hybrid"].includes(office.transaction_type || "") &&
        !eventId
          ? request(
              `get_payable_tickets.php?${query({ office_id: office.id, ...actorFields(actor) })}`,
              undefined,
              signal,
            )
          : Promise.resolve({ payable_tickets: [] }),
        event?.current_step
          ? request("get_offices.php", undefined, signal)
          : Promise.resolve(null),
      ]);
      const policy = event?.current_step
        ? results[3]?.offices?.find(
            (o: Office) =>
              Number(o.id) === Number(event.current_step.office_id),
          )
        : office;
      return {
        office,
        items: results[0].service_items as Service[],
        academic: results[1],
        payables: results[2].payable_tickets || [],
        event,
        policy,
      };
    },
    [slug, eventId, actor.id, actor.studentId, actor.role],
  );
  const r = useResource(load, eventId ? 4000 : 0),
    data = r.data,
    o = data?.office,
    ev = data?.event,
    payment =
      o?.transaction_type === "payment" ||
      (o?.transaction_type === "hybrid" && mode === "payment");
  const periods = (
      flag(data?.academic.academic_period_enabled, false)
        ? data?.academic.periods || []
        : []
    ) as any[],
    years = (data?.academic.school_years || []) as any[];
  const periodNames = periods.map((v) => String(v.label)),
    yearNames = years.map((v) => String(v.school_year));
  const current = ev?.current_step,
    shown = ev?.steps?.[viewStep ?? ev.current_step_index] || current,
    isCurrent = shown && Number(shown.id) === Number(current?.id),
    eventPolicy: Office | undefined = data?.policy;
  useEffect(() => {
    if (!o) return;
    setDraft((old) => ({
      ...old,
      type:
        old.type === "walkin" && flag(o.walkin_enabled)
          ? "walkin"
          : old.type === "appointment" && flag(o.appointment_enabled)
            ? "appointment"
            : flag(o.walkin_enabled)
              ? "walkin"
              : "appointment",
    }));
  }, [o?.id, o?.walkin_enabled, o?.appointment_enabled]);
  useEffect(() => {
    setViewStep(null);
    setEventChecks([]);
    setEventPeriod("");
    setEventYear("");
    patch({ proof: false, priority: false, reason: "" });
  }, [current?.id]);
  const preflight = useCallback(
    async (
      office: Office,
      ids: number[],
      purpose: string,
      signal?: AbortSignal,
    ) => {
      const pre = await request(
        `prequeue_check.php?${query({ ...actorFields(actor), office_id: office.id, type: d.type, purpose, svc_ids: ids.join(",") })}`,
        undefined,
        signal,
      );
      if (pre.allowed === false)
        throw new Error(
          (pre.reason || "You cannot join this queue yet.") +
            (pre.retry_at ? ` Try again around ${pre.retry_at}.` : ""),
        );
    },
    [actor.id, actor.studentId, actor.role, d.type],
  );
  useEffect(() => {
    setWindows([]);
    setGate("");
    if (!o || eventId || payment || !d.selected.length) return;
    const n = ++previewSerial.current,
      controller = new AbortController();
    const timer = setTimeout(() => {
      void Promise.all([
        preflight(o, d.selected, "request", controller.signal),
        request(
          `get_possible_windows.php?${query({ office_id: o.id, type: d.type, svc_ids: d.selected.join(",") })}`,
          undefined,
          controller.signal,
        ),
      ])
        .then(([, a]) => {
          if (n === previewSerial.current)
            setWindows((a.windows || []).map((w: any) => w.name));
        })
        .catch((e) => {
          if (n === previewSerial.current && !controller.signal.aborted)
            setGate(e.message);
        });
    }, 350);
    return () => {
      previewSerial.current++;
      clearTimeout(timer);
      controller.abort();
    };
  }, [o?.id, eventId, payment, d.selected, d.type, preflight]);
  const effectivePriority = flag((eventId ? eventPolicy : o)?.priority_enabled);
  const priority = (
    <Card>
      <Heading>Lane preference</Heading>
      {effectivePriority ? (
        <>
          <Check
            label="Request a priority lane (PWD, senior citizen, or pregnant)"
            checked={d.priority}
            onPress={() => patch({ priority: !d.priority })}
          />
          {d.priority && (
            <Field
              label="Priority reason"
              value={d.reason}
              onChangeText={(reason) => patch({ reason })}
            />
          )}
        </>
      ) : (
        <Copy muted>Only the regular lane is available.</Copy>
      )}
    </Card>
  );
  const proof =
    actor.role === "parent" ? (
      <Card>
        <Heading>Parent / guardian requirement</Heading>
        <Copy>
          You are queueing for {childName}. Bring physical proof of ID or
          authorization for counter verification.
        </Copy>
        <Check
          label="I will present physical ID / authorization at the counter"
          checked={d.proof}
          onPress={() => patch({ proof: !d.proof })}
        />
      </Card>
    ) : null;
  const academicFields = (
    value: { period: string; school_year: string },
    change: (key: "period" | "school_year", v: string) => void,
  ) => (
    <View style={{ gap: 12 }}>
      <Select
        label="Academic period"
        value={value.period}
        options={periods.map((v) => ({
          value: String(v.label),
          label: String(v.label),
        }))}
        onChange={(v) => change("period", v)}
      />
      <Select
        label="School year"
        value={value.school_year}
        options={years.map((v) => ({
          value: String(v.school_year),
          label: String(v.school_year),
        }))}
        onChange={(v) => change("school_year", v)}
      />
    </View>
  );
  const fail = (message: string) => {
    setProblem(message);
    return false;
  };
  async function submit() {
    if (lock.current || !data || r.error || success) return;
    lock.current = true;
    setBusy(true);
    setProblem("");
    try {
      let body: any;
      // Re-read policy immediately before mutation. A stale visual state is not permission.
      const fresh = await request(`queue_process.php?${query({ slug })}`),
        office: Office = fresh.office;
      if (!office) throw new Error("Office not available.");
      if (actor.role === "parent") {
        const links = await request(
          `get_parent_children.php?parent_id=${actor.id}`,
        );
        if (
          !(links.children || []).some(
            (c: any) => Number(c.id) === actor.studentId,
          )
        )
          throw new Error(
            "This child is no longer linked. Return to Home and refresh.",
          );
        if (!d.proof)
          throw new Error(
            "Confirm physical ID / authorization at the counter.",
          );
      }
      if (eventId) {
        const progress = await request(
          `office-queue.php?${query({ action: "event", event_id: eventId, office_id: office.id, ...actorFields(actor) })}`,
        );
        if (
          progress.event_completed ||
          !current ||
          Number(progress.current_step?.id) !== Number(current.id)
        )
          throw new Error(
            "The event has moved to another step. Refresh to continue.",
          );
        if (progress.active_ticket)
          throw new Error(
            "You already have an active event ticket. Open it before continuing.",
          );
        const policies = await request("get_offices.php"),
          policy = policies.offices.find(
            (x: Office) => Number(x.id) === Number(current.office_id),
          );
        if (!policy)
          throw new Error("Step office settings could not be loaded.");
        const policyProblem = officeProblem(policy, actor.role);
        if (policyProblem) throw new Error(policyProblem);
        const required = (progress.current_step.service_items || []).flatMap(
          (i: any) => (i.requirements || []).map((r: any) => Number(r.id)),
        );
        if (required.some((id: number) => !eventChecks.includes(id)))
          throw new Error("Confirm all requirements for this event step.");
        if (
          progress.current_step_requires_academic &&
          (!periodNames.includes(eventPeriod) || !yearNames.includes(eventYear))
        )
          throw new Error("Choose a valid academic period and school year.");
        if (flag(policy.priority_enabled) && d.priority && !d.reason.trim())
          throw new Error("Enter your priority reason.");
        body = {
          ...actorFields(actor),
          mode: "event",
          event_id: eventId,
          event_step_id: current.id,
          req_check: eventChecks,
          parent_proof_confirmed: d.proof,
          priority: flag(policy.priority_enabled) && d.priority,
          priority_reason:
            flag(policy.priority_enabled) && d.priority ? d.reason : "",
          ...(progress.current_step_requires_academic
            ? { academic_period: eventPeriod, school_year: eventYear }
            : {}),
        };
      } else {
        const policyProblem = officeProblem(office, actor.role);
        if (policyProblem) throw new Error(policyProblem);
        await preflight(
          office,
          payment ? [] : d.selected,
          payment ? "payment" : "request",
        );
        if (payment) {
          if (!data.payables.some((t: any) => Number(t.ticket_id) === d.source))
            throw new Error("Choose a completed request to pay for.");
          if (flag(office.priority_enabled) && d.priority && !d.reason.trim())
            throw new Error("Enter your priority reason.");
          if (
            !flag(
              d.type === "walkin"
                ? office.walkin_enabled
                : office.appointment_enabled,
            )
          )
            throw new Error("This queue type is no longer available.");
          body = {
            ...actorFields(actor),
            mode: "cashier",
            office_id: office.id,
            source_ticket_id: d.source,
            type: d.type,
            parent_proof_confirmed: d.proof,
            priority: flag(office.priority_enabled) && d.priority,
            priority_reason:
              flag(office.priority_enabled) && d.priority ? d.reason : "",
          };
        } else
          body = regularPayload(
            actor,
            office,
            data.items,
            d,
            periodNames,
            yearNames,
          );
      }
      const result = await request("office-queue.php", body);
      if (mounted.current) {
        setSuccess(result);
        if (result.ticket_id || result.id)
          void updateLiveTicketWidget({
            ticketId: Number(result.ticket_id || result.id),
            ticket: result.queue_number,
            office: office.name,
            window: result.window_name,
            status: result.status || "waiting",
          });
        ui.notify("Your queue ticket was created.");
      }
    } catch (e) {
      if (mounted.current)
        setProblem(
          e instanceof Error
            ? e.message
            : "Could not create the ticket. Check Home before retrying.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const openTicket = (ticket: any) =>
    router.replace({
      pathname: `/${actor.role}/ticket`,
      params: {
        ticketId: String(ticket.ticket_id || ticket.id),
        ...(actor.role === "parent"
          ? { childId: String(actor.studentId) }
          : {}),
      },
    } as any);
  if (success)
    return (
      <Screen
        title={
          success.reserved || success.status === "reserved"
            ? "Queue reserved"
            : "You’re in the queue"
        }
        back
      >
        <Card accent>
          <Heading>{o?.name}</Heading>
          <Text style={s.number}>#{success.queue_number}</Text>
          <Copy>
            {success.message || "Your ticket was created successfully."}
          </Copy>
          <Copy>{success.window_name || "Window assignment is pending."}</Copy>
          {(success.ticket_id || success.id) && (
            <Button title="Open ticket" onPress={() => openTicket(success)} />
          )}
          <Button
            title={eventId ? "Continue event" : "Return to Home"}
            secondary
            onPress={() => {
              if (eventId) {
                setSuccess(null);
                void r.reload();
              } else router.replace(`/${actor.role}/home` as any);
            }}
          />
        </Card>
      </Screen>
    );
  return (
    <Screen
      title={
        eventId ? ev?.event?.name || "Event queue" : o?.name || "Queue request"
      }
      subtitle={
        childName
          ? `Queueing for ${childName}`
          : "Create your campus service request."
      }
      back
      refreshing={r.loading}
      onRefresh={() => void r.reload()}
      updated={r.updated}
    >
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      {problem && (
        <Notice
          message={problem}
          retry={() => {
            setProblem("");
            void r.reload();
          }}
        />
      )}
      {r.loading && <ActivityIndicator color="#660810" />}
      {o && !eventId && officeProblem(o, actor.role) && (
        <Notice message={officeProblem(o, actor.role)} />
      )}
      {data && eventId > 0 && (
        <>
          <Heading>Event itinerary</Heading>
          {(ev.steps || []).map((st: any, index: number) => (
            <Button
              key={st.id}
              title={`${index + 1}. ${st.title}${Number(st.id) === Number(current?.id) ? " · Current step" : ""}`}
              secondary={Number(st.id) !== Number(shown?.id)}
              onPress={() => setViewStep(index)}
            />
          ))}
          {ev.event_completed ? (
            <Empty
              title="Event complete"
              description="All event steps have been completed. View your tickets and submitted feedback in History."
            />
          ) : (
            shown && (
              <>
                <Card accent>
                  <Heading>{shown.title}</Heading>
                  <Copy>{shown.office_name}</Copy>
                  {shown.description && <Copy muted>{shown.description}</Copy>}
                  {shown.linked_source && (
                    <>
                      <Copy>
                        Requested at {shown.linked_source.office_name} · #
                        {shown.linked_source.queue_number}
                      </Copy>
                      <Copy>
                        {shown.linked_source.amount_complete
                          ? `Amount to pay: ₱${Number(shown.linked_source.total).toFixed(2)}`
                          : `Known subtotal: ₱${Number(shown.linked_source.total).toFixed(2)} · final amount confirmed at cashier`}
                      </Copy>
                    </>
                  )}
                </Card>
                {(shown.service_items || []).map((item: any) => (
                  <Card key={item.service_item_id}>
                    <Heading>
                      {item.name} × {item.quantity}
                    </Heading>
                    {(item.requirements || []).map((req: any) => (
                      <Check
                        key={req.id}
                        label={req.requirement}
                        checked={eventChecks.includes(Number(req.id))}
                        disabled={!isCurrent || busy}
                        onPress={() =>
                          setEventChecks((v) =>
                            v.includes(Number(req.id))
                              ? v.filter((x) => x !== Number(req.id))
                              : [...v, Number(req.id)],
                          )
                        }
                      />
                    ))}
                  </Card>
                ))}
                {!isCurrent ? (
                  <Copy muted>
                    This is not the current actionable step. Only the current
                    step can be joined.
                  </Copy>
                ) : ev.active_ticket ? (
                  <Card>
                    <Heading>Active event ticket</Heading>
                    <Copy>
                      #{ev.active_ticket.queue_number} ·{" "}
                      {ev.active_ticket.window_name || "Window pending"}
                    </Copy>
                    <Status status={ev.active_ticket.status} />
                    <Button
                      title="View ticket"
                      onPress={() => openTicket(ev.active_ticket)}
                    />
                  </Card>
                ) : (
                  <>
                    {eventPolicy && officeProblem(eventPolicy, actor.role) && (
                      <Notice
                        message={officeProblem(eventPolicy, actor.role)}
                      />
                    )}
                    {ev.current_step_requires_academic && (
                      <Card>
                        <Heading>Academic details for this step</Heading>
                        {data.academic.error && (
                          <Notice message={data.academic.error} />
                        )}
                        {academicFields(
                          { period: eventPeriod, school_year: eventYear },
                          (key, v) =>
                            key === "period"
                              ? setEventPeriod(v)
                              : setEventYear(v),
                        )}
                      </Card>
                    )}
                    {priority}
                    {proof}
                    <Button
                      title="Join current event step"
                      loading={busy}
                      disabled={
                        !!r.error ||
                        !eventPolicy ||
                        !!officeProblem(eventPolicy, actor.role)
                      }
                      onPress={() => void submit()}
                    />
                  </>
                )}
              </>
            )
          )}
        </>
      )}
      {data && !eventId && (
        <>
          {o?.transaction_type === "hybrid" && (
            <Card>
              <Heading>Transaction purpose</Heading>
              <View style={s.row}>
                <Button
                  title="Request services"
                  secondary={mode !== "request"}
                  disabled={busy}
                  onPress={() => {
                    setMode("request");
                    setStep(0);
                    setProblem("");
                  }}
                />
                <Button
                  title="Pay for a request"
                  secondary={mode !== "payment"}
                  disabled={busy}
                  onPress={() => {
                    setMode("payment");
                    setStep(0);
                    setProblem("");
                  }}
                />
              </View>
            </Card>
          )}
          <Card>
            <Copy muted>
              Step {step + 1} of {payment ? 2 : 4} ·{" "}
              {payment
                ? ["Queue type", "Payment & confirmation"][step]
                : [
                    "Queue type",
                    "Service details",
                    "Requirements",
                    "Review & confirm",
                  ][step]}
            </Copy>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {Array.from({ length: payment ? 2 : 4 }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    backgroundColor: i <= step ? "#660810" : "#DED5D7",
                    borderRadius: 2,
                  }}
                />
              ))}
            </View>
          </Card>
          {step === 0 && (
            <Card>
              <Heading>How will you queue?</Heading>
              {flag(o?.walkin_enabled) && (
                <Check
                  label="Walk-in · queue in person"
                  checked={d.type === "walkin"}
                  onPress={() => patch({ type: "walkin", slip: false })}
                />
              )}
              {flag(o?.appointment_enabled) && (
                <Check
                  label="Appointment · bring your appointment slip"
                  checked={d.type === "appointment"}
                  onPress={() => patch({ type: "appointment", checks: [] })}
                />
              )}
              <Copy muted>
                Appointments require your physical appointment confirmation, not
                a date reservation made by this app.
              </Copy>
              <Button
                title="Continue"
                disabled={!!r.error || !!officeProblem(o!, actor.role)}
                onPress={() => setStep(1)}
              />
            </Card>
          )}
          {step === 1 && payment && (
            <>
              <Heading>Select a completed request to pay</Heading>
              {!data.payables.length && (
                <Empty
                  title="No payable requests"
                  description="Complete a service request that is payable at this office first."
                />
              )}
              {data.payables.map((t: any) => (
                <Card key={t.ticket_id}>
                  <Check
                    label={`#${t.queue_number} · ${t.source_office_name}`}
                    checked={d.source === Number(t.ticket_id)}
                    onPress={() => patch({ source: Number(t.ticket_id) })}
                  />
                  {(t.service_items || []).map((i: any, index: number) => (
                    <Copy key={index}>
                      {i.name} × {i.quantity}
                    </Copy>
                  ))}
                  <Copy>
                    {t.amount_complete
                      ? `Amount to pay: ₱${Number(t.total).toFixed(2)}`
                      : `Known subtotal: ₱${Number(t.total).toFixed(2)} · final amount at cashier`}
                  </Copy>
                </Card>
              ))}
              {priority}
              {proof}
              <Button
                title="Join payment queue"
                loading={busy}
                disabled={
                  !d.source || !!r.error || !!officeProblem(o!, actor.role)
                }
                onPress={() => void submit()}
              />
              <Button
                title="Previous step"
                secondary
                disabled={busy}
                onPress={() => setStep(0)}
              />
            </>
          )}
          {step === 1 && !payment && (
            <>
              <TextInput
                accessibilityLabel="Search services"
                style={s.input}
                placeholder="Search service names"
                value={search}
                onChangeText={setSearch}
              />
              <Select
                label="Category"
                value={category}
                options={[
                  "All",
                  ...new Set(data.items.map((i) => i.category || "General")),
                ].map((v) => ({ value: v, label: v }))}
                onChange={(v) => setCategory(v || "All")}
              />
              {!data.items.length && (
                <Empty
                  title="No available services"
                  description="Use Request an unavailable service to tell this office what you need."
                />
              )}
              {data.items
                .filter(
                  (i) =>
                    (category === "All" ||
                      (i.category || "General") === category) &&
                    i.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((item) => {
                  const selected = d.selected.includes(item.id),
                    quantity = d.quantities[item.id] || 1;
                  return (
                    <Card key={item.id}>
                      <Check
                        label={item.name}
                        checked={selected}
                        onPress={() =>
                          patch({
                            selected: selected
                              ? d.selected.filter((id) => id !== item.id)
                              : [...d.selected, item.id],
                            checks: [],
                          })
                        }
                      />
                      <Copy muted>
                        {(item.amount ?? item.price) != null
                          ? `Unit fee: ₱${Number(item.amount ?? item.price).toFixed(2)}`
                          : "Fee to be confirmed"}
                        {item.pay_at_cashier ? " · Pay at cashier" : ""}
                      </Copy>
                      {selected && (
                        <>
                          <Select
                            label={`Copies · ${item.name}`}
                            value={String(quantity)}
                            options={Array.from({ length: 99 }, (_, i) => ({
                              value: String(i + 1),
                              label: String(i + 1),
                            }))}
                            onChange={(v) =>
                              patch({
                                quantities: {
                                  ...d.quantities,
                                  [item.id]: Number(v) || 1,
                                },
                              })
                            }
                          />
                          {!!item.choices?.length && (
                            <Select
                              label={`Option · ${item.name}`}
                              value={String(d.choices[item.id] || "")}
                              options={item.choices.map((c) => ({
                                value: String(c.id),
                                label: c.label,
                              }))}
                              onChange={(v) =>
                                patch({
                                  choices: {
                                    ...d.choices,
                                    [item.id]: Number(v),
                                  },
                                  checks: [],
                                })
                              }
                            />
                          )}
                          {flag(item.use_academic_period, false) && (
                            <>
                              {(!periods.length ||
                                !years.length ||
                                data.academic.error) && (
                                <Notice
                                  message={
                                    data.academic.error ||
                                    "Academic options are unavailable. Refresh before continuing."
                                  }
                                />
                              )}
                              {Array.from({ length: quantity }, (_, i) => (
                                <View key={i} style={{ gap: 8 }}>
                                  <Copy>Academic details · Copy {i + 1}</Copy>
                                  {academicFields(
                                    d.academic[item.id]?.[i] || {
                                      period: "",
                                      school_year: "",
                                    },
                                    (key, v) => {
                                      const rows = Array.from(
                                        { length: quantity },
                                        (_, j) => ({
                                          ...(d.academic[item.id]?.[j] || {
                                            period: "",
                                            school_year: "",
                                          }),
                                        }),
                                      );
                                      rows[i] = { ...rows[i], [key]: v };
                                      patch({
                                        academic: {
                                          ...d.academic,
                                          [item.id]: rows,
                                        },
                                      });
                                    },
                                  )}
                                </View>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </Card>
                  );
                })}
              {priority}
              {gate && <Notice message={gate} />}
              <Button
                title="Continue to requirements"
                onPress={() => {
                  const error = detailsProblem(
                    data.items,
                    d,
                    periodNames,
                    yearNames,
                  );
                  if (error) return fail(error);
                  if (effectivePriority && d.priority && !d.reason.trim())
                    return fail("Enter your priority reason.");
                  setStep(2);
                }}
              />
              <Button
                title="Previous step"
                secondary
                onPress={() => setStep(0)}
              />
            </>
          )}
          {step === 2 && !payment && (
            <Card>
              <Heading>Prepare your requirements</Heading>
              {d.type === "appointment" ? (
                <Check
                  label="I will bring my Appointment Slip / confirmation to the window"
                  checked={d.slip}
                  onPress={() => patch({ slip: !d.slip })}
                />
              ) : requirements(data.items, d).length ? (
                requirements(data.items, d).map((req) => (
                  <Check
                    key={req}
                    label={req}
                    checked={d.checks.includes(req)}
                    onPress={() =>
                      patch({
                        checks: d.checks.includes(req)
                          ? d.checks.filter((v) => v !== req)
                          : [...d.checks, req],
                      })
                    }
                  />
                ))
              ) : (
                <Copy>No additional service requirements are listed.</Copy>
              )}
              <Button
                title="Review request"
                onPress={() => {
                  if (d.type === "appointment" && !d.slip)
                    return fail("Confirm your appointment slip.");
                  if (
                    d.type === "walkin" &&
                    requirements(data.items, d).some(
                      (v) => !d.checks.includes(v),
                    )
                  )
                    return fail("Confirm all requirements before continuing.");
                  setStep(3);
                }}
              />
              <Button
                title="Previous step"
                secondary
                onPress={() => setStep(1)}
              />
            </Card>
          )}
          {step === 3 && !payment && (
            <>
              <Card accent>
                <Heading>Review your request</Heading>
                <Copy>
                  {o?.name} ·{" "}
                  {d.type === "appointment" ? "Appointment" : "Walk-in"}
                </Copy>
                {data.items
                  .filter((i) => d.selected.includes(i.id))
                  .map((i) => (
                    <View key={i.id} style={{ gap: 4 }}>
                      <Copy>
                        {i.name} × {d.quantities[i.id] || 1}
                      </Copy>
                      {d.choices[i.id] > 0 && (
                        <Copy muted>
                          {
                            i.choices?.find((c) => c.id === d.choices[i.id])
                              ?.label
                          }
                        </Copy>
                      )}
                      {(d.academic[i.id] || [])
                        .slice(0, d.quantities[i.id] || 1)
                        .map((a, index) => (
                          <Copy muted key={index}>
                            Copy {index + 1}: {a.period} · {a.school_year}
                          </Copy>
                        ))}
                    </View>
                  ))}
                <Copy>
                  {fees(data.items, d).complete
                    ? "Estimated total"
                    : "Known subtotal"}
                  : ₱{fees(data.items, d).total.toFixed(2)}
                </Copy>
                {!fees(data.items, d).complete && (
                  <Copy muted>
                    Some fees are unspecified. Confirm the final amount at the
                    office.
                  </Copy>
                )}
                <Copy>
                  {effectivePriority && d.priority
                    ? `Priority lane · ${d.reason}`
                    : "Regular lane"}
                </Copy>
                {windows.length > 0 && (
                  <Copy muted>Possible windows: {windows.join(", ")}</Copy>
                )}
              </Card>
              {proof}
              {gate && <Notice message={gate} />}
              <Button
                title="Confirm & join queue"
                loading={busy}
                disabled={!!r.error || !!officeProblem(o!, actor.role)}
                onPress={() => void submit()}
              />
              <Button
                title="Edit requirements"
                secondary
                disabled={busy}
                onPress={() => setStep(2)}
              />
            </>
          )}
          <Button
            title="Request an unavailable service"
            secondary
            disabled={busy}
            onPress={() => setUnavailable(true)}
          />
        </>
      )}
      {unavailable && o && (
        <UnavailableServicesModal
          visible
          officeId={o.id}
          studentId={actor.studentId}
          parentId={actor.role === "parent" ? actor.id : undefined}
          childName={childName}
          onClose={() => setUnavailable(false)}
        />
      )}
    </Screen>
  );
}
