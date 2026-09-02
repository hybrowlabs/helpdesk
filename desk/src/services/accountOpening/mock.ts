/**
 * Account Opening — mock adapter for the vendor application.
 *
 * Serves a dummy application in exactly the shape `api.ts` will return, so the
 * Details sub-tab can be built and demoed before PhillipCapital's account
 * opening service exists. Swapping to live is a config change in `service.ts`;
 * nothing in the components or presenter changes.
 *
 * It mocks *only* the application. The case, its verification block and the
 * workflow are real Frappe data with real endpoints, and are delegated to
 * `HttpAccountOpeningService` — see the class docstring for why faking them
 * actively breaks the ticket header.
 *
 * Behaviour worth knowing:
 *  - Applications are deterministic per ticket (hashed into a fixture list), so
 *    a given ticket always shows the same client across reloads.
 *  - `setMockScenario()` forces the empty and error branches for QA.
 */

import { HttpAccountOpeningService } from "./api";
import { computeAge, isVideoVerificationRequired } from "./presenter";
import {
  AccountOpeningError,
  type AccountOpeningApplication,
  type AccountOpeningRecord,
  type AccountOpeningService,
  type VerificationDetails,
} from "./types";

/**
 * Fixtures carry the date of birth only; `age` and `videoVerificationRequired`
 * are derived at fetch time, the same way the backend derives them. Hard-coding
 * them would go stale as the calendar moves.
 */
type ApplicationFixture = Omit<
  AccountOpeningApplication,
  "age" | "videoVerificationRequired"
>;

export type MockScenario = "success" | "empty" | "error" | "slow";

let scenario: MockScenario = "success";

/** QA hook — flip the mock into its empty/error/slow branch at runtime. */
export function setMockScenario(next: MockScenario): void {
  scenario = next;
}

export function getMockScenario(): MockScenario {
  return scenario;
}

const LATENCY_MS = 450;
const SLOW_LATENCY_MS = 4000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stable string hash so the same ticket always maps to the same fixture. */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Fixture applications. Field-for-field identical to what the live API
 * returns — if you add a field here, add it to `types.ts` and the backend
 * serializer too.
 */
const FIXTURES: readonly ApplicationFixture[] = [
  {
    applicationNo: "AO-2026-004821",
    clientId: "PC10023456",
    clientName: "Ritika Gupta",
    panNumber: "ABCDE1234F",
    email: "ritika.gupta@example.com",
    mobile: "+91 98200 41122",
    dateOfBirth: "1994-02-11",
    applicationDate: "2026-07-14",
    status: "Under Verification",
    accountType: "Individual",
    clientType: "Trading & Demat",
    holderType: "Single",
    depository: "CDSL",
    dpId: "IN300214",
    sebiRegistrationNo: "INZ000031633",
    address: {
      line1: "402, Sunworld Residency",
      line2: "Linking Road, Bandra West",
      city: "Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      pincode: "400050",
      country: "India",
    },
    bank: {
      bankName: "HDFC Bank",
      accountNumber: "XXXXXXXX4471",
      ifscCode: "HDFC0000123",
      branchName: "Bandra West",
    },
    nominees: [
      { name: "Anil Gupta", relationship: "Father", sharePercentage: 100 },
    ],
    salesRepresentative: {
      name: "Karan Mehta",
      employeeCode: "PC-EMP-2214",
      branch: "Mumbai HO",
      extensionNumber: "2214",
    },
  },
  {
    applicationNo: "AO-2026-004907",
    clientId: "PC10024310",
    clientName: "Suresh Iyer",
    panNumber: "FGHIJ5678K",
    email: "suresh.iyer@example.com",
    mobile: "+91 99401 77320",
    dateOfBirth: "1981-09-30",
    applicationDate: "2026-07-19",
    status: "Submitted",
    accountType: "Joint",
    clientType: "Demat",
    holderType: "Either or Survivor",
    depository: "NSDL",
    dpId: "IN301774",
    sebiRegistrationNo: "INZ000031633",
    address: {
      line1: "17, Kamaraj Avenue",
      line2: "Adyar",
      city: "Chennai",
      district: "Chennai",
      state: "Tamil Nadu",
      pincode: "600020",
      country: "India",
    },
    bank: {
      bankName: "ICICI Bank",
      accountNumber: "XXXXXXXX8802",
      ifscCode: "ICIC0001042",
      branchName: "Adyar",
    },
    nominees: [
      { name: "Lakshmi Iyer", relationship: "Spouse", sharePercentage: 60 },
      { name: "Aditya Iyer", relationship: "Son", sharePercentage: 40 },
    ],
    salesRepresentative: {
      name: "Priya Nair",
      employeeCode: "PC-EMP-3187",
      branch: "Chennai",
      extensionNumber: "3187",
    },
  },
  {
    applicationNo: "AO-2026-005033",
    clientId: "PC10025108",
    clientName: "Meridian Textiles Pvt Ltd",
    panNumber: "AAACM9012L",
    email: "accounts@meridiantextiles.example.com",
    mobile: "+91 79402 11908",
    dateOfBirth: null,
    applicationDate: "2026-07-23",
    status: "On Hold",
    accountType: "Corporate",
    clientType: "Commodity",
    holderType: "Joint",
    depository: "CDSL",
    dpId: "IN302902",
    sebiRegistrationNo: "INZ000031633",
    address: {
      line1: "Plot 42, GIDC Estate",
      line2: "Phase II, Vatva",
      city: "Ahmedabad",
      district: "Ahmedabad",
      state: "Gujarat",
      pincode: "382445",
      country: "India",
    },
    bank: {
      bankName: "Axis Bank",
      accountNumber: "XXXXXXXX1195",
      ifscCode: "UTIB0000216",
      branchName: "Vatva GIDC",
    },
    nominees: [],
    salesRepresentative: {
      name: "Devang Shah",
      employeeCode: "PC-EMP-1140",
      branch: "Ahmedabad",
      extensionNumber: "1140",
    },
  },
  // Senior client — exercises the video-verification compliance rule.
  {
    applicationNo: "AO-2026-005190",
    clientId: "PC10025744",
    clientName: "Kamala Venkataraman",
    panNumber: "PQRST3456M",
    email: "kamala.v@example.com",
    mobile: "+91 98450 63317",
    dateOfBirth: "1951-03-08",
    applicationDate: "2026-07-25",
    status: "Under Verification",
    accountType: "Individual",
    clientType: "Trading",
    holderType: "Single",
    depository: "NSDL",
    dpId: "IN300095",
    sebiRegistrationNo: "INZ000031633",
    address: {
      line1: "9, Jayanagar 4th Block",
      line2: "Near South End Circle",
      city: "Bengaluru",
      district: "Bengaluru Urban",
      state: "Karnataka",
      pincode: "560011",
      country: "India",
    },
    bank: {
      bankName: "State Bank of India",
      accountNumber: "XXXXXXXX7326",
      ifscCode: "SBIN0003162",
      branchName: "Jayanagar",
    },
    nominees: [
      { name: "Ravi Venkataraman", relationship: "Son", sharePercentage: 100 },
    ],
    salesRepresentative: {
      name: "Sneha Rao",
      employeeCode: "PC-EMP-4402",
      branch: "Bengaluru",
      extensionNumber: "4402",
    },
  },
];

