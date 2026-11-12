"use client";
// First-run setup. Locked: the app sends every screen here until a profile
// with a name and a reason is saved. One question per screen.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActivityFields,
  BigTarget,
  BodyFields,
  NameField,
  ReasonFields,
  bodyProblem,
  reasonProblem,
  validKcal,
} from "../components/profileFields";
import { estimateEnergy, proteinTargetG, usesWeightGoal, weightPlan } from "../lib/energy";
import { fmtKcal } from "../lib/nutrition";
import { EMPTY_PROFILE, fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";
import type { Profile } from "../lib/types";

const TITLES = ["ยินดีต้อนรับ 🌿", "ร่างกายของคุณ", "ชีวิตประจำวัน", "ใช้แอปนี้เพื่ออะไร", "เป้าหมายต่อวันของคุณ"];

export default function WelcomePage() {
  const { goals, setGoals } = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(() => fillProfile(goals.profile) ?? EMPTY_PROFILE);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  // Her own number, once she taps and edits the big target.
  const [own, setOwn] = useState<number | null>(null);

  const problem =
    step === 0 ? (p.name?.trim() ? null : "ใส่ชื่อก่อนนะ") : step === 1 ? bodyProblem(p) : step === 3 ? reasonProblem(p) : null;
  const plan = useMemo(
    () => (step === 3 && usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null),
    [p, step],
  );
  const result = useMemo(() => (step === 4 ? estimateEnergy(p) : null), [p, step]);
  const suggested = result?.ok ? result.suggested : null;
  const target = own ?? suggested ?? goals.targetKcal;
  const protein = proteinTargetG(p);

  function finish() {
    if (!validKcal(target)) return;
    setGoals({
      ...goals,
      targetKcal: Math.round(target),
      targetSource: own == null && result?.ok ? "calc" : "manual",
      profile: { ...p, name: p.name!.trim() },
      maintenanceKcal: result?.ok ? result.maintenance : goals.maintenanceKcal,
      skippedEstimate: false,
    });
    router.replace("/");
  }

  return (
    <main className="page flex min-h-dvh flex-col !pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
      <div className="mb-5 flex items-center gap-3">
        {step > 0 ? (
          <button className="h-11 w-11 shrink-0 rounded-full bg-paper text-[20px]" onClick={() => setStep(step - 1)} aria-label="ย้อนกลับ">
            ‹
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" />
        )}
        <div className="flex flex-1 justify-center gap-2" aria-label={`ขั้นที่ ${step + 1} จาก 5`}>
          {TITLES.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-7 bg-olive" : i < step ? "w-2 bg-olive/60" : "w-2 bg-line"}`} />
          ))}
        </div>
        <span className="h-11 w-11 shrink-0" />
      </div>

      <h1 className="mb-1 text-[28px] font-bold">{TITLES[step]}</h1>
      {step === 0 && <p className="mb-5 text-[16px] text-muted">ตั้งค่าครั้งแรกนิดเดียว แล้วเริ่มบันทึกอาหารได้เลย</p>}
      {step === 1 && <p className="mb-5 text-[16px] text-muted">ใช้คำนวณพลังงานที่ร่างกายใช้ต่อวัน</p>}
      {step === 2 && <p className="mb-5 text-[16px] text-muted">ตอบแบบที่ใกล้ตัวคุณที่สุด</p>}
      {step === 3 && <p className="mb-5 text-[16px] text-muted">เลือกหนึ่งข้อ</p>}
      {step === 4 && <p className="mb-5 text-[16px] text-muted">แก้ได้ทุกเมื่อในหน้าโปรไฟล์</p>}

      <section className="card space-y-4 p-5">
        {step === 0 && <NameField p={p} set={set} />}
        {step === 1 && <BodyFields p={p} set={set} />}
        {step === 2 && <ActivityFields p={p} set={set} />}
        {step === 3 && <ReasonFields p={p} set={set} plan={plan} />}
        {step === 4 && (
          <div className="space-y-4" data-testid="welcome-result">
            {result && !result.ok && (
              <p className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">{result.message}</p>
            )}
            <BigTarget
              value={target}
              onChange={setOwn}
              caption={result?.ok && own == null ? "เป้าที่แนะนำ" : "เป้าของฉัน"}
            />
            {own != null && suggested != null && own !== suggested && (
              <button className="mx-auto block text-[15px] text-olive-dark underline" onClick={() => setOwn(null)}>
                กลับไปใช้ค่าที่แนะนำ ({fmtKcal(suggested)})
              </button>
            )}
            {protein != null && (
              <p className="rounded-2xl bg-protein px-4 py-3 text-center text-[15px] text-protein-ink">
                เป้าโปรตีน ≈ <b className="num">{protein}</b> g/วัน
              </p>
            )}
          </div>
        )}
      </section>

      {step === 3 && p.reason && problem && (
        <p className="mt-3 text-center text-[14px] text-warn-ink">{problem}</p>
      )}
      <div className="min-h-5 flex-1" />
      <div className="sticky bottom-0 bg-cream pt-3 pb-[env(safe-area-inset-bottom,0px)]">
        {step < 4 ? (
          <button className="btn-primary w-full !min-h-[58px] text-[19px]" disabled={!!problem} onClick={() => setStep(step + 1)}>
            ถัดไป
          </button>
        ) : (
          <button className="btn-primary w-full !min-h-[58px] text-[19px]" disabled={!validKcal(target)} onClick={finish}>
            เริ่มใช้งาน
          </button>
        )}
      </div>
    </main>
  );
}
