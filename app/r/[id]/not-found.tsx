import Link from "next/link";

export default function SharedNotFound() {
  return (
    <main className="page pt-20 text-center">
      <div className="text-[40px]">💌</div>
      <p className="mt-3 text-[18px]">ไม่พบสูตรนี้ · This recipe wasn&apos;t found</p>
      <p className="mt-1 text-[14px] text-muted">ลิงก์อาจพิมพ์ไม่ครบ ลองขอลิงก์ใหม่จากเพื่อนนะ</p>
      <Link href="/" className="btn-soft mt-5">SnapCal</Link>
    </main>
  );
}
