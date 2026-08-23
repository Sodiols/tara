"use client";


const messages = ["Free delivery in Sylhet on orders above ৳1500"];

export function AnnouncementBar() {
  return (
    <div className="bg-wine text-taraIvory text-center text-[11px] sm:text-xs tracking-wide py-2.5 px-4">
      <p>{messages[0]}</p>
    </div>
  );
}
