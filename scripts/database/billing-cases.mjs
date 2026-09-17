import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function runBillingCases({ sql, concurrentSql, roleSql, as, users }) {
  const service = (statement) => as(null, statement, "service_role");
  const token = randomUUID(),
    replacement = randomUUID();
  for (const [role, actor] of [
    ["anon", null],
    ["authenticated", users.a],
    ["authenticated", users.creator],
    ["authenticated", users.admin],
  ]) {
    for (const statement of [
      "select * from public.billing_accounts;",
      "select * from public.billing_events;",
      `select public.bind_billing_customer('${users.a}','cus_TestA');`,
      `select public.claim_billing_event('cus_TestA','event','${token}');`,
      `select public.finish_billing_event('cus_TestA','event','${token}',null);`,
      `select public.release_billing_lease('cus_TestA','${token}');`,
    ]) {
      assert.throws(() => as(actor, statement, role), /permission denied/);
    }
  }
  assert.equal(service(`select public.bind_billing_customer('${users.a}','cus_TestA');`), "cus_TestA");
  assert.equal(service(`select public.bind_billing_customer('${users.a}','cus_IgnoredRetry');`), "cus_TestA");
  assert.throws(
    () => service(`select public.bind_billing_customer('${users.b}','cus_TestA');`),
    /duplicate key/,
  );
  assert.equal(service(`select public.claim_billing_event('cus_TestA','event-old','${token}');`), "claimed");
  assert.equal(service(`select public.claim_billing_event('cus_TestA','event-old','${token}');`), "busy");
  assert.equal(
    service(`select public.claim_billing_event('cus_TestA','event-new','${replacement}');`),
    "busy",
  );
  service(
    "update public.billing_accounts set lease_expires_at=now()-interval '1 second' where customer_id='cus_TestA';",
  );
  assert.equal(
    service(`select public.claim_billing_event('cus_TestA','event-new','${replacement}');`),
    "claimed",
  );
  assert.throws(
    () => service(`select public.finish_billing_event('cus_TestA','event-old','${token}',null);`),
    /BILLING_LEASE_LOST/,
  );
  assert.throws(
    () => service(`select public.finish_billing_event('cus_TestA','event-old','${replacement}',null);`),
    /BILLING_LEASE_LOST/,
  );
  service(`select public.release_billing_lease('cus_TestA','${token}');`);
  assert.equal(
    sql("select lease_token::text from public.billing_accounts where customer_id='cus_TestA';"),
    replacement,
  );
  service(`select public.release_billing_lease('cus_TestA','${replacement}');`);
  assert.throws(
    () => service("select public.finish_billing_event('cus_TestA','event-new',null,null);"),
    /BILLING_LEASE_LOST/,
  );
  assert.equal(
    service(`select public.claim_billing_event('cus_TestA','event-new','${replacement}');`),
    "claimed",
  );
  assert.throws(
    () =>
      service(
        `select public.finish_billing_event('cus_TestA','event-new','${replacement}','{"plan":"studio","status":"active","validUntil":null}');`,
      ),
    /BILLING_INVALID_ENTITLEMENT/,
  );
  assert.equal(
    sql(
      "select count(*) from public.billing_events where customer_id='cus_TestA' and event_id='event-new' and processed_at is not null;",
    ),
    "0",
  );
  service(
    `select public.finish_billing_event('cus_TestA','event-new','${replacement}','{"plan":"studio","status":"active","validUntil":"2099-01-01T00:00:00Z"}');`,
  );
  assert.equal(
    sql(`select plan||':'||status||':'||source from public.account_entitlements where user_id='${users.a}';`),
    "studio:active:stripe",
  );
  assert.equal(sql(`select role from public.profiles where id='${users.a}';`), "learner");
  assert.equal(
    service(`select public.claim_billing_event('cus_TestA','event-new','${randomUUID()}');`),
    "complete",
  );
  assert.equal(service(`select public.claim_billing_event('cus_TestA','checkout','${token}');`), "claimed");
  service(`select public.finish_billing_event('cus_TestA','checkout','${token}',null);`);
  assert.equal(
    service(`select public.claim_billing_event('cus_TestA','checkout','${replacement}');`),
    "claimed",
  );
  service(`select public.release_billing_lease('cus_TestA','${replacement}');`);
  service(`select public.bind_billing_customer('${users.b}','cus_TestB');`);
  const attempts = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      concurrentSql(
        roleSql(
          "service_role",
          null,
          `select public.claim_billing_event('cus_TestB','competing-${i}','${randomUUID()}');`,
        ),
      ),
    ),
  );
  assert(attempts.every((result) => result.status === 0));
  assert.equal(attempts.filter((result) => result.stdout.trim() === "claimed").length, 1);
  assert.equal(attempts.filter((result) => result.stdout.trim() === "busy").length, 5);
  console.log(
    "PASS billing service-only authorization, customer binding, six competing claims, expired/null/stale/wrong-event lease fencing, atomic entitlement/receipt and duplicate delivery",
  );
}
