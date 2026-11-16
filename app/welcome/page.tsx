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
import { BackupCard } from "../components/BackupCard";
import { LangToggle, useLang } from "../lib/lang";
import { fmtKcal } from "../lib/nutrition";
import { EMPTY_PROFILE, fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";
import type { Profile } from "../lib/types";
import { Icon } from "../components/Icon";

const TITLES = [
  { th: "ยินดีต้อนรับ", en: "Welcome" },
  { th: "ร่างกายของคุณ", en: "Your body" },
  { th: "ชีวิตประจำวัน", en: "Your daily life" },
  { th: "ใช้แอปนี้เพื่ออะไร", en: "What is this app for?" },
  { th: "เป้าหมายต่อวันของคุณ", en: "Your daily target" },
];

export default function WelcomePage() {
  const { goals, setGoals } = useStore();
  const router = useRouter();
  const { tr, lang } = useLang();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(() => fillProfile(goals.profile) ?? EMPTY_PROFILE);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  // Her own number, once she taps and edits the big target.
  const [own, setOwn] = useState<number | null>(null);

  const problem =
    step === 0
      ? p.name?.trim()
        ? null
        : tr("ใส่ชื่อก่อนนะ", "Enter your name first")
      : step === 1
        ? bodyProblem(p, lang)
        : step === 3
          ? reasonProblem(p, lang)
          : null;
  const plan = useMemo(
    () => (step === 3 && usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null),
    [p, step],
  );
  const result = useMemo(() => (step === 4 ? estimateEnergy(p, lang) : null), [p, step, lang]);
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
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper" onClick={() => setStep(step - 1)} aria-label={tr("ย้อนกลับ", "Back")}>
            <Icon name="caret-left" className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" />
        )}
        <div className="flex flex-1 justify-center gap-2" aria-label={tr(`ขั้นที่ ${step + 1} จาก 5`, `Step ${step + 1} of 5`)}>
          {TITLES.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-7 bg-ink" : i < step ? "w-2 bg-yellow-deep" : "w-2 bg-line"}`} />
          ))}
        </div>
        <span className="h-11 w-11 shrink-0" />
      </div>

      <h1 className="mb-1 text-[28px] font-bold">{TITLES[step][lang]}</h1>
      {step === 0 && (
        <p className="mb-5 text-[16px] text-muted">
          {tr("ตั้งค่าครั้งแรกนิดเดียว แล้วเริ่มบันทึกอาหารได้เลย", "A quick first-time setup, then you can start logging food")}
        </p>
      )}
      {step === 1 && <p className="mb-5 text-[16px] text-muted">{tr("ใช้คำนวณพลังงานที่ร่างกายใช้ต่อวัน", "Used to work out how much energy your body uses each day")}</p>}
      {step === 2 && <p className="mb-5 text-[16px] text-muted">{tr("ตอบแบบที่ใกล้ตัวคุณที่สุด", "Pick what is closest to you")}</p>}
      {step === 3 && <p className="mb-5 text-[16px] text-muted">{tr("เลือกหนึ่งข้อ", "Pick one")}</p>}
      {step === 4 && <p className="mb-5 text-[16px] text-muted">{tr("แก้ได้ทุกเมื่อในหน้าโปรไฟล์", "You can change this any time on the Profile page")}</p>}

      <section className="card space-y-4 p-5">
        {step === 0 && (
          <>
            <div>
              <span className="label">ภาษา / Language</span>
              <LangToggle />
            </div>
            <NameField p={p} set={set} />
          </>
        )}
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
              caption={result?.ok && own == null ? tr("เป้าที่แนะนำ", "Suggested target") : tr("เป้าของฉัน", "My target")}
            />
            {own != null && suggested != null && own !== suggested && (
              <button className="mx-auto block text-[15px] text-olive-dark underline" onClick={() => setOwn(null)}>
                {tr("กลับไปใช้ค่าที่แนะนำ", "Go back to the suggestion")} ({fmtKcal(suggested)})
              </button>
            )}
            {protein != null && (
              <p className="rounded-2xl bg-protein px-4 py-3 text-center text-[15px] text-protein-ink">
                {tr("เป้าโปรตีน", "Protein goal")} ≈ <b className="num">{protein}</b> {tr("g/วัน", "g/day")}
              </p>
            )}
          </div>
        )}
      </section>

      {step === 0 && (
        <div className="mt-4">
          <BackupCard restoreOnly />
        </div>
      )}
      {step === 3 && p.reason && problem && (
        <p className="mt-3 text-center text-[14px] text-warn-ink">{problem}</p>
      )}
      <div className="min-h-5 flex-1" />
      <div className="sticky bottom-0 bg-cream pt-3 pb-[env(safe-area-inset-bottom,0px)]">
        {step < 4 ? (
          <button className="btn-primary w-full !min-h-[58px] text-[19px]" disabled={!!problem} onClick={() => setStep(step + 1)}>
            {tr("ถัดไป", "Next")}
          </button>
        ) : (
          <button className="btn-primary w-full !min-h-[58px] text-[19px]" disabled={!validKcal(target)} onClick={finish}>
            {tr("เริ่มใช้งาน", "Start")}
          </button>
        )}
      </div>
    </main>
  );
}
