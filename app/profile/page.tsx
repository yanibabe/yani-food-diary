"use client";
import { MILK_WARNING_ON } from "../lib/dairy";
import { BUFFER_CHOICES, BUFFER_TEXT, cleanBufferPct } from "../lib/calorieBuffer";
// Profile ("Frosted Calm" look, Round 30): her character, name, 2 big numbers, then a short list.
// Each list row opens what it holds right under it. Everything the page did before is still here.
// "แก้ข้อมูล" edits the same answers as first-run setup; a new suggestion
// only replaces the target after she confirms.

import { useEffect, useMemo, useState } from "react";
import { CharacterPicture } from "../components/Character";
import { BackupCard } from "../components/BackupCard";
import { WeightCard } from "../components/WeightCard";
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
  proteinPerKg,
  proteinTargetG,
  usesWeightGoal,
  weightPlan,
} from "../lib/energy";
import { LangToggle, useLang } from "../lib/lang";
import { fmtKcal } from "../lib/nutrition";
import { EMPTY_PROFILE, fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";
import type { Goals, Profile } from "../lib/types";
import { Icon } from "../components/Icon";

type Panel = "target" | "body" | "weight" | "buffer" | "avoid" | "lang" | "backup" | "method";

export default function ProfilePage() {
  const { goals } = useStore();
  const { tr, lang } = useLang();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Panel | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const flash = (t: string) => {
    setSaved(t);
    setTimeout(() => setSaved(null), 2500);
  };
  const toggle = (k: Panel) => setOpen((o) => (o === k ? null : k));
  // "Back up now" on Today links here with #backup: open that row.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (location.hash === "#backup") setOpen("backup");
  }, []);
  const p = fillProfile(goals.profile) ?? EMPTY_PROFILE;
  const plan = usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null;
  const goalKg = plan && plan.direction !== "keep" ? p.targetWeightKg : null;
  const bodyFacts = [
    p.age ? { value: `${p.age}`, label: tr("อายุ", "Age") } : null,
    p.heightCm ? { value: `${p.heightCm}`, label: tr("ซม.", "cm") } : null,
    p.weightKg ? { value: kg(p.weightKg), label: tr("กก.", "kg") } : null,
  ].filter((x): x is { value: string; label: string } => x !== null);

  return (
    <main className="page space-y-3">
      {saved && (
        <p className="glass px-3 py-2 text-center text-[15px]" role="status">{saved}</p>
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
          <header className="glass px-4 py-4" data-testid="profile-head">
            <div className="flex items-center gap-3.5">
              <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-protein" data-testid="profile-avatar">
                <CharacterPicture size={44} />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[24px] font-light">{p.name || tr("โปรไฟล์", "Profile")}</h1>
                {p.reason && (
                  <span className="mt-0.5 inline-block rounded-full bg-protein px-3 py-0.5 text-[13px] text-protein-ink" data-testid="profile-goal">
                    {REASON_LABEL[p.reason][lang]}
                  </span>
                )}
              </div>
            </div>
            {bodyFacts.length > 0 && (
              <div className="mt-3.5 grid grid-flow-col auto-cols-fr border-t border-line pt-3 text-center" data-testid="profile-facts">
                {bodyFacts.map((f) => (
                  <div key={f.label}>
                    <div className="num text-[20px] leading-tight">{f.value}</div>
                    <div className="text-[12px] text-muted">{f.label}</div>
                  </div>
                ))}
              </div>
            )}
          </header>

          <button
            type="button"
            className="glass grid w-full grid-cols-[1fr_1px_1fr] py-4 text-center active:scale-[0.99]"
            onClick={() => toggle("target")}
            aria-expanded={open === "target"}
            data-testid="profile-stats"
          >
            <span>
              <span className="num block text-[32px] leading-tight">{fmtKcal(goals.targetKcal)}</span>
              <span className="block text-[12px] text-muted">{tr("kcal ต่อวัน", "kcal a day")}</span>
            </span>
            <span className="bg-[rgba(43,39,36,0.12)]" />
            <span>
              <span className="num block text-[32px] leading-tight">{kg(goalKg ?? p.weightKg)}</span>
              <span className="block text-[12px] text-muted">{goalKg != null ? tr("กก. เป้าหมาย", "kg goal") : tr("กก. ตอนนี้", "kg now")}</span>
            </span>
          </button>
          {open === "target" && <TargetCard goals={goals} onSaved={() => flash(tr("บันทึกเป้าแล้ว", "Target saved"))} />}

          <section className="glass px-5 py-1" data-testid="profile-list">
            <ListRow first label={tr("ข้อมูลร่างกาย", "About me")} on={open === "body"} onClick={() => toggle("body")} testId="row-body">
              <InfoDetails p={p} onEdit={() => setEditing(true)} />
            </ListRow>
            <ListRow label={tr("น้ำหนัก", "Weight")} on={open === "weight"} onClick={() => toggle("weight")} testId="row-weight">
              <WeightCard />
            </ListRow>
            <ListRow
              label={tr("เผื่อแคลอรี่", "Calorie buffer")}
              hint={cleanBufferPct(goals.calorieBuffer) === 0 ? BUFFER_TEXT.none[lang] : `+${cleanBufferPct(goals.calorieBuffer)}%`}
              on={open === "buffer"}
              onClick={() => toggle("buffer")}
              testId="row-buffer"
            >
              <BufferCard />
            </ListRow>
            {MILK_WARNING_ON && (
              <ListRow label={tr("อาหารที่เลี่ยง", "Foods I avoid")} on={open === "avoid"} onClick={() => toggle("avoid")}>
                <AvoidCard />
              </ListRow>
            )}
            <ListRow
              label="ภาษา / Language"
              hint={lang === "en" ? "English" : "ไทย"}
              on={open === "lang"}
              onClick={() => toggle("lang")}
              testId="row-lang"
            >
              <LangToggle />
            </ListRow>
            <ListRow label={tr("สำรองข้อมูล", "Backup")} on={open === "backup"} onClick={() => toggle("backup")} testId="row-backup">
              <BackupCard />
            </ListRow>
            <ListRow label={tr("วิธีคำนวณ", "How it is worked out")} on={open === "method"} onClick={() => toggle("method")} testId="row-method">
              <Method />
            </ListRow>
          </section>
          <p className="pt-2 text-center text-[12px] text-muted" data-testid="build-id">
            SnapCal · {tr("เวอร์ชัน", "build")} {process.env.NEXT_PUBLIC_BUILD ?? "dev"}
          </p>
        </>
      )}
    </main>
  );
}

