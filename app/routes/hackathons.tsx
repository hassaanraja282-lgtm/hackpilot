import { Outlet } from "react-router";

export function meta() {
  return [{ title: "Hackathons · Hackpilot" }];
}

export default function HackathonsLayout() {
  return <Outlet />;
}
