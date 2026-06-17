import { redirect } from "next/navigation";

// Front (pazarlama) WordPress'te (marktasks.com). Bu proje sadece panel
// (dashboard.marktasks.com) — kök doğrudan login'e gider; giriş yapmışsa
// middleware /boards'a yönlendirir.
export default function RootPage() {
  redirect("/login");
}
