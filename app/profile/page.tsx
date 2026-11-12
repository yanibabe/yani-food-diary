"use client";
// Profile: who she is, her plan, and the daily kcal target (tap to edit).
// "แก้ข้อมูล" edits the same answers as first-run setup; a new suggestion
// only replaces the target after she confirms.

import { useMemo, useState } from "react";
import {
  ActivityFields,
  BigTarget,
  BodyFields,
  NameField,
  PlanSummary,
  ReasonFields,
  bodyProblem,
  kg,
  reasonProblem,
  validKcal,
} from "../components/profileFields";
import {
  ACTIVITY_LEVELS,
  DAILY_LABEL,
  EXERCISE_LABEL,
  REASON_LABEL,
  activityLevel,
  estimateEnergy,
  macroTargets,
  proteinTargetG,
  usesWeightGoal,
  weightPlan,
} from "../lib/energy";
import { fmtKcal } from "../lib/nutrition";
import { EMPTY_PROFILE, fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";
import type { Goals, Profile } from "../lib/types";

export default function ProfilePage() {
  const { goals } = useStore();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const flash = (t: string) => {
    setSaved(t);
    setTimeout(() => setSaved(null), 2500);
  };
  const p = fillProfile(goals.profile) ?? EMPTY_PROFILE;

  return (
    <main className="page space-y-5">
      <h1 className="text-[26px] font-bold">โปรไฟล์</h1>
      {saved && (
        <p className="rounded-xl bg-olive-soft px-3 py-2 text-center text-[15px] text-olive-dark" role="status">{saved}</p>
      )}
      {editing ? (
        <EditProfile
          goals={goals}
          start={p}
          onDone={(msg) => {
            setEditing(false);
            if (msg) flash(msg);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <>
          <TargetCard goals={goals} onSaved={() => flash("บันทึกเป้าแล้ว")} />
          <InfoCard p={p} onEdit={() => setEditing(true)} />
        </>
      )}
      <Method />
    </main>
  );
}

function TargetCard({ goals, onSaved }: { goals: Goals; onSaved: () => void }) {
  const { setGoals } = useStore();
  const [value, setValue] = useState<number | null>(goals.targetKcal);
  // Follow the saved target when it changes elsewhere (e.g. after editing).
  const [last, setLast] = useState(goals.targetKcal);
  if (goals.targetKcal !== last) {
    setLast(goals.targetKcal);
    setValue(goals.targetKcal);
  }
  const protein = proteinTargetG(goals.profile);
  const mt = macroTargets(goals.targetKcal, protein);
  const changed = value != null && Math.round(value) !== goals.targetKcal;
  return (
    <section className="card space-y-3 p-5" data-testid="target-card">
      <BigTarget
        value={value}
        onChange={setValue}
        caption={goals.targetSource === "manual" ? "เป้าต่อวัน (ตั้งเอง)" : "เป้าต่อวัน"}
      />
      {changed && (
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={!validKcal(value)}
            onClick={() => {
              setGoals({ ...goals, targetKcal: Math.round(value!), targetSource: "manual" });
              onSaved();
            }}
          >
            บันทึก {validKcal(value) ? fmtKcal(value) : ""} kcal
          </button>
          <button className="btn-soft" onClick={() => setValue(goals.targetKcal)}>ยกเลิก</button>
        </div>
      )}
      <p className="text-center text-[13px] text-muted">
        {protein != null
          ? `โปรตีน ${protein} g (1.6 g/กก.) · คาร์บ ${Math.round(mt.carbs)} g · ไขมัน ${Math.round(mt.fat)} g (30%)`
          : `สัดส่วนทั่วไป P20/C50/F30 → โปรตีน ${Math.round(mt.protein)} g · คาร์บ ${Math.round(mt.carbs)} g · ไขมัน ${Math.round(mt.fat)} g`}
      </p>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function InfoCard({ p, onEdit }: { p: Profile; onEdit: () => void }) {
  const level = activityLevel(p.daily, p.exercise);
  const plan = usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null;
  return (
    <section className="card p-5" data-testid="info-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[22px] font-semibold">{p.name || "—"}</h2>
        <button className="btn-soft !min-h-[44px]" onClick={onEdit}>แก้ข้อมูล</button>
      </div>
      <div className="divide-y divide-line text-[16px]">
        <Row k="อายุ" v={p.age ? `${p.age} ปี` : "—"} />
        <Row k="ส่วนสูง · น้ำหนัก" v={p.heightCm ? `${p.heightCm} ซม. · ${kg(p.weightKg)} กก.` : "—"} />
        <Row k="เพศที่ใช้ในสมการ" v={p.sex === "male" ? "ชาย" : "หญิง"} />
        <Row k="ชีวิตประจำวัน" v={DAILY_LABEL[p.daily]} />
        <Row k="ออกกำลังกาย" v={EXERCISE_LABEL[p.exercise]} />
        <Row k="ระดับกิจกรรม" v={`${level.label} (×${level.factor})`} />
        <Row k="ใช้แอปเพื่อ" v={p.reason ? REASON_LABEL[p.reason] : "—"} />
        {(p.pregnant || p.breastfeeding) && <Row k="ตั้งครรภ์หรือให้นมลูก" v="ใช่ (ไม่ประเมินอัตโนมัติ)" />}
      </div>
      {plan && plan.direction !== "keep" && (
        <div className="mt-3">
          <PlanSummary p={p} plan={plan} onUseSafe={() => onEdit()} />
        </div>
      )}
    </section>
  );
}

function EditProfile({ goals, start, onDone }: { goals: Goals; start: Profile; onDone: (msg: string | null) => void }) {
  const { setGoals } = useStore();
  const [p, setP] = useState<Profile>(start);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const problem = !p.name?.trim() ? "ใส่ชื่อ" : bodyProblem(p) ?? reasonProblem(p);
  const result = useMemo(() => (problem ? null : estimateEnergy(p)), [p, problem]);
  const plan = usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null;
  const pregnantOrBf = p.pregnant || p.breastfeeding;

  function save(useSuggestion: boolean) {
    const profile = { ...p, name: p.name!.trim() };
    if (useSuggestion && result?.ok) {
      setGoals({ ...goals, profile, targetKcal: result.suggested, targetSource: "calc", maintenanceKcal: result.maintenance, skippedEstimate: false });
      onDone(`บันทึกแล้ว · เป้าใหม่ ${fmtKcal(result.suggested)} kcal`);
    } else {
      setGoals({ ...goals, profile });
      onDone("บันทึกข้อมูลแล้ว · เป้าเดิม");
    }
  }

  return (
    <section className="space-y-4" data-testid="edit-profile">
      <div className="card space-y-4 p-5">
        <NameField p={p} set={set} />
        <BodyFields p={p} set={set} />
        <label className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-cream px-4 text-[16px]">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--olive)]"
            checked={pregnantOrBf}
            onChange={(e) => set({ pregnant: e.target.checked, breastfeeding: false })}
          />
          ตั้งครรภ์หรือให้นมลูก
        </label>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[18px] font-semibold">ชีวิตประจำวัน</h2>
        <ActivityFields p={p} set={set} />
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[18px] font-semibold">ใช้แอปนี้เพื่ออะไร</h2>
        <ReasonFields p={p} set={set} plan={plan} />
      </div>

      <div className="card space-y-3 p-5">
        {problem && <p className="text-center text-[15px] text-warn-ink">{problem}</p>}
        {result && !result.ok && (
          <p className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">{result.message}</p>
        )}
        {result?.ok && result.suggested !== goals.targetKcal ? (
          <>
            <p className="text-center text-[16px]">
              เป้าที่แนะนำจากข้อมูลใหม่: <b className="num text-[22px]">{fmtKcal(result.suggested)}</b> kcal/วัน
              <br />
              <span className="text-[14px] text-muted">ตอนนี้ใช้ {fmtKcal(goals.targetKcal)} kcal</span>
            </p>
            <button className="btn-primary w-full" onClick={() => save(true)}>
              บันทึก และใช้ {fmtKcal(result.suggested)} kcal
            </button>
            <button className="btn-soft w-full" onClick={() => save(false)}>บันทึก แต่ใช้เป้าเดิม</button>
          </>
        ) : (
          <button className="btn-primary w-full" disabled={!!problem} onClick={() => save(false)}>บันทึก</button>
        )}
        <button className="mx-auto block min-h-[44px] text-[15px] text-muted underline" onClick={() => onDone(null)}>ยกเลิก</button>
      </div>
    </section>
  );
}

function Method() {
  return (
    <details className="card p-5 text-[14px] text-ink/80">
      <summary className="min-h-[28px] cursor-pointer text-[17px] font-semibold text-ink">วิธีคำนวณและแหล่งอ้างอิง</summary>
      <div className="mt-3 space-y-2">
        <p><b>1. พลังงานขณะพัก (BMR)</b> — สมการ Mifflin–St Jeor: หญิง 10×กก. + 6.25×ซม. − 5×อายุ − 161 · ชาย … + 5<br />
          Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241–247.</p>
        <p><b>2. ระดับกิจกรรม</b> — รวมคำตอบเรื่องชีวิตประจำวันกับการออกกำลังกาย แล้วเลือกตัวคูณมาตรฐานที่ใกล้ที่สุด:{" "}
          {ACTIVITY_LEVELS.map((l) => `${l.label} ×${l.factor}`).join(" · ")}<br />
          แนวคิดระดับกิจกรรม (PAL): FAO/WHO/UNU, Human Energy Requirements, 2004.</p>
        <p><b>3. ลด/เพิ่มน้ำหนัก</b> — น้ำหนักที่ต้องเปลี่ยน ÷ จำนวนสัปดาห์ = กก./สัปดาห์ แล้วคูณ 7,700 ÷ 7 เป็น kcal/วัน (7,700 kcal ≈ 1 กก. เป็นค่าประมาณทั่วไป แต่ละคนต่างกัน) · ความเร็วที่ปลอดภัย: ลดไม่เกิน 1 กก./สัปดาห์ และไม่เกิน 1% ของน้ำหนักตัว (NIH/NHLBI แนะนำราว 0.5–1 กก./สัปดาห์) · เพิ่มไม่เกิน 0.5 กก./สัปดาห์</p>
        <p><b>4. เพิ่มกล้ามเนื้อ</b> — พลังงานเพิ่ม +10% จากค่ารักษาน้ำหนัก และโปรตีน 1.6 g ต่อน้ำหนักตัว 1 กก. ต่อวัน · ISSN แนะนำ 1.4–2.0 g/กก./วัน สำหรับคนที่ออกกำลังกาย: Jäger R, et al. J Int Soc Sports Nutr. 2017;14:20.</p>
        <p><b>5. ขั้นต่ำเพื่อความปลอดภัย</b> — ไม่แนะนำต่ำกว่า 1,200 (หญิง) / 1,500 (ชาย) kcal/วัน หากไม่มีแพทย์ดูแล · NIH/NHLBI Clinical Guidelines on Overweight and Obesity in Adults, 1998.</p>
        <p className="text-muted">เป็นค่าประมาณเพื่อช่วยวางแผน ไม่ใช่คำแนะนำทางการแพทย์ ไม่ใช้กับผู้ที่อายุต่ำกว่า 18 ปี ตั้งครรภ์ หรือให้นม</p>
      </div>
    </details>
  );
}
