// Demo data for local development: a realistic queue with every status, plus overdue tickets.
// Idempotent: does nothing if tickets already exist. To start over: npm run db:reset -w apps/api
import { shopToday, type Status } from "@bike-repair/shared";
import { fromDateString, prisma } from "../src/db.ts";

const timeZone = process.env.SHOP_TIME_ZONE ?? "America/Vancouver";

function daysFromToday(days: number): Date {
  const today = fromDateString(shopToday(new Date(), timeZone));
  today.setUTCDate(today.getUTCDate() + days);
  return today;
}

// Path each seeded ticket took to reach its current status.
const PATHS: Record<Status, Status[]> = {
  received: ["received"],
  diagnosing: ["received", "diagnosing"],
  waiting_on_parts: ["received", "diagnosing", "waiting_on_parts"],
  in_progress: ["received", "diagnosing", "in_progress"],
  ready_for_pickup: ["received", "diagnosing", "in_progress", "ready_for_pickup"],
  picked_up: ["received", "diagnosing", "in_progress", "ready_for_pickup", "picked_up"],
};

const TICKETS: {
  number: string;
  name: string;
  phone: string;
  bike: string;
  problem: string;
  status: Status;
  promisedInDays: number;
  note?: string;
}[] = [
  {
    number: "K7P2QX",
    name: "Maya Chen",
    phone: "6045550142",
    bike: "Blue Trek FX 2 hybrid",
    problem: "Rear brake rubbing, gears skipping",
    status: "received",
    promisedInDays: 2,
  },
  {
    number: "R4M9TD",
    name: "Sam Okafor",
    phone: "6045550199",
    bike: "Black Specialized Rockhopper",
    problem: "Flat front tire, check tubeless sealant",
    status: "diagnosing",
    promisedInDays: 1,
  },
  {
    number: "H2W8NB",
    name: "Priya Patel",
    phone: "7785550123",
    bike: "Red Brompton folding bike",
    problem: "Hub gear slipping in 3rd",
    status: "waiting_on_parts",
    promisedInDays: -2,
    note: "Ordered replacement hub internals, ETA Friday",
  },
  {
    number: "C9N3VF",
    name: "Tom Becker",
    phone: "6045550167",
    bike: "Green Surly Long Haul Trucker",
    problem: "Full tune-up before tour",
    status: "in_progress",
    promisedInDays: 0,
  },
  {
    number: "J5D7XK",
    name: "Ana Souza",
    phone: "7785550188",
    bike: "White Cannondale road bike",
    problem: "Replace chain and cassette",
    status: "in_progress",
    promisedInDays: -1,
  },
  {
    number: "P8F4ZM",
    name: "Leo Martin",
    phone: "6045550111",
    bike: "Kids' orange Woom 4",
    problem: "Adjust brakes, raise seat",
    status: "ready_for_pickup",
    promisedInDays: -1,
  },
  {
    number: "B3T6YR",
    name: "Grace Kim",
    phone: "7785550134",
    bike: "Grey Rad Power e-bike",
    problem: "Squeaky disc brakes",
    status: "picked_up",
    promisedInDays: -5,
  },
];

async function main() {
  if ((await prisma.ticket.count()) > 0) {
    console.log("Seed skipped: tickets already exist.");
    return;
  }

  for (const t of TICKETS) {
    const path = PATHS[t.status];
    await prisma.ticket.create({
      data: {
        number: t.number,
        bikeDescription: t.bike,
        problem: t.problem,
        status: t.status,
        promisedBy: daysFromToday(t.promisedInDays),
        customer: { create: { name: t.name, phone: t.phone } },
        events: {
          create: path.map((toStatus, i) => ({
            fromStatus: i === 0 ? null : path[i - 1],
            toStatus,
            note: i === path.length - 1 ? t.note : undefined,
          })),
        },
      },
    });
  }
  console.log(`Seeded ${TICKETS.length} tickets.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
