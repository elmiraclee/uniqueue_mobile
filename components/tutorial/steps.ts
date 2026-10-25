export type TourStep={screen:string;target:string;title:string;body:string;phase?:string};
const s=(screen:string,target:string,title:string,body:string,phase?:string):TourStep=>({screen,target,title,body,phase});
export function clientTourSteps(role:'student'|'parent'):TourStep[]{
 const home=role+'/home',history=role+(role==='parent'?'/history':'/queue'),profile=role+'/profile';
 const steps:TourStep[]=[
 s(home,'header','Welcome to UniQueue','This guide visits your real screens. Queue, ticket and CSM examples run in an isolated practice screen; no real transaction is submitted.'),
 s(home,'help','Replay anytime','Use the question mark to restart or resume this guide. Skipping does not change your account.'),
 s(home,'notice-list','Your notifications','The bell opens queue updates. Keep your account signed in to receive updates. Device notification permission is your choice.'),
 s(home,'dashboard','Your dashboard',role==='parent'?'Your linked children have separate queues and transaction records. Always check which child is selected.':'See your current queue and offices. Office availability and queue status may change.'),
 s(home,'dashboard','No active ticket?','An empty queue is normal. Office availability, requirements and daily limits still apply before joining.'),
 ];
 if(role==='parent')steps.push(s(home,'children','Linked children','Choose the correct child before opening a ticket or joining an office. A child’s queue is not a family-wide ticket.'),s('parent/add-child','child-form','Add or link a child','Add Child creates an Elementary-only profile. Link Existing checks exact first name, last name and SR code.'),s('parent/add-child','child-mode','Approval protects student access','Elementary links immediately. JHS, SHS and College students must approve. Validation does not prove guardianship or create a link.'));
 steps.push(
 s(home,'dashboard','Office services','Choose an available office and review its current services. Different offices can have different requirements.'),
 s('client-practice','queue-type','Practice queue','This is example data. These are the same queue-step components used by the real wizard. No network request can join a queue here.','type'),
 s('client-practice','queue-type','Queue step 1: type','Walk-in joins the queue today. Appointment follows office availability and requires the office’s appointment slip.','type'),
 s('client-practice','service-1','Queue step 2: services','Select services and quantities. One ticket can contain services from different categories.','services'),
 s('client-practice','quantity-1','Options and quantities','The + and − controls change copies. Some services also require a specific option. Check your selection.','services'),
 s('client-practice','academic-1','Academic details, per copy','Select Period and School Year for each copy. Use “same for all” only when every copy needs the same values.','academic'),
 s('client-practice','priority','Priority lane','Use priority only when eligible and give the required reason. Office settings control availability.','services'),
 s('client-practice','requirements','Queue step 3: requirements','Review each requirement before checking it. Appointment holders must confirm their appointment slip.','requirements'),
 s('client-practice','review','Queue step 4: review','Review type, services, quantities, options, academic details and priority before confirming.','review'),
 s('client-practice','review','Confirm safely','Only the real wizard creates a ticket. Confirm is disabled in practice. Payment and feedback cannot be submitted here.','review'),
 s('client-practice','ticket','Your ticket','Your ticket has its own number, office and status. Follow the assigned window when called.','ticket'),
 s('client-practice','ticket-eta','People ahead and ETA','ETA is an estimate, not a promised appointment time. It can change as the office serves or pauses.','ticket'),
 s('client-practice','ticket-services','Requested services','Check your services, options and quantities. Academic details should match the copy you requested.','ticket'),
 s(role+'/live-monitor','monitor-ticket','Live monitor','Monitor your selected office. Queue cards identify the current service and waiting status; expand for more detail.'),
 s(role+'/live-monitor','monitor-sound','Sound is optional','Live-monitor sound should be enabled deliberately. Device notification settings are separate from in-app sound.'),
 s('client-practice','ticket','Cancellation and requeue','Use the real ticket controls carefully. Cancellation may lose your place; a requeue offer has a limited response time.','ticket'),
 s(history,'history','Your transaction history','Completed and cancelled tickets stay in history. Open the correct transaction to review details.'),
 s(history,'history','A completed transaction','Completion means the office finished the ticket. CSM records your experience separately.'),
 s('client-practice','csm','Official CSM Revision 06','The survey is BatStateU-FO-CFS-01 Rev. 06, not the old star-only feedback form. Practice cannot submit a response.','csm'),
 s('client-practice','csm-consent','Consent and demographics','Third-party sharing is a Yes/No choice; No does not prevent CSM submission. Name and contact number are optional.','csm'),
 s('client-practice','csm-charter','Citizen’s Charter questions','CC1 and CC2 determine skipped questions. Skipped answers are cleared and must not be counted as responses.','csm'),
 s('client-practice','csm-ratings','Service quality ratings','SQD0–7 each need one 1–5 rating. For SQD8, rate only one of the two criteria; selecting one clears the other.','csm'),
 s(profile,'profile','Your profile','Keep personal and academic details accurate. Profile changes do not erase transaction history.'),
 s(profile,'password','Change password','Use at least 8 characters: uppercase, lowercase, number and special character. The checker updates as you type.'),
 s(profile,'password','Password visibility','The eye button shows or hides one field only. Keep passwords private and check that confirmation matches.'),
 s(profile,'linked-accounts','Linked accounts',role==='parent'?'Unlinking removes access to the child, not either account or transaction history. Relinking may need fresh approval.':'Review parent link requests before approving. Unlinking removes that parent’s access, not your profile or tickets.'),
 s(home,'notice-list','Account notices','An unlink notice belongs to each recipient account and should remain readable even after the relationship ends.'),
 s(home,'dashboard','Keep your account safe','Sign out on shared devices. Only approve requests from a parent or guardian you recognize.'),
 s(home,'help','You’re ready','You can repeat the guide from ?. Practice did not create any tickets, payments, feedback or profile changes.')
 );return steps;
}
