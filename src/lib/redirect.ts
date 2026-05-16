import { NextResponse } from "next/server";

export function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path
    }
  });
}