/** One line in the settings list. Tap to open what is inside, right under it. */
function ListRow({
  label,
  hint,
  on,
  onClick,
  first,
  testId,
  children,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onClick: () => void;
  first?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={first ? "" : "border-t border-[rgba(43,39,36,0.08)]"}>
      <button type="button" className="flex min-h-[54px] w-full items-center justify-between gap-3 text-left text-[16px]" onClick={onClick} aria-expanded={on} data-testid={testId}>
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[14px] text-muted">
          {hint}
          <Icon name="caret-right" className={`h-4 w-4 transition-transform ${on ? "rotate-90" : ""}`} />
        </span>
      </button>
      {on && <div className="calm-open pb-4">{children}</div>}
    </div>
  );
}

function TargetCard({ goals, onSaved }: { goals: Goals; onSaved: () => void }) {
  const { setGoals } = useStore();
  const { tr } = useLang();
  const [value, setValue] = useState<number | null>(goals.targetKcal);
  // Follow the saved target when it changes elsewhere (e.g. after editing).
  const [last, setLast] = useState(goals.targetKcal);
  if (goals.targetKcal !== last) {
    setLast(goals.targetKcal);
    setValue(goals.targetKcal);
  }
  const protein = proteinTargetG(goals.profile, goals.targetKcal);
  const mt = macroTargets(goals.targetKcal, protein);
  const changed = value != null && Math.round(value) !== goals.targetKcal;
  return (
    <section className="card space-y-3 p-5" data-testid="target-card">
      <BigTarget
        value={value}
        onChange={setValue}
        caption={goals.targetSource === "manual" ? tr("เป้าต่อวัน (ตั้งเอง)", "Daily target (set by me)") : tr("เป้าต่อวัน", "Daily target")}
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
            {tr("บันทึก", "Save")} {validKcal(value) ? fmtKcal(value) : ""} kcal
          </button>
          <button className="btn-soft" onClick={() => setValue(goals.targetKcal)}>{tr("ยกเลิก", "Cancel")}</button>
        </div>
      )}
      <p className="text-center text-[13px] text-muted">
        {protein != null
          ? tr(
              `โปรตีน ${protein} g (${proteinPerKg(goals.profile?.reason)} g/กก.) · คาร์บ ${Math.round(mt.carbs)} g · ไขมัน ${Math.round(mt.fat)} g (30%)`,
              `Protein ${protein} g (${proteinPerKg(goals.profile?.reason)} g/kg) · Carbs ${Math.round(mt.carbs)} g · Fat ${Math.round(mt.fat)} g (30%)`,
            )
          : tr(
              `สัดส่วนทั่วไป P20/C50/F30 → โปรตีน ${Math.round(mt.protein)} g · คาร์บ ${Math.round(mt.carbs)} g · ไขมัน ${Math.round(mt.fat)} g`,
              `Usual split P20/C50/F30 → Protein ${Math.round(mt.protein)} g · Carbs ${Math.round(mt.carbs)} g · Fat ${Math.round(mt.fat)} g`,
            )}
      </p>
    </section>
  );
}

