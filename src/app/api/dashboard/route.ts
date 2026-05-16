import { getDashboardData } from "@/lib/repository";

export async function GET() {
  return Response.json(await getDashboardData());
}
