import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { publicRewardPeriod } from "./reward-public";

// Deliberately restricted to a disposable, local DB. Never run against the app DB.
const testUrl = process.env.REWARD_TEST_DATABASE_URL;
const expectedUrl = "postgres://postgres:reward-test-only@127.0.0.1:55439/rewards_test";
const address = "aZkj2EgiZkUbnKk6XMp9pf9f9SALXSAaTgz17ZEYUaq2UZy";
let database: Pool;
let repo: typeof import("./reward-repository");
let nodeId: number;
const month="2026-08";
const now=new Date("2026-09-01T00:00:00Z");

describe.skipIf(!testUrl)("reward repository on disposable PostgreSQL", () => {
  beforeAll(async () => {
    if (testUrl !== expectedUrl) throw new Error("Integration tests require the explicitly named disposable local database.");
    vi.stubEnv("DATABASE_URL",testUrl);
    database=new Pool({connectionString:testUrl});
    const schema=await readFile(join(process.cwd(),"src/lib/schema.sql"),"utf8");
    await database.query(schema);
    await database.query(schema); // Idempotence, including existing monitor schema.
    repo=await import("./reward-repository");
  });
  beforeEach(async () => {
    await database.query("truncate reward_audit,reward_payments,reward_entries,reward_periods,reward_profiles,node_samples,check_runs,monitored_nodes restart identity cascade");
    const node=await database.query("insert into monitored_nodes (label,name_pattern,enabled,created_at) values ('Archive test','test',false,'2026-07-01') returning id");
    nodeId=Number(node.rows[0].id);
    await repo.saveRewardProfile({nodeId,version:0,discordName:"Private Discord",region:"Japan",address,identityName:"Identity",hasIdentity:true,eligible:true});
    const run=await database.query("insert into check_runs (checked_at,status) values ('2026-08-01','success') returning id");
    await database.query(`insert into node_samples (node_id,check_run_id,checked_at,is_online) values
      ($1,$2,'2026-08-01T00:00:00Z',true),($1,$2,'2026-08-02T00:00:00Z',true)`,[nodeId,run.rows[0].id]);
  });
  afterAll(async () => {
    if (database) await database.end();
    if (repo) { const db=await import("./db"); await db.pool.end(); }
    vi.unstubAllEnvs();
  });
  async function created() { return (await repo.createRewardPeriod(month,now))!; }
  async function priced() {
    const p=await created();
    await repo.saveRewardSettings(month,p.version,"30","0.008","Verified test EMA30");
    return (await repo.getRewardPeriod(month))!;
  }
  async function confirmed() {
    const p=await priced();
    await repo.confirmRewardPeriod(month,p.version,now);
    return (await repo.getRewardPeriod(month))!;
  }

  it("migrates twice and includes eligible monitoring-disabled nodes",async () => {
    const p=await created();
    expect(p.status).toBe("draft"); expect(p.paymentMonth).toBe("2026-09"); expect(p.priceDate).toBe("2026-08-01");
    expect(p.entries).toHaveLength(1); expect(p.entries[0].availability.sampleCount).toBe(2);
    expect(p.entries[0].availability.availabilityPercent).toBe(100);
    expect(publicRewardPeriod(p)).toBeNull();
    await expect(repo.createRewardPeriod(month,now)).rejects.toThrow("already exists");
  });
  it("confirms immutable snapshots and preserves records after node deletion",async () => {
    const p=await confirmed();
    expect(p.entries[0].confirmedAmount).toBe("3750");
    await repo.saveRewardProfile({nodeId,version:1,discordName:"Changed",region:"Changed",address,identityName:"",hasIdentity:false,eligible:false});
    await database.query("update monitored_nodes set label='Renamed' where id=$1",[nodeId]);
    await database.query("delete from monitored_nodes where id=$1",[nodeId]);
    const after=(await repo.getRewardPeriod(month))!;
    expect(after.entries[0].label).toBe("Archive test"); expect(after.entries[0].discordName).toBe("Private Discord");
    expect(after.entries[0].hasIdentity).toBe(true); expect(after.entries[0].nodeRef).toBeNull();
    expect(after.entries[0].confirmedAmount).toBe("3750");
    expect((await repo.getRewardAudit(p.id)).some(a => a.action==="confirmed")).toBe(true);
    await expect(repo.refreshRewardPeriod(month,after.version)).rejects.toThrow("locked");
  });
  it("serializes same-version updates with one conflict rather than losing changes",async () => {
    const p=await created();
    const results=await Promise.allSettled([
      repo.saveRewardSettings(month,p.version,"30","0.008","First price"),
      repo.saveRewardSettings(month,p.version,"30","0.010","Second price")
    ]);
    expect(results.filter(r => r.status==="fulfilled")).toHaveLength(1);
    const failure=results.find(r => r.status==="rejected") as PromiseRejectedResult;
    expect(failure.reason.status).toBe(409);
    expect((await repo.getRewardPeriod(month))!.version).toBe(p.version+1);
  });
  it("prevents price overwrites and rejects invalid/manual changes without reasons",async () => {
    const p=await priced();
    await expect(repo.saveAutomaticRewardPrice(month,p.version,{price:"0.010",source:"Subscan",fetchedAt:now.toISOString()})).rejects.toThrow("cannot overwrite");
    await expect(repo.saveRewardSettings(month,p.version,"30","0.009","")).rejects.toThrow("reason");
    await expect(repo.saveRewardSettings(month,p.version,"30","0","Invalid")).rejects.toThrow("greater than zero");
    expect((await repo.getRewardPeriod(month))!.priceUsd).toBe("0.008");
  });
  it("applies refresh opt-outs while preserving explicit decisions",async () => {
    const p=await priced();
    await repo.saveRewardEntry(month,p.version,p.entries[0].id,"recovery","0","Reasoned zero override");
    let after=(await repo.getRewardPeriod(month))!;
    await repo.refreshRewardPeriod(month,after.version,now);
    after=(await repo.getRewardPeriod(month))!;
    expect(after.entries[0].state).toBe("recovery"); expect(after.entries[0].overrideAmount).toBe("0");
    await repo.saveRewardProfile({nodeId,version:1,discordName:"",region:"",address,identityName:"",hasIdentity:true,eligible:false});
    await repo.refreshRewardPeriod(month,after.version,now);
    expect((await repo.getRewardPeriod(month))!.entries).toHaveLength(0);
  });
  it("requires completed months, a positive price and reasoned decisions for insufficient data",async () => {
    const p=await created();
    await expect(repo.confirmRewardPeriod(month,p.version,now)).rejects.toThrow("price");
    await repo.saveRewardSettings(month,p.version,"30","0.008","Verified");
    await database.query("delete from node_samples");
    let after=(await repo.getRewardPeriod(month))!;
    await repo.refreshRewardPeriod(month,after.version,now);
    after=(await repo.getRewardPeriod(month))!;
    expect(after.entries[0].availability.availabilityPercent).toBeNull();
    await expect(repo.confirmRewardPeriod(month,after.version,now)).rejects.toThrow("insufficient");
    await repo.saveRewardEntry(month,after.version,after.entries[0].id,"inactive",null,"Verified not running");
    after=(await repo.getRewardPeriod(month))!;
    await repo.confirmRewardPeriod(month,after.version,now);
    expect((await repo.getRewardPeriod(month))!.entries[0].confirmedAmount).toBe("0");
    const current=(await repo.createRewardPeriod("2026-09",new Date("2026-09-15T00:00:00Z")))!;
    await expect(repo.confirmRewardPeriod(current.month,current.version,new Date("2026-09-15T00:00:00Z"))).rejects.toThrow("complete");
    await expect(repo.confirmRewardPeriod(current.month,current.version,new Date("2026-10-01T00:00:00Z"))).rejects.toThrow("Refresh observations");
  });
  it("records partial payments, prevents duplicates, and audits corrections",async () => {
    let p=await confirmed(); const entryId=p.entries[0].id;
    const transfer={amount:"1000",paidOn:"2026-09-01",txUrl:"https://astar.subscan.io/extrinsic/1-1",memo:"Private memo"};
    await repo.saveRewardPayment(month,p.version,entryId,transfer);
    p=(await repo.getRewardPeriod(month))!;
    expect(publicRewardPeriod(p)!.entries[0].status).toBe("Partially paid");
    await expect(repo.saveRewardPayment(month,p.version,entryId,transfer)).rejects.toThrow("already recorded");
    await expect(repo.reopenRewardPeriod(month,p.version,"Edit")).rejects.toThrow("payments");
    await repo.saveRewardPayment(month,p.version,entryId,{...transfer,amount:"4000",paymentId:p.entries[0].payments[0].id,reason:"Correct transcription"});
    p=(await repo.getRewardPeriod(month))!;
    expect(publicRewardPeriod(p)!.entries[0].status).toBe("Overpaid");
    const audit=await repo.getRewardAudit(p.id);
    expect((audit.find(a => a.action==="payment_corrected")!.before as {amount:string}).amount).toBe("1000");
    await repo.correctPaidReward(month,p.version,entryId,"4000","Approved corrected entitlement");
    p=(await repo.getRewardPeriod(month))!;
    expect(p.entries[0].calculatedAmount).toBe("3750"); expect(p.entries[0].confirmedAmount).toBe("4000");
    expect(publicRewardPeriod(p)!.entries[0].status).toBe("Paid");
    expect((await repo.getRewardAudit(p.id)).find(a => a.action==="confirmed_amount_corrected")!.before).toMatchObject({confirmedAmount:"3750"});
  });
  it("reopens unpaid ledgers and requires confirmation to publish again",async () => {
    const p=await confirmed();
    await expect(repo.reopenRewardPeriod(month,p.version,"")).rejects.toThrow("reason");
    await repo.reopenRewardPeriod(month,p.version,"Recheck availability");
    const after=(await repo.getRewardPeriod(month))!;
    expect(after.entries[0].confirmedAmount).toBeNull(); expect(publicRewardPeriod(after)).toBeNull();
    expect(await repo.listRewardPeriods(true)).toEqual([]);
    await expect(repo.saveRewardPayment(month,after.version,after.entries[0].id,{amount:"1",paidOn:"2026-09-01",txUrl:"https://astar.subscan.io/extrinsic/1-1",memo:""})).rejects.toThrow("Confirm");
  });
});
