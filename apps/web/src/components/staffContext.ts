import { useOutletContext } from "react-router";

export type StaffContext = {
  // The shop's IANA time zone, or undefined if the session check couldn't reach the API.
  timeZone: string | undefined;
};

// What StaffLayout hands to every staff page.
export function useStaffContext(): StaffContext {
  return useOutletContext<StaffContext>();
}
