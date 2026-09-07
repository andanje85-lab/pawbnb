import { jsPDF } from "jspdf";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

export interface ReceiptBooking {
  id: string;
  check_in: string;
  check_out: string;
  number_of_dogs: number;
  total_price: number | string;
  status: string;
  created_at: string;
  discount_applied?: number | string | null;
  discount_reason?: string | null;
  refund_amount?: number | string | null;
  cancelled_at?: string | null;
  listings?: {
    title?: string | null;
    city?: string | null;
    price_per_night?: number | string | null;
  } | null;
}

const money = (v: number | string | null | undefined) =>
  `$${Number(v ?? 0).toFixed(2)}`;

export function generateBookingReceipt(booking: ReceiptBooking, guestName?: string | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 56;
  const right = pageWidth - 56;
  let y = 64;

  const listing = booking.listings ?? {};
  const nights = Math.max(
    1,
    differenceInCalendarDays(parseISO(booking.check_out), parseISO(booking.check_in))
  );
  const nightly = Number(listing.price_per_night ?? 0);
  const discount = Number(booking.discount_applied ?? 0);
  const total = Number(booking.total_price ?? 0);
  const subtotal = total + discount;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("PawBnB", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text("Booking receipt", right, y, { align: "right" });
  doc.setTextColor(0);

  y += 14;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);

  const row = (label: string, value: string, bold = false) => {
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(label, left, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value, right, y, { align: "right" });
  };

  const heading = (text: string) => {
    y += 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(text, left, y);
  };

  heading("Stay details");
  row("Receipt number", booking.id.slice(0, 8).toUpperCase());
  row("Issued", format(new Date(), "MMM d, yyyy"));
  row("Guest", guestName || "Guest");
  row("Stay", listing.title || "Listing");
  if (listing.city) row("Location", listing.city);
  row("Check-in", format(parseISO(booking.check_in), "EEE, MMM d, yyyy"));
  row("Check-out", format(parseISO(booking.check_out), "EEE, MMM d, yyyy"));
  row("Nights", String(nights));
  row("Dogs", String(booking.number_of_dogs));
  row("Status", booking.status.charAt(0).toUpperCase() + booking.status.slice(1));

  heading("Payment summary");
  if (nightly > 0) row(`Nightly rate x ${nights}`, money(nightly * nights));
  row("Subtotal", money(subtotal));
  if (discount > 0) row(booking.discount_reason || "Discount", `-${money(discount)}`);
  row("Total", money(total), true);
  if (Number(booking.refund_amount ?? 0) > 0) {
    row("Refunded", money(booking.refund_amount), true);
  }

  y += 40;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(
    "Thank you for booking with PawBnB. Keep this receipt for your records.",
    left,
    y
  );
  y += 14;
  doc.text(`Booked on ${format(parseISO(booking.created_at), "MMM d, yyyy")}`, left, y);

  doc.save(`pawbnb-receipt-${booking.id.slice(0, 8)}.pdf`);
}