/** Round 40: the optional Smart Calorie Buffer (kcal only, AI guesses only, 0% by default). */
function BufferCard() {
  const { goals, setGoals } = useStore();
  const { lang } = useLang();
  const now = cleanBufferPct(goals.calorieBuffer);
  return (
    <section className="space-y-3 pb-3" data-testid="buffer-card">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={BUFFER_TEXT.title[lang]}>
        {BUFFER_CHOICES.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={now === p}
            onClick={() => setGoals({ ...goals, calorieBuffer: p })}
            className={`num min-h-[44px] rounded-2xl text-[15px] font-medium ${now === p ? "bg-olive text-white" : "bg-cream text-ink"}`}
            data-testid={`buffer-${p}`}
          >
            {p}%
          </button>
        ))}
      </div>
      <p className="px-1 text-[13px] text-muted">
        {now === 0 ? BUFFER_TEXT.none[lang] : `+${now}%`} · {lang === "en" ? "e.g. AI 500 kcal →" : "เช่น AI 500 kcal →"}{" "}
        <b className="num text-ink">{Math.round((500 * (100 + now)) / 100)}</b> kcal
      </p>
      <p className="px-1 text-[13px] text-muted">{BUFFER_TEXT.explain[lang]}</p>
    </section>
  );
}

function AvoidCard() {
  const { goals, setGoals } = useStore();
  const { tr } = useLang();
  return (
    <section className="card space-y-2 p-5" data-testid="avoid-card">
      <h2 className="text-[17px] font-semibold">{tr("อาหารที่เลี่ยง", "Foods I avoid")}</h2>
      <label className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-cream px-4 text-[16px]">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--olive)]"
          checked={goals.avoidDairy === true}
          onChange={(e) => setGoals({ ...goals, avoidDairy: e.target.checked })}
          data-testid="avoid-dairy"
        />
        🥛 {tr("นมและผลิตภัณฑ์จากนม", "Milk and milk products")}
      </label>
      <p className="px-1 text-[13px] text-muted">
        {tr(
          "นม ครีม ชีส โยเกิร์ต เนย นมข้น ไอศกรีม · แอปจะเตือนเมื่ออาหารอาจมีนม (เป็นการเดา ไม่ใช่ข้อมูลแน่นอน)",
          "Milk, cream, cheese, yogurt, butter, condensed milk, ice cream · The app warns when a food may have milk (a guess, not a sure thing)",
        )}
      </p>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function InfoDetails({ p, onEdit }: { p: Profile; onEdit: () => void }) {
  const { tr, lang } = useLang();
  const level = activityLevel(p.daily, p.exercise);
  const plan = usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null;
  return (
    <div data-testid="info-card">
      <div className="divide-y divide-line text-[15px]">
        <Row k={tr("อายุ", "Age")} v={p.age ? tr(`${p.age} ปี`, `${p.age} years`) : "—"} />
        <Row
          k={tr("ส่วนสูง · น้ำหนัก", "Height · Weight")}
          v={p.heightCm ? tr(`${p.heightCm} ซม. · ${kg(p.weightKg)} กก.`, `${p.heightCm} cm · ${kg(p.weightKg)} kg`) : "—"}
        />
        <Row k={tr("เพศ", "Sex")} v={p.sex === "male" ? tr("ชาย", "Male") : tr("หญิง", "Female")} />
        <Row k={tr("ชีวิตประจำวัน", "Daily life")} v={DAILY_LABEL[p.daily][lang]} />
        <Row k={tr("ออกกำลังกาย", "Exercise")} v={EXERCISE_LABEL[p.exercise][lang]} />
        <Row k={tr("ระดับกิจกรรม", "Activity level")} v={`${level.label[lang]} (×${level.factor})`} />
        <Row k={tr("ใช้แอปเพื่อ", "Using the app to")} v={p.reason ? REASON_LABEL[p.reason][lang] : "—"} />
        {(p.pregnant || p.breastfeeding) && (
          <Row k={tr("ตั้งครรภ์หรือให้นมลูก", "Pregnant or breastfeeding")} v={tr("ใช่ (ไม่ประเมินอัตโนมัติ)", "Yes (no automatic estimate)")} />
        )}
      </div>
      {plan && plan.direction !== "keep" && (
        <div className="mt-3">
          <PlanSummary p={p} plan={plan} onUseSafe={() => onEdit()} />
        </div>
      )}
      <button className="btn-soft mt-3 w-full" onClick={onEdit}>{tr("แก้ข้อมูล", "Edit")}</button>
    </div>
  );
}

function EditProfile({ goals, start, onDone }: { goals: Goals; start: Profile; onDone: (msg: string | null) => void }) {
  const { setGoals } = useStore();
  const { tr, lang } = useLang();
  const [p, setP] = useState<Profile>(start);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const problem = !p.name?.trim() ? tr("ใส่ชื่อ", "Enter your name") : bodyProblem(p, lang) ?? reasonProblem(p, lang);
  const result = useMemo(() => (problem ? null : estimateEnergy(p, lang)), [p, problem, lang]);
  const plan = usesWeightGoal(p.reason) && !reasonProblem(p) ? weightPlan(p) : null;
  const pregnantOrBf = p.pregnant || p.breastfeeding;

  function save(useSuggestion: boolean) {
    const profile = { ...p, name: p.name!.trim() };
    if (useSuggestion && result?.ok) {
      setGoals({ ...goals, profile, targetKcal: result.suggested, targetSource: "calc", maintenanceKcal: result.maintenance, skippedEstimate: false });
      onDone(tr(`บันทึกแล้ว · เป้าใหม่ ${fmtKcal(result.suggested)} kcal`, `Saved · new target ${fmtKcal(result.suggested)} kcal`));
    } else {
      setGoals({ ...goals, profile });
      onDone(tr("บันทึกข้อมูลแล้ว · เป้าเดิม", "Saved · same target"));
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
          {tr("ตั้งครรภ์หรือให้นมลูก", "Pregnant or breastfeeding")}
        </label>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[18px] font-semibold">{tr("ชีวิตประจำวัน", "Daily life")}</h2>
        <ActivityFields p={p} set={set} />
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[18px] font-semibold">{tr("ใช้แอปนี้เพื่ออะไร", "What is this app for?")}</h2>
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
              {tr("เป้าที่แนะนำจากข้อมูลใหม่", "Suggested target from your new answers")}:{" "}
              <b className="num text-[22px]">{fmtKcal(result.suggested)}</b> {tr("kcal/วัน", "kcal/day")}
              <br />
              <span className="text-[14px] text-muted">{tr("ตอนนี้ใช้", "Now using")} {fmtKcal(goals.targetKcal)} kcal</span>
            </p>
            <button className="btn-primary w-full" onClick={() => save(true)}>
              {tr(`บันทึก และใช้ ${fmtKcal(result.suggested)} kcal`, `Save and use ${fmtKcal(result.suggested)} kcal`)}
            </button>
            <button className="btn-soft w-full" onClick={() => save(false)}>{tr("บันทึก แต่ใช้เป้าเดิม", "Save, keep my old target")}</button>
          </>
        ) : (
          <button className="btn-primary w-full" disabled={!!problem} onClick={() => save(false)}>{tr("บันทึก", "Save")}</button>
        )}
        <button className="mx-auto block min-h-[44px] text-[15px] text-muted underline" onClick={() => onDone(null)}>{tr("ยกเลิก", "Cancel")}</button>
      </div>
    </section>
  );
}

function Method() {
  const { lang } = useLang();
  if (lang === "en") return <MethodEn />;
  return (
    <div className="text-[14px] text-ink/80">
      <div className="space-y-2">
        <p><b>1. พลังงานขณะพัก (BMR)</b> — สมการ Mifflin–St Jeor: หญิง 10×กก. + 6.25×ซม. − 5×อายุ − 161 · ชาย … + 5<br />
          Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241–247.</p>
        <p><b>2. ระดับกิจกรรม</b> — รวมคำตอบเรื่องชีวิตประจำวันกับการออกกำลังกาย แล้วเลือกตัวคูณมาตรฐานที่ใกล้ที่สุด:{" "}
          {ACTIVITY_LEVELS.map((l) => `${l.label.th} ×${l.factor}`).join(" · ")}<br />
          แนวคิดระดับกิจกรรม (PAL): FAO/WHO/UNU, Human Energy Requirements, 2004.</p>
        <p><b>3. ลด/เพิ่มน้ำหนัก</b> — น้ำหนักที่ต้องเปลี่ยน ÷ จำนวนสัปดาห์ = กก./สัปดาห์ แล้วคูณ 7,700 ÷ 7 เป็น kcal/วัน (7,700 kcal ≈ 1 กก. เป็นค่าประมาณทั่วไป แต่ละคนต่างกัน) · ความเร็วที่ปลอดภัย: ลดไม่เกิน 1 กก./สัปดาห์ และไม่เกิน 1% ของน้ำหนักตัว (NIH/NHLBI แนะนำราว 0.5–1 กก./สัปดาห์) · เพิ่มไม่เกิน 0.5 กก./สัปดาห์</p>
        <p><b>3b. ลดน้ำหนัก — โปรตีน</b> — 1.4 g ต่อน้ำหนักตัว 1 กก. ต่อวัน (กลางช่วง 1.2–1.6 g/กก./วัน สำหรับคนทั่วไปตามคำแนะนำ ISSN ปี 2026 เรื่องอาหารเพื่อลดน้ำหนัก) โปรตีนจะไม่เกิน 35% ของแคลอรี่ทั้งวัน ส่วนรักษา/เพิ่มน้ำหนักใช้สัดส่วนทั่วไป 20% / 50% / 30%</p>
        <p><b>4. เพิ่มกล้ามเนื้อ</b> — พลังงานเพิ่ม +10% จากค่ารักษาน้ำหนัก และโปรตีน 1.6 g ต่อน้ำหนักตัว 1 กก. ต่อวัน · ISSN แนะนำ 1.4–2.0 g/กก./วัน สำหรับคนที่ออกกำลังกาย: Jäger R, et al. J Int Soc Sports Nutr. 2017;14:20.</p>
        <p><b>5. ขั้นต่ำเพื่อความปลอดภัย</b> — ไม่แนะนำต่ำกว่า 1,200 (หญิง) / 1,500 (ชาย) kcal/วัน หากไม่มีแพทย์ดูแล · NIH/NHLBI Clinical Guidelines on Overweight and Obesity in Adults, 1998.</p>
        <p className="text-muted">เป็นค่าประมาณเพื่อช่วยวางแผน ไม่ใช่คำแนะนำทางการแพทย์ ไม่ใช้กับผู้ที่อายุต่ำกว่า 18 ปี ตั้งครรภ์ หรือให้นม</p>
      </div>
    </div>
  );
}

function MethodEn() {
  return (
    <div className="text-[14px] text-ink/80">
      <div className="space-y-2">
        <p><b>1. Resting energy (BMR)</b> — Mifflin–St Jeor equation: female 10×kg + 6.25×cm − 5×age − 161 · male … + 5<br />
          Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241–247.</p>
        <p><b>2. Activity level</b> — your daily life and exercise answers are combined, then the closest standard multiplier is used:{" "}
          {ACTIVITY_LEVELS.map((l) => `${l.label.en} ×${l.factor}`).join(" · ")}<br />
          Physical activity level (PAL) idea: FAO/WHO/UNU, Human Energy Requirements, 2004.</p>
        <p><b>3. Lose / gain weight</b> — kg to change ÷ number of weeks = kg/week, then × 7,700 ÷ 7 = kcal/day (7,700 kcal ≈ 1 kg is a common rough guide; people differ) · Safe pace: lose no more than 1 kg/week and no more than 1% of body weight (NIH/NHLBI suggests about 0.5–1 kg/week) · gain no more than 0.5 kg/week.</p>
        <p><b>3b. Lose weight — protein</b> — 1.4 g per kg of body weight per day (the middle of the 1.2–1.6 g/kg/day range for the general population in the 2026 ISSN position stand on diets for body-weight reduction). Protein is never set above 35% of your day’s calories. Keep / gain weight use the usual 20% / 50% / 30% split.</p>
        <p><b>4. Build muscle</b> — +10% energy above “keep weight”, and protein of 1.6 g per kg of body weight per day · ISSN suggests 1.4–2.0 g/kg/day for people who exercise: Jäger R, et al. J Int Soc Sports Nutr. 2017;14:20.</p>
        <p><b>5. Safe minimum</b> — not below 1,200 (female) / 1,500 (male) kcal/day without a doctor · NIH/NHLBI Clinical Guidelines on Overweight and Obesity in Adults, 1998.</p>
        <p className="text-muted">These are estimates to help you plan, not medical advice. Not for people under 18, pregnant, or breastfeeding.</p>
      </div>
    </div>
  );
}