export function resetMockStore(): void {
  scenario = "success";
}

function applicationForTicket(ticketId: string): AccountOpeningApplication {
  const fixture = FIXTURES[hash(ticketId) % FIXTURES.length];
  const age = computeAge(fixture.dateOfBirth);

  return {
    ...fixture,
    age,
    videoVerificationRequired: isVideoVerificationRequired(age),
  };
}

/**
 * Overlay the mock application the same way the live path does.
 *
 * `_merge_verification` on the server fills a verification field the case has
 * not got from the application — notably `clientDateOfBirth`, which is what the
 * age rule reads. Under the mock adapter the application is attached *after*
 * that merge has already run against `application: null`, so without this the
 * Form tab would show an empty date of birth while the banner above it says the
 * client is 70 or above. Same precedence as the server: the case wins.
 */
function withApplication(
  record: AccountOpeningRecord,
  application: AccountOpeningApplication
): AccountOpeningRecord {
  const verification = { ...record.verification };
  const fromApplication = [
    ...(record.meta?.verificationFromApplication ?? []),
  ];

  if (!verification.clientDateOfBirth && application.dateOfBirth) {
    verification.clientDateOfBirth = application.dateOfBirth;
    fromApplication.push("clientDateOfBirth");
  }

  return {
    ...record,
    application,
    verification,
    meta: {
      ...record.meta,
      source: "mock",
      verificationFromApplication: fromApplication,
    },
  };
}

export class MockAccountOpeningService implements AccountOpeningService {
  private readonly live = new HttpAccountOpeningService();

  async fetch(ticketId: string): Promise<AccountOpeningRecord | null> {
    await delay(scenario === "slow" ? SLOW_LATENCY_MS : LATENCY_MS);

    if (scenario === "error") {
      throw new AccountOpeningError(
        "NETWORK",
        "Mock failure: could not reach the account opening service"
      );
    }

    const record = await this.live.fetch(ticketId);
    if (!record || scenario === "empty") return record;

    return withApplication(record, applicationForTicket(ticketId));
  }

  async createCase(ticketId: string): Promise<AccountOpeningRecord> {
    const record = await this.live.createCase(ticketId);

    return withApplication(record, applicationForTicket(ticketId));
  }

  async saveVerification(
    ticketId: string,
    verification: VerificationDetails
  ): Promise<VerificationDetails> {
    return this.live.saveVerification(ticketId, verification);
  }
}
