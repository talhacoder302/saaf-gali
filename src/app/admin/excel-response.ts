import "server-only";

import { PermissionError } from "@/lib/permissions";
import { formatDate } from "@/lib/format";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Send a workbook as a download, or a plain error status when not allowed. */
export async function excelResponse(name: string, build: () => Promise<Buffer>): Promise<Response> {
  try {
    const buffer = await build();
    const filename = `saaf-gali-${name}-${formatDate(Date.now(), "yyyy-MM-dd")}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return new Response(null, { status: error.code === "unauthenticated" ? 401 : 403 });
    }
    throw error;
  }
}
