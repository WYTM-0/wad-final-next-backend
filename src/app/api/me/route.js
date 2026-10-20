import { requireUser } from "@/lib/auth";
import { OPTIONS, successResponse, printExceptionLog, errorResponse } from "@/lib/utils";
export { OPTIONS };
export async function GET(request) {
  try {
    const { error, profile } = await requireUser(request);
    if (error) return error;
    return successResponse({ user: profile }, 200, request);
  } catch (err) {
    printExceptionLog("GET me", err);
    return errorResponse("Unable to retrieve account", 500, request);
  }
}
